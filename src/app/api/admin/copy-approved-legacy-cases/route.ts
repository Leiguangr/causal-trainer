import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { mapLegacyToTaxonomy } from '@/lib/legacy-trap-mapping';
import { getL2TrapByCode, L2_TRAP_TAXONOMY } from '@/lib/l2-trap-taxonomy';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataset, targetDataset, streamProgress } = body;

    // Generate target dataset name if not provided
    const finalTargetDataset = targetDataset || `legacy-migrated-${Date.now()}`;

    // Find all legacy Question cases that have APPROVED evaluations
    const whereClause: any = {
      question_id: { not: null },
      overall_verdict: 'APPROVED',
    };

    if (dataset) {
      whereClause.question = {
        dataset,
      };
    }

    const approvedEvaluations = await prisma.caseEvaluation.findMany({
      where: whereClause,
      include: {
        question: true,
      },
    });

    if (approvedEvaluations.length === 0) {
      return NextResponse.json({
        success: true,
        copiedCount: 0,
        byType: { L1: 0, L2: 0, L3: 0 },
        message: 'No approved legacy cases found to copy',
      });
    }

    // Process all evaluations without deduplication by question ID
    const questions = approvedEvaluations
      .map(eval_ => eval_.question)
      .filter((q): q is NonNullable<typeof q> => q !== null);

    // If streaming is requested, use streaming response
    if (streamProgress) {
      return streamCopyProgress(questions, finalTargetDataset);
    }

    const byType = { L1: 0, L2: 0, L3: 0 };
    const newCaseIds: string[] = [];
    const errors: string[] = [];

    // Copy each question to the appropriate case table
    for (const question of questions) {
      try {
        const pearlLevel = question.pearl_level;
        if (!pearlLevel || !['L1', 'L2', 'L3'].includes(pearlLevel)) {
          continue;
        }

        // Note: We don't skip cases that already exist - approved cases should be copied
        // even if they exist in the target dataset (they may have been updated/improved)

        // Use LLM to validate and transform ALL fields to ensure correct format
        const transformedData = await transformAndValidateAllFields(pearlLevel, question);

        // Build the T3Case data with LLM-transformed fields
        const t3CaseData: any = {
          pearl_level: pearlLevel,
          scenario: transformedData.scenario,
          label: transformedData.label,
          is_ambiguous: transformedData.is_ambiguous,
          variables: JSON.stringify(transformedData.variables),
          trap_type: transformedData.trap_type,
          trap_subtype: transformedData.trap_subtype || null,
          trap_type_name: pearlLevel === 'L2' && transformedData.trap_type
            ? (getL2TrapByCode(transformedData.trap_type as any)?.name ?? null)
            : null,
          difficulty: transformedData.difficulty,
          causal_structure: transformedData.causal_structure || null,
          key_insight: transformedData.key_insight || null,
          hidden_timestamp: transformedData.hidden_timestamp || null,
          conditional_answers: transformedData.conditional_answers 
            ? (typeof transformedData.conditional_answers === 'string' 
                ? transformedData.conditional_answers 
                : JSON.stringify(transformedData.conditional_answers))
            : null,
          wise_refusal: transformedData.wise_refusal || null,
          gold_rationale: transformedData.gold_rationale || null,
          domain: transformedData.domain || null,
          subdomain: transformedData.subdomain || null,
          dataset: finalTargetDataset, // Use the new target dataset
          author: question.author || 'Legacy Migration',
          source_case: question.source_case || null,
          is_verified: false, // New T3 cases are not yet T3-evaluated; keep unverified so they appear in "Unverified only" evaluations
        };

        // Level-specific fields
        if (pearlLevel === 'L1' || pearlLevel === 'L2') {
          t3CaseData.claim = transformedData.claim || null;
        } else if (pearlLevel === 'L3') {
          t3CaseData.counterfactual_claim = transformedData.counterfactual_claim || null;
          // Convert invariants array to JSON string (or null if empty/missing)
          if (transformedData.invariants !== undefined && transformedData.invariants !== null) {
            const invArray = Array.isArray(transformedData.invariants) 
              ? transformedData.invariants 
              : (typeof transformedData.invariants === 'string' 
                  ? (() => {
                      try {
                        const parsed = JSON.parse(transformedData.invariants);
                        return Array.isArray(parsed) ? parsed : [];
                      } catch {
                        return [];
                      }
                    })()
                  : []);
            t3CaseData.invariants = invArray.length > 0 ? JSON.stringify(invArray) : null;
          } else {
            t3CaseData.invariants = null;
          }
        }

        const newCase = await prisma.t3Case.create({
          data: t3CaseData,
        });

        if (pearlLevel === 'L1') byType.L1++;
        else if (pearlLevel === 'L2') byType.L2++;
        else if (pearlLevel === 'L3') byType.L3++;

        newCaseIds.push(newCase.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Question ${question.id}: ${errorMsg}`);
        console.error(`Error copying question ${question.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      copiedCount: newCaseIds.length,
      byType,
      targetDataset: finalTargetDataset,
      newCaseIds: newCaseIds.slice(0, 10), // Return first 10 IDs as sample
      errors: errors.slice(0, 10), // Return first 10 errors as sample
      message: `Successfully copied ${newCaseIds.length} approved legacy cases to new schema in dataset "${finalTargetDataset}"${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
    });
  } catch (error) {
    console.error('Copy approved legacy cases error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to copy approved legacy cases' },
      { status: 500 }
    );
  }
}

async function transformAndValidateAllFields(
  pearlLevel: 'L1' | 'L2' | 'L3',
  question: any
): Promise<any> {
  // Parse variables from legacy format
  let variables: Record<string, any> = {};
  try {
    if (question.variables) {
      variables = typeof question.variables === 'string'
        ? JSON.parse(question.variables)
        : question.variables;
    }
  } catch {
    variables = { X: '', Y: '', Z: [] };
  }

  // Ensure variables.Z is an array
  if (!Array.isArray(variables.Z)) {
    variables.Z = variables.Z ? [variables.Z] : [];
  }

  // Parse conditional answers from legacy format
  let conditionalAnswers: any = null;
  try {
    if (question.conditional_answers) {
      const parsed = typeof question.conditional_answers === 'string'
        ? JSON.parse(question.conditional_answers)
        : question.conditional_answers;
      conditionalAnswers = {
        answer_if_condition_1: parsed?.answer_if_condition_1 || parsed?.answerIfA || '',
        answer_if_condition_2: parsed?.answer_if_condition_2 || parsed?.answerIfB || '',
      };
    } else if ((question as any).answerIfA || (question as any).answerIfB) {
      conditionalAnswers = {
        answer_if_condition_1: (question as any).answerIfA || '',
        answer_if_condition_2: (question as any).answerIfB || '',
      };
    }
  } catch {
    conditionalAnswers = null;
  }

  // Parse invariants for L3
  let invariants: string[] = [];
  if (pearlLevel === 'L3') {
    try {
      if ((question as any).invariants) {
        const invArray = typeof (question as any).invariants === 'string'
          ? JSON.parse((question as any).invariants)
          : (question as any).invariants;
        invariants = Array.isArray(invArray) ? invArray : [];
      }
    } catch {
      invariants = [];
    }
  }

  const suggestedTrap = mapLegacyToTaxonomy(pearlLevel, question.trap_type);
  const prompt = buildTransformationPrompt(
    pearlLevel,
    question,
    variables,
    conditionalAnswers,
    invariants,
    suggestedTrap
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at migrating legacy causal reasoning cases to the T3Case schema. Your job is to PRESERVE the scenario (same situation, domain, story) while assigning the correct case attributes and label structure per the generation rules.

- Keep the scenario narrative largely unchanged. Only adjust wording if needed for variable labels (X), (Y), (Z) or clarity. Do NOT invent new facts or change the causal setup.
- Assign trap_type, label, variables, and other fields according to the level-specific taxonomy and generation rules provided.
- Return valid JSON only, using snake_case for all keys.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`No LLM response for question ${question.id}, using fallback transformation`);
      return getFallbackTransformation(pearlLevel, question, variables, conditionalAnswers, invariants);
    }

    let transformed: any;
    try {
      transformed = JSON.parse(content);
    } catch (parseError) {
      console.error(`Failed to parse LLM response for question ${question.id}:`, parseError);
      console.error(`LLM response content:`, content.substring(0, 500));
      return getFallbackTransformation(pearlLevel, question, variables, conditionalAnswers, invariants);
    }
    
    // Validate and ensure all mandatory fields are present
    try {
      return validateAndCompleteTransformation(pearlLevel, transformed, question, variables, conditionalAnswers, invariants);
    } catch (validationError) {
      console.error(`Error validating transformation for question ${question.id}:`, validationError);
      console.error(`Transformed data:`, JSON.stringify(transformed, null, 2).substring(0, 1000));
      return getFallbackTransformation(pearlLevel, question, variables, conditionalAnswers, invariants);
    }
  } catch (error) {
    console.error(`Error transforming fields for question ${question.id}:`, error);
    // Return fallback transformation on error
    return getFallbackTransformation(pearlLevel, question, variables, conditionalAnswers, invariants);
  }
}

function buildTransformationPrompt(
  pearlLevel: 'L1' | 'L2' | 'L3',
  question: any,
  variables: Record<string, any>,
  conditionalAnswers: any,
  invariants: string[],
  suggestedTrap: string | null
): string {
  const legacyLabel = question.ground_truth || 'NO';
  const label = pearlLevel === 'L1'
    ? (legacyLabel === 'VALID' ? 'YES' : legacyLabel === 'INVALID' ? 'NO' : 'AMBIGUOUS')
    : pearlLevel === 'L2'
    ? 'NO'
    : (legacyLabel === 'VALID' ? 'VALID' : legacyLabel === 'INVALID' ? 'INVALID' : 'CONDITIONAL');

  const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';

  const taxonomyBlock = buildTaxonomyBlock(pearlLevel, suggestedTrap, label, isAmbiguous);

  let prompt = `PRESERVE THE SCENARIO: Keep the same situation, domain, and narrative. Only adjust wording if needed for variable labels (X), (Y), (Z) or clarity. Do NOT invent new facts or change the causal setup.

Assign attributes (trap_type, label, variables, etc.) using the generation rules and taxonomy below.

LEGACY CASE DATA:
${JSON.stringify({
  scenario: question.scenario,
  claim: question.claim,
  ground_truth: question.ground_truth,
  explanation: question.explanation,
  trap_type: question.trap_type,
  trap_subtype: question.trap_subtype,
  wise_refusal: question.wise_refusal,
  causal_structure: question.causal_structure,
  hidden_timestamp: question.hidden_timestamp,
  conditional_answers: conditionalAnswers,
  variables: variables,
  invariants: invariants,
  domain: question.domain,
  subdomain: question.subdomain,
  difficulty: question.difficulty,
  key_insight: (question as any).key_insight,
  family: (question as any).family,
}, null, 2)}

${taxonomyBlock}

OUTPUT: Return a single JSON object (snake_case keys only, no markdown). Include all required fields for ${pearlLevel} as specified above.`;

  return prompt;
}

const L2_TAXONOMY_REFERENCE = L2_TRAP_TAXONOMY.map(
  (t) => `${t.code} ${t.name}: ${t.definition} Hidden Q: "${t.hiddenQuestionPattern}"`
).join('\n');

const L2_TRAP_CODES = new Set(L2_TRAP_TAXONOMY.map((t) => t.code));

function isValidL2TrapType(s: string | null | undefined): boolean {
  return typeof s === 'string' && L2_TRAP_CODES.has(s as any);
}

function ensureL3InvariantsNonEmpty(
  inv: string[],
  scenario?: string,
  counterfactual?: string
): string[] {
  const arr = Array.isArray(inv) ? inv.filter((x) => typeof x === 'string' && x.trim().length > 0) : [];
  if (arr.length > 0) return arr;
  return ['Mechanism and background conditions held fixed across counterfactual worlds.'];
}

function buildTaxonomyBlock(
  pearlLevel: 'L1' | 'L2' | 'L3',
  suggestedTrap: string | null,
  label: string,
  isAmbiguous: boolean
): string {
  if (pearlLevel === 'L1') {
    const l1Codes = 'W1–W10 (WOLF/NO), S1–S8 (SHEEP/YES), null for AMBIGUOUS';
    const l1Label = `label: YES | NO | AMBIGUOUS. WOLF→NO, SHEEP→YES, NONE→AMBIGUOUS. trap_type null only when AMBIGUOUS.`;
    const hint = suggestedTrap ? `Suggested trap_type from legacy "${suggestedTrap}" (use if it fits the scenario).` : '';
    return `L1 GENERATION RULES:
- trap_type: ${l1Codes}. Must be a valid L1 evidence code.
- ${l1Label}
- variables: X, Y, Z. Z must be an array ([] if empty).
- causal_structure: natural language, full sentences. No arrow notation only.
- gold_rationale: 50–100 words. wise_refusal: required.
- If AMBIGUOUS: hidden_timestamp (question revealing temporal/causal ordering) and conditional_answers { answer_if_condition_1, answer_if_condition_2 } are REQUIRED.
${hint}

Required JSON keys: scenario, claim, label, is_ambiguous, variables, trap_type, trap_subtype, difficulty, causal_structure, gold_rationale, wise_refusal, key_insight (optional), domain, subdomain. If AMBIGUOUS add hidden_timestamp, conditional_answers.`;
  }

  if (pearlLevel === 'L2') {
    const hint = suggestedTrap ? `Legacy suggested: "${suggestedTrap}". Use it ONLY if it best matches the scenario; otherwise pick the single best-matching T below.` : '';
    return `L2 GENERATION RULES:
- trap_type: MUST be exactly one of T1–T17. Choose the type that BEST matches the scenario using the reference below.
- label: always "NO". is_ambiguous: always true.
- variables: X, Y, Z. Z is REQUIRED and must be a non-empty array (the ambiguous third variable).
- hidden_timestamp: REQUIRED. A **scenario-specific** pivotal question that would resolve the ambiguity. It must target the same *type* of ambiguity as your chosen trap's conceptual pattern but **must reference the scenario's concrete X, Y, Z, domain, or narrative**. Do NOT use the taxonomy's generic "Hidden Q" pattern verbatim; write a distinct, high-quality question tailored to the case.
- conditional_answers: REQUIRED. { answer_if_condition_1, answer_if_condition_2 }. Mutually exclusive and exhaustive. One branch may support the claim, the other refute it; we refuse because we lack hidden info.
- wise_refusal: 4-part template—(1) identify ambiguity, (2) state missing info, (3) both conditional interpretations, (4) decline to endorse.
- causal_structure: natural language. May include arrows (→, ←, ↔).
${hint}

L2 TRAP TAXONOMY (pick the single best match for this case):
${L2_TAXONOMY_REFERENCE}

Required JSON keys: scenario, claim, label, is_ambiguous, variables, trap_type, trap_subtype, difficulty, causal_structure, gold_rationale, wise_refusal, hidden_timestamp, conditional_answers, domain, subdomain.`;
  }

  const l3Codes = 'F1–F8 (F1=Deterministic, F2=Probabilistic, F3=Overdetermination, F4=Structural, F5=Temporal, F6=Epistemic, F7=Attribution, F8=Moral/Legal)';
  const hint = suggestedTrap ? `Suggested trap_type (family) from legacy: "${suggestedTrap}".` : '';
  return `L3 GENERATION RULES:
- trap_type: ${l3Codes}. Must be a valid F1–F8 family code.
- label: VALID | INVALID | CONDITIONAL. Match legacy ground_truth (VALID/INVALID/CONDITIONAL).
- counterfactual_claim: "If [X had been different], then [Y]." format.
- variables: X, Y, Z. Z must be an array ([] if empty).
- invariants: REQUIRED, NON-EMPTY array of strings. NEVER return []. Each invariant must be **scenario-specific and unique**: reference concrete X, Y, Z, domain, actors, mechanisms, or narrative details from THIS case. Do NOT use generic templates (e.g. "Mechanism and causal rules unchanged.", "Background risk and population fixed.", "Other causes remain active."). Good examples: "Boarding rules and gate-closure policy unchanged; flight still departs at 10:00." or "Not specified: whether the agent holds or sells during volatility." (tied to scenario). If legacy provides invariants, preserve and refine them to be scenario-specific; avoid repetition across cases.
- If CONDITIONAL: hidden_timestamp and conditional_answers required; show how different invariant completions lead to different labels.
- causal_structure: natural language. gold_rationale, wise_refusal: required.
${hint}

Required JSON keys: scenario, counterfactual_claim, label, is_ambiguous, variables, trap_type, trap_subtype, difficulty, causal_structure, gold_rationale, wise_refusal, invariants, domain, subdomain. If CONDITIONAL add hidden_timestamp, conditional_answers.`;
}

function validateAndCompleteTransformation(
  pearlLevel: 'L1' | 'L2' | 'L3',
  transformed: any,
  question: any,
  variables: Record<string, any>,
  conditionalAnswers: any,
  invariants: string[]
): any {
  const trapType = transformed.trap?.type ?? transformed.trap_type;
  const trapSubtype = transformed.trap?.subtype ?? transformed.trap_subtype;
  const defaultTrap = mapLegacyToTaxonomy(pearlLevel, question.trap_type)
    ?? (pearlLevel === 'L3' ? 'F1' : pearlLevel === 'L2' ? 'T1' : 'A');

  const defaultLabel = pearlLevel === 'L1'
    ? (question.ground_truth === 'VALID' ? 'YES' : question.ground_truth === 'INVALID' ? 'NO' : 'AMBIGUOUS')
    : pearlLevel === 'L2'
    ? 'NO'
    : (question.ground_truth === 'VALID' ? 'VALID' : question.ground_truth === 'INVALID' ? 'INVALID' : 'CONDITIONAL');

  let finalTrapType = trapType ?? defaultTrap;
  if (pearlLevel === 'L2' && !isValidL2TrapType(finalTrapType)) {
    finalTrapType = defaultTrap as string;
    if (!isValidL2TrapType(finalTrapType)) finalTrapType = 'T1';
  }

  const result: any = {
    scenario: transformed.scenario ?? question.scenario ?? '',
    label: transformed.label ?? defaultLabel,
    is_ambiguous: transformed.is_ambiguous !== undefined
      ? transformed.is_ambiguous
      : (transformed.label === 'AMBIGUOUS' || transformed.label === 'CONDITIONAL'),
    variables: transformed.variables ?? variables,
    trap_type: finalTrapType,
    trap_subtype: trapSubtype ?? question.trap_subtype ?? null,
    difficulty: normalizeDifficulty(transformed.difficulty ?? question.difficulty ?? 'medium'),
    causal_structure: transformed.causal_structure ?? question.causal_structure ?? null,
    key_insight: transformed.key_insight ?? (question as any).key_insight ?? null,
    domain: transformed.domain ?? question.domain ?? null,
    subdomain: transformed.subdomain ?? question.subdomain ?? null,
  };

  if (!Array.isArray(result.variables.Z)) {
    result.variables.Z = result.variables.Z ? [result.variables.Z] : [];
  }

  if (pearlLevel === 'L1') {
    result.claim = transformed.claim ?? question.claim ?? null;
    result.gold_rationale = transformed.gold_rationale ?? question.explanation ?? null;
    result.wise_refusal = transformed.wise_refusal ?? question.wise_refusal ?? null;
    if (result.is_ambiguous) {
      result.hidden_timestamp = transformed.hidden_timestamp ?? question.hidden_timestamp ?? null;
      result.conditional_answers = formatConditionalAnswers(
        transformed.conditional_answers,
        conditionalAnswers
      );
    } else {
      result.hidden_timestamp = null;
      result.conditional_answers = null;
    }
  } else if (pearlLevel === 'L2') {
    result.claim = transformed.claim ?? question.claim ?? null;
    result.gold_rationale = transformed.gold_rationale ?? question.explanation ?? null;
    result.wise_refusal = transformed.wise_refusal ?? question.wise_refusal ?? null;
    result.hidden_timestamp = transformed.hidden_timestamp ?? question.hidden_timestamp ?? null;
    result.conditional_answers = formatConditionalAnswers(
      transformed.conditional_answers,
      conditionalAnswers
    );
  } else {
    result.counterfactual_claim = transformed.counterfactual_claim ?? question.claim ?? null;
    result.gold_rationale = transformed.gold_rationale ?? question.explanation ?? null;
    result.wise_refusal = transformed.wise_refusal ?? question.wise_refusal ?? null;
    const rawInv = Array.isArray(transformed.invariants) ? transformed.invariants : invariants;
    result.invariants = ensureL3InvariantsNonEmpty(
      rawInv,
      result.scenario,
      result.counterfactual_claim
    );
    if (result.is_ambiguous) {
      result.hidden_timestamp = transformed.hidden_timestamp ?? question.hidden_timestamp ?? null;
      result.conditional_answers = formatConditionalAnswers(
        transformed.conditional_answers,
        conditionalAnswers
      );
    } else {
      result.hidden_timestamp = null;
      result.conditional_answers = null;
    }
  }

  return result;
}

function normalizeDifficulty(d: string): string {
  const s = (d ?? 'medium').toString().toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'hard') return 'Hard';
  return 'Medium';
}

function formatConditionalAnswers(
  fromTransformed: any,
  fromLegacy: any
): string | null {
  const toPayload = (o: any) => ({
    answer_if_condition_1: o?.answer_if_condition_1 ?? o?.answerIfA ?? '',
    answer_if_condition_2: o?.answer_if_condition_2 ?? o?.answerIfB ?? '',
  });

  if (fromTransformed) {
    const obj = typeof fromTransformed === 'string'
      ? (() => { try { return JSON.parse(fromTransformed); } catch { return null; } })()
      : fromTransformed;
    if (obj && (obj.answer_if_condition_1 != null || obj.answer_if_condition_2 != null || obj.answerIfA != null || obj.answerIfB != null)) {
      return JSON.stringify(toPayload(obj));
    }
  }
  if (fromLegacy) {
    const obj = typeof fromLegacy === 'string'
      ? (() => { try { return JSON.parse(fromLegacy); } catch { return null; } })()
      : fromLegacy;
    if (obj && typeof obj === 'object') {
      return JSON.stringify(toPayload(obj));
    }
    return typeof fromLegacy === 'string' ? fromLegacy : null;
  }
  return null;
}

function getFallbackTransformation(
  pearlLevel: 'L1' | 'L2' | 'L3',
  question: any,
  variables: Record<string, any>,
  conditionalAnswers: any,
  invariants: string[]
): any {
  const label = pearlLevel === 'L1'
    ? (question.ground_truth === 'VALID' ? 'YES' : question.ground_truth === 'INVALID' ? 'NO' : 'AMBIGUOUS')
    : pearlLevel === 'L2'
    ? 'NO'
    : (question.ground_truth === 'VALID' ? 'VALID' : question.ground_truth === 'INVALID' ? 'INVALID' : 'CONDITIONAL');

  const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';
  const trapType = mapLegacyToTaxonomy(pearlLevel, question.trap_type)
    ?? (pearlLevel === 'L3' ? 'F1' : pearlLevel === 'L2' ? 'T1' : 'A');

  const result: any = {
    scenario: question.scenario ?? '',
    label,
    is_ambiguous: isAmbiguous,
    variables: variables,
    trap_type: trapType,
    trap_subtype: question.trap_subtype ?? null,
    difficulty: normalizeDifficulty(question.difficulty ?? 'medium'),
    causal_structure: question.causal_structure ?? null,
    key_insight: (question as any).key_insight ?? null,
    domain: question.domain ?? null,
    subdomain: question.subdomain ?? null,
  };

  if (pearlLevel === 'L1') {
    result.claim = question.claim ?? null;
    result.gold_rationale = question.explanation ?? null;
    result.wise_refusal = question.wise_refusal ?? null;
    if (isAmbiguous) {
      result.hidden_timestamp = question.hidden_timestamp ?? null;
      result.conditional_answers = formatConditionalAnswers(null, conditionalAnswers);
    } else {
      result.hidden_timestamp = null;
      result.conditional_answers = null;
    }
  } else if (pearlLevel === 'L2') {
    result.claim = question.claim ?? null;
    result.gold_rationale = question.explanation ?? null;
    result.wise_refusal = question.wise_refusal ?? null;
    result.hidden_timestamp = question.hidden_timestamp ?? null;
    result.conditional_answers = formatConditionalAnswers(null, conditionalAnswers);
  } else {
    result.counterfactual_claim = question.claim ?? null;
    result.gold_rationale = question.explanation ?? null;
    result.wise_refusal = question.wise_refusal ?? null;
    result.invariants = ensureL3InvariantsNonEmpty(
      Array.isArray(invariants) ? invariants : [],
      result.scenario,
      result.counterfactual_claim
    );
    if (isAmbiguous) {
      result.hidden_timestamp = question.hidden_timestamp ?? null;
      result.conditional_answers = formatConditionalAnswers(null, conditionalAnswers);
    } else {
      result.hidden_timestamp = null;
      result.conditional_answers = null;
    }
  }

  return result;
}

async function streamCopyProgress(
  questions: any[],
  finalTargetDataset: string
): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const total = questions.length;
        const byType = { L1: 0, L2: 0, L3: 0 };
        const newCaseIds: string[] = [];
        const errors: string[] = [];
        const skipReasons: { invalidPearlLevel: number } = {
          invalidPearlLevel: 0,
        };
        let processed = 0;
        let skipped = 0;

        sendProgress({
          type: 'start',
          total,
          targetDataset: finalTargetDataset,
        });

        // Copy each question to the appropriate case table
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          try {
            const pearlLevel = question.pearl_level;
            if (!pearlLevel || !['L1', 'L2', 'L3'].includes(pearlLevel)) {
              skipped++;
              skipReasons.invalidPearlLevel++;
              processed++;
              sendProgress({
                type: 'progress',
                processed: processed + 1,
                total,
                current: i + 1,
                skipped,
                skipReasons,
                byType,
                status: `Skipped ${question.id} (invalid pearl level: ${pearlLevel || 'null'})`,
              });
              continue;
            }

            // Note: We don't skip cases that already exist - approved cases should be copied
            // even if they exist in the target dataset (they may have been updated/improved)

            sendProgress({
              type: 'progress',
              processed,
              total,
              current: i + 1,
              skipped,
              byType,
              status: `Processing ${question.id} (${pearlLevel})...`,
            });

            // Use LLM to validate and transform ALL fields to ensure correct format
            const transformedData = await transformAndValidateAllFields(pearlLevel, question);

            // Build the T3Case data with LLM-transformed fields
            const t3CaseData: any = {
              pearl_level: pearlLevel,
              scenario: transformedData.scenario,
              label: transformedData.label,
              is_ambiguous: transformedData.is_ambiguous,
              variables: JSON.stringify(transformedData.variables),
              trap_type: transformedData.trap_type,
              trap_subtype: transformedData.trap_subtype || null,
              trap_type_name: pearlLevel === 'L2' && transformedData.trap_type
                ? (getL2TrapByCode(transformedData.trap_type as any)?.name ?? null)
                : null,
              difficulty: transformedData.difficulty,
              causal_structure: transformedData.causal_structure || null,
              key_insight: transformedData.key_insight || null,
              hidden_timestamp: transformedData.hidden_timestamp || null,
              conditional_answers: transformedData.conditional_answers 
                ? (typeof transformedData.conditional_answers === 'string' 
                    ? transformedData.conditional_answers 
                    : JSON.stringify(transformedData.conditional_answers))
                : null,
              wise_refusal: transformedData.wise_refusal || null,
              gold_rationale: transformedData.gold_rationale || null,
              domain: transformedData.domain || null,
              subdomain: transformedData.subdomain || null,
              dataset: finalTargetDataset,
              author: question.author || 'Legacy Migration',
              source_case: question.source_case || null,
              is_verified: false, // New T3 cases not yet T3-evaluated; keep unverified for "Unverified only" evaluations
            };

            // Level-specific fields
            if (pearlLevel === 'L1' || pearlLevel === 'L2') {
              t3CaseData.claim = transformedData.claim || null;
            } else if (pearlLevel === 'L3') {
              t3CaseData.counterfactual_claim = transformedData.counterfactual_claim || null;
              // Convert invariants array to JSON string (or null if empty/missing)
              if (transformedData.invariants !== undefined && transformedData.invariants !== null) {
                const invArray = Array.isArray(transformedData.invariants) 
                  ? transformedData.invariants 
                  : (typeof transformedData.invariants === 'string' 
                      ? (() => {
                          try {
                            const parsed = JSON.parse(transformedData.invariants);
                            return Array.isArray(parsed) ? parsed : [];
                          } catch {
                            return [];
                          }
                        })()
                      : []);
                t3CaseData.invariants = invArray.length > 0 ? JSON.stringify(invArray) : null;
              } else {
                t3CaseData.invariants = null;
              }
            }

            const newCase = await prisma.t3Case.create({
              data: t3CaseData,
            });

            if (pearlLevel === 'L1') byType.L1++;
            else if (pearlLevel === 'L2') byType.L2++;
            else if (pearlLevel === 'L3') byType.L3++;

            newCaseIds.push(newCase.id);
            processed++;

            sendProgress({
              type: 'progress',
              processed,
              total,
              current: i + 1,
              skipped,
              byType,
              status: `Copied ${question.id} (${pearlLevel})`,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Question ${question.id}: ${errorMsg}`);
            processed++;
            sendProgress({
              type: 'progress',
              processed,
              total,
              current: i + 1,
              skipped,
              byType,
              errors: errors.length,
              status: `Error copying ${question.id}: ${errorMsg}`,
            });
            console.error(`Error copying question ${question.id}:`, error);
          }
        }

        sendProgress({
          type: 'complete',
          copiedCount: newCaseIds.length,
          skippedCount: skipped,
          skipReasons,
          byType,
          targetDataset: finalTargetDataset,
          errors: errors.slice(0, 10),
          message: `Successfully copied ${newCaseIds.length} approved legacy cases to new schema in dataset "${finalTargetDataset}"${skipped > 0 ? ` (${skipped} skipped: ${skipReasons.invalidPearlLevel} invalid pearl level)` : ''}${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
        });

        controller.close();
      } catch (error) {
        sendProgress({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function checkIfAlreadyCopied(
  pearlLevel: string,
  sourceCase: string | null,
  dataset: string
): Promise<boolean> {
  if (!sourceCase) return false; // Can't check without sourceCase

  const existing = await prisma.t3Case.findFirst({
    where: {
      source_case: sourceCase,
      dataset,
      pearl_level: pearlLevel,
    },
  });
  return !!existing;
}
