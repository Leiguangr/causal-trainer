import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type PearlLevel = 'L1' | 'L2' | 'L3';

type ExportItem = {
  scenario?: unknown;
  variables?: unknown;
  annotations?: {
    caseId?: unknown;
    pearlLevel?: unknown;
    domain?: unknown;
    subdomain?: unknown;
    trapType?: unknown;
    trapSubtype?: unknown;
    difficulty?: unknown;
    causalStructure?: unknown;
    keyInsight?: unknown;
    author?: unknown;
    family?: unknown;
  };
  // Legacy-ish fields
  groundTruth?: unknown;
  hiddenTimestamp?: unknown;
  conditionalAnswers?: unknown;
  wiseRefusal?: unknown;
  explanation?: unknown;

  // T3 L2 fields
  hiddenQuestion?: unknown;
  answerIfA?: unknown;
  answerIfB?: unknown;

  // T3 L3 fields
  counterfactualClaim?: unknown;
  invariants?: unknown;
  justification?: unknown;
  wiseResponse?: unknown;
};

function asString(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

function normalizeJsonString(x: unknown): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function parseCombinedScenario(combinedScenario: string): { scenario: string; claim: string } {
  const marker = '\n\nClaim: "';
  const idx = combinedScenario.lastIndexOf(marker);
  if (idx === -1) return { scenario: combinedScenario, claim: '' };
  const scenario = combinedScenario.slice(0, idx);
  const after = combinedScenario.slice(idx + marker.length);
  const endQuote = after.lastIndexOf('"');
  const claim = endQuote >= 0 ? after.slice(0, endQuote) : after;
  return { scenario, claim };
}

function getPearlLevel(item: ExportItem): PearlLevel | null {
  const level = asString(item.annotations?.pearlLevel);
  if (level === 'L1' || level === 'L2' || level === 'L3') return level;
  return null;
}

function isT3L2(item: ExportItem): boolean {
  return (
    typeof item.hiddenQuestion === 'string' &&
    typeof item.answerIfA === 'string' &&
    typeof item.answerIfB === 'string' &&
    typeof item.wiseRefusal === 'string'
  );
}

function isT3L3(item: ExportItem): boolean {
  return (
    typeof item.counterfactualClaim === 'string' &&
    item.invariants != null &&
    typeof item.justification === 'string' &&
    typeof item.wiseResponse === 'string'
  );
}

function isT3L1(item: ExportItem): boolean {
  // Export maps L1Case.evidenceClass -> annotations.trapType and evidenceType -> annotations.trapSubtype
  const trapType = asString(item.annotations?.trapType);
  return trapType === 'WOLF' || trapType === 'SHEEP' || trapType === 'NONE';
}

async function upsertQuestionByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    claim: string;
    pearl_level: string;
    domain: string;
    subdomain: string | null;
    trap_type: string;
    trap_subtype: string;
    explanation: string;
    difficulty: string;
    ground_truth: string;
    variables: string | null;
    causal_structure: string | null;
    key_insight: string | null;
    wise_refusal: string | null;
    hidden_timestamp: string | null;
    conditional_answers: string | null;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  return prisma.question.create({
    data: { ...data, dataset, source_case: sourceCase || null, is_llm_generated: false },
  });
}

async function upsertL1ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    claim: string;
    groundTruth: string;
    evidenceClass: string;
    evidenceType: string | null;
    whyFlawedOrValid: string;
    domain: string | null;
    subdomain: string | null;
    difficulty: string;
    variables: string | null;
    causalStructure: string | null;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  return prisma.t3Case.create({
    data: {
      pearl_level: 'L1',
      scenario: data.scenario,
      claim: data.claim,
      label: data.groundTruth, // L1: groundTruth -> label (YES/NO/AMBIGUOUS)
      is_ambiguous: data.groundTruth === 'AMBIGUOUS',
      trap_type: data.evidenceClass, // evidenceClass -> trap_type
      trap_subtype: data.evidenceType || null,
      gold_rationale: data.whyFlawedOrValid, // whyFlawedOrValid -> gold_rationale
      domain: data.domain,
      subdomain: data.subdomain,
      difficulty: data.difficulty,
      variables: data.variables,
      causal_structure: data.causalStructure,
      author: data.author,
      dataset,
      source_case: sourceCase || null,
    },
  });
}

async function upsertL2ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    variables: string | null;
    trapType: string;
    difficulty: string;
    causalStructure: string | null;
    hiddenQuestion: string;
    answerIfA: string;
    answerIfB: string;
    wiseRefusal: string;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  // L2 cases may have claim embedded in scenario, or scenario itself serves as context
  // Try to extract claim if present, otherwise use null (claim is optional for L2 in some cases)
  const { scenario: scenarioOnly, claim } = parseCombinedScenario(data.scenario);
  
  // Combine conditional answers into JSON
  const conditionalAnswers = JSON.stringify({
    A: data.answerIfA,
    B: data.answerIfB,
  });

  return prisma.t3Case.create({
    data: {
      pearl_level: 'L2',
      scenario: scenarioOnly,
      claim: claim || null, // Claim is optional for L2
      label: 'NO', // L2 cases are always NO
      is_ambiguous: true, // L2 cases are ambiguous by nature
      trap_type: data.trapType,
      difficulty: data.difficulty,
      causal_structure: data.causalStructure,
      hidden_timestamp: data.hiddenQuestion, // hiddenQuestion -> hidden_timestamp
      conditional_answers: conditionalAnswers, // answerIfA/answerIfB -> conditional_answers
      wise_refusal: data.wiseRefusal,
      variables: data.variables,
      author: data.author,
      dataset,
      source_case: sourceCase || null,
    },
  });
}

async function upsertL3ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    caseId: string | null;
    domain: string | null;
    family: string;
    difficulty: string;
    scenario: string;
    counterfactualClaim: string;
    variables: string;
    invariants: string;
    groundTruth: string;
    justification: string;
    wiseResponse: string;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  return prisma.t3Case.create({
    data: {
      pearl_level: 'L3',
      case_id: data.caseId,
      domain: data.domain,
      scenario: data.scenario,
      counterfactual_claim: data.counterfactualClaim,
      label: data.groundTruth, // L3: groundTruth -> label (VALID/INVALID/CONDITIONAL)
      is_ambiguous: data.groundTruth === 'CONDITIONAL',
      trap_type: data.family, // family -> trap_type (F1-F8)
      invariants: data.invariants, // Already JSON string
      variables: data.variables,
      gold_rationale: data.justification, // justification -> gold_rationale
      wise_refusal: data.wiseResponse, // wiseResponse -> wise_refusal
      difficulty: data.difficulty,
      author: data.author,
      dataset,
      source_case: sourceCase || null,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Check if T3Case model is available (migrations may not be applied)
    if (!prisma.t3Case) {
      return NextResponse.json(
        { 
          error: 'T3Case model is not available. Please run: npx prisma generate',
          hint: 'If the table does not exist, run: npx prisma migrate deploy'
        },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    const dataset = (form.get('dataset') as string | null) || 'default';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Handle files saved as UTF-8, UTF-8-BOM, or UTF-16 (common on Windows).
    const buf = Buffer.from(await file.arrayBuffer());
    const b0 = buf[0];
    const b1 = buf[1];

    let rawText: string;
    if (b0 === 0xff && b1 === 0xfe) {
      // UTF-16 LE BOM
      rawText = new TextDecoder('utf-16le').decode(buf);
    } else if (b0 === 0xfe && b1 === 0xff) {
      // UTF-16 BE BOM
      rawText = new TextDecoder('utf-16be').decode(buf);
    } else {
      // Default: assume UTF-8 (with or without BOM)
      rawText = new TextDecoder('utf-8').decode(buf);
    }

    const cleaned = rawText.replace(/^\uFEFF/, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      return NextResponse.json({ error: `Invalid JSON file: ${msg}` }, { status: 400 });
    }

    // Accept either the raw export array, or a wrapper object with `questions: []`
    const items: unknown =
      Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && 'questions' in (parsed as any) ? (parsed as any).questions : null);

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Expected JSON array (export) or object with { questions: [...] }' },
        { status: 400 }
      );
    }

    const errors: Array<{ index: number; error: string }> = [];
    let imported = { question: 0, l1: 0, l2: 0, l3: 0 };

    // Process sequentially to keep sqlite happy and make failures attributable
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as ExportItem;

      const level = getPearlLevel(item);
      const scenarioCombined = asString(item.scenario);
      if (!level || !scenarioCombined) {
        errors.push({ index: i, error: 'Missing scenario or annotations.pearlLevel' });
        continue;
      }

      const { scenario, claim } = parseCombinedScenario(scenarioCombined);
      const annotations = item.annotations || {};

      const sourceCase = asString(annotations.caseId) || null;
      const author = asString(annotations.author) || null;
      const difficulty = asString(annotations.difficulty) || 'medium';
      const variablesStr = normalizeJsonString(item.variables);

      // Route into T3 tables when the item matches a T3 export shape; otherwise fall back to legacy Question.
      if (level === 'L1' && isT3L1(item)) {
        const groundTruth = asString(item.groundTruth) || 'NO';
        const evidenceClass = asString(annotations.trapType) || 'NONE';
        const evidenceTypeRaw = asString(annotations.trapSubtype);
        const evidenceType = evidenceTypeRaw && evidenceTypeRaw !== 'NONE' ? evidenceTypeRaw : null;
        const whyFlawedOrValid = asString(item.explanation);
        if (!whyFlawedOrValid) {
          errors.push({ index: i, error: 'L1 (T3) missing explanation' });
          continue;
        }
        try {
          await upsertL1ByDatasetSourceCase({
            dataset,
            sourceCase,
            data: {
              scenario,
              claim,
              groundTruth,
              evidenceClass,
              evidenceType,
              whyFlawedOrValid,
              domain: asString(annotations.domain) || null,
              subdomain: asString(annotations.subdomain) || null,
              difficulty,
              variables: variablesStr,
              causalStructure: asString(annotations.causalStructure) || null,
              author,
            },
          });
          imported.l1++;
        } catch (error: any) {
          if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
            errors.push({ index: i, error: 'T3Case table does not exist. Run migrations: npx prisma migrate deploy' });
          } else {
            errors.push({ index: i, error: error?.message || 'Failed to import L1 case' });
          }
        }
        continue;
      }

      if (level === 'L2' && isT3L2(item)) {
        try {
          await upsertL2ByDatasetSourceCase({
            dataset,
            sourceCase,
            data: {
              scenario,
              variables: variablesStr,
              trapType: asString(annotations.trapType) || 'T1',
              difficulty,
              causalStructure: asString(annotations.causalStructure) || null,
              hiddenQuestion: item.hiddenQuestion as string,
              answerIfA: item.answerIfA as string,
              answerIfB: item.answerIfB as string,
              wiseRefusal: item.wiseRefusal as string,
              author,
            },
          });
          imported.l2++;
        } catch (error: any) {
          if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
            errors.push({ index: i, error: 'T3Case table does not exist. Run migrations: npx prisma migrate deploy' });
          } else {
            errors.push({ index: i, error: error?.message || 'Failed to import L2 case' });
          }
        }
        continue;
      }

      if (level === 'L3' && isT3L3(item)) {
        const family = asString(annotations.family);
        const groundTruth = asString(item.groundTruth);
        const invariantsStr = normalizeJsonString(item.invariants);
        if (!family) {
          errors.push({ index: i, error: 'L3 (T3) missing annotations.family' });
          continue;
        }
        if (!groundTruth) {
          errors.push({ index: i, error: 'L3 (T3) missing groundTruth' });
          continue;
        }
        if (!invariantsStr) {
          errors.push({ index: i, error: 'L3 (T3) missing invariants' });
          continue;
        }
        const variablesRequired = normalizeJsonString(item.variables);
        if (!variablesRequired) {
          errors.push({ index: i, error: 'L3 (T3) missing variables' });
          continue;
        }
        try {
          await upsertL3ByDatasetSourceCase({
            dataset,
            sourceCase,
            data: {
              caseId: asString(annotations.caseId) || null,
              domain: asString(annotations.domain) || null,
              family,
              difficulty,
              scenario,
              counterfactualClaim: item.counterfactualClaim as string,
              variables: variablesRequired,
              invariants: invariantsStr,
              groundTruth,
              justification: item.justification as string,
              wiseResponse: item.wiseResponse as string,
              author,
            },
          });
          imported.l3++;
        } catch (error: any) {
          if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
            errors.push({ index: i, error: 'T3Case table does not exist. Run migrations: npx prisma migrate deploy' });
          } else {
            errors.push({ index: i, error: error?.message || 'Failed to import L3 case' });
          }
        }
        continue;
      }

      // Legacy Question fallback
      const domain = asString(annotations.domain) || 'Unknown';
      const subdomain = asString(annotations.subdomain) || null;
      const trapType = asString(annotations.trapType) || 'UNKNOWN';
      const trapSubtype = asString(annotations.trapSubtype) || 'UNKNOWN';
      const explanation = asString(item.explanation) || '';
      const groundTruth = asString(item.groundTruth) || 'NO';

      await upsertQuestionByDatasetSourceCase({
        dataset,
        sourceCase,
        data: {
          scenario,
          claim,
          pearl_level: level,
          domain,
          subdomain,
          trap_type: trapType,
          trap_subtype: trapSubtype,
          explanation,
          difficulty,
          ground_truth: groundTruth,
          variables: variablesStr,
          causal_structure: asString(annotations.causalStructure) || null,
          key_insight: asString(annotations.keyInsight) || null,
          wise_refusal: asString(item.wiseRefusal) || null,
          hidden_timestamp: asString(item.hiddenTimestamp) || null,
          conditional_answers: normalizeJsonString(item.conditionalAnswers),
          author,
        },
      });
      imported.question++;
    }

    return NextResponse.json({
      success: true,
      dataset,
      imported,
      total: items.length,
      errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import dataset' },
      { status: 500 }
    );
  }
}

