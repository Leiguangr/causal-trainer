import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

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
          is_verified: question.is_verified || false,
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

  // Build prompt for LLM to transform and validate ALL fields
  const prompt = buildTransformationPrompt(pearlLevel, question, variables, conditionalAnswers, invariants);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at transforming legacy causal reasoning cases to the unified T3Case schema. Given a legacy case, transform and validate ALL fields to ensure they match the ${pearlLevel} schema requirements exactly. Return a complete JSON object with all required and optional fields properly formatted.`,
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
  invariants: string[]
): string {
  // Map legacy ground_truth to T3Case label
  const legacyLabel = question.ground_truth || 'NO';
  const label = pearlLevel === 'L1'
    ? (legacyLabel === 'VALID' ? 'YES' : legacyLabel === 'INVALID' ? 'NO' : 'AMBIGUOUS')
    : pearlLevel === 'L2'
    ? 'NO' // All L2 cases are NO
    : (legacyLabel === 'VALID' ? 'VALID' : legacyLabel === 'INVALID' ? 'INVALID' : 'CONDITIONAL');

  const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';

  let prompt = `Transform this legacy ${pearlLevel} causal reasoning case to the unified T3Case schema. Validate and format ALL fields to ensure they match the schema requirements exactly.

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

REQUIRED OUTPUT FORMAT (${pearlLevel}):
`;

  if (pearlLevel === 'L1') {
    prompt += `{
  "scenario": "string (1-3 sentences describing the situation)",
  "claim": "string (required - the causal claim being evaluated)",
  "label": "${label} (must be YES, NO, or AMBIGUOUS)",
  "is_ambiguous": ${isAmbiguous},
  "variables": {
    "X": "string or object (cause variable)",
    "Y": "string or object (effect variable)",
    "Z": ["string"] (array of confounders/mediators, always an array)
  },
  "trap_type": "string (W1-W10, S1-S8, or A for AMBIGUOUS - infer from scenario if missing)",
  "trap_subtype": "string or null",
  "difficulty": "easy|medium|hard",
  "causal_structure": "string (natural language, full sentences, NOT mathematical notation)",
  "gold_rationale": "string (50-100 words explaining why claim is ${label})",
  "key_insight": "string or null (one-line takeaway)",
  "domain": "string or null",
  "subdomain": "string or null"
}`;
  } else if (pearlLevel === 'L2') {
    prompt += `{
  "scenario": "string (1-3 sentences describing the situation)",
  "claim": "string (required - the causal claim being evaluated)",
  "label": "NO (always NO for L2)",
  "is_ambiguous": ${isAmbiguous},
  "variables": {
    "X": "string or object",
    "Y": "string or object",
    "Z": ["string"] (always an array)
  },
  "trap_type": "string (T1-T17 - infer from scenario if missing)",
  "trap_subtype": "string or null",
  "difficulty": "easy|medium|hard",
  "causal_structure": "string or null (natural language)",
  "hidden_timestamp": "${isAmbiguous ? 'string (required if ambiguous - question revealing temporal/causal ordering)' : 'null'}",
  "conditional_answers": ${isAmbiguous ? `{
    "answer_if_condition_1": "string",
    "answer_if_condition_2": "string"
  }` : 'null'} (required if ambiguous),
  "wise_refusal": "string (required - starts with 'NO - the claim is invalid.' followed by reasoning)",
  "domain": "string or null",
  "subdomain": "string or null"
}`;
  } else if (pearlLevel === 'L3') {
    prompt += `{
  "scenario": "string (1-3 sentences describing the situation)",
  "counterfactual_claim": "string (required - format: 'If [X had been different], then [Y].')",
  "label": "${label} (must be VALID, INVALID, or CONDITIONAL)",
  "is_ambiguous": ${isAmbiguous},
  "variables": {
    "X": "string or object",
    "Y": "string or object",
    "Z": ["string"] (always an array)
  },
  "trap_type": "string (F1-F8 family type - infer from scenario if missing)",
  "trap_subtype": "string or null",
  "difficulty": "easy|medium|hard",
  "causal_structure": "string or null (natural language)",
  "gold_rationale": "string (50-100 words explaining why counterfactual is ${label})",
  "wise_refusal": "string (response identifying missing information or biases)",
  "invariants": ["string"] (REQUIRED: array of invariant strings describing what remains constant - return empty array [] if none, never null),
  "domain": "string or null",
  "subdomain": "string or null"
}`;
  }

  prompt += `

TASK:
1. Transform ALL fields from legacy format to T3Case schema format
2. Ensure trap_type is in correct format (W1-W10/S1-S8/A for L1, T1-T17 for L2, F1-F8 for L3)
3. Ensure variables.Z is always an array (even if empty: [])
4. For L3: invariants must be an array of strings (return [] if empty, never null)
5. Generate missing required fields if needed
6. Validate and correct format of all fields
7. Ensure causal_structure uses natural language (full sentences), NOT mathematical notation
8. Return the complete transformed case as JSON with all fields properly formatted`;

  return prompt;
}

function validateAndCompleteTransformation(
  pearlLevel: 'L1' | 'L2' | 'L3',
  transformed: any,
  question: any,
  variables: Record<string, any>,
  conditionalAnswers: any,
  invariants: string[]
): any {
  // Ensure all mandatory fields are present
  const result: any = {
    scenario: transformed.scenario || question.scenario || '',
    label: transformed.label || (pearlLevel === 'L1' 
      ? (question.ground_truth === 'VALID' ? 'YES' : question.ground_truth === 'INVALID' ? 'NO' : 'AMBIGUOUS')
      : pearlLevel === 'L2' 
      ? 'NO' 
      : (question.ground_truth === 'VALID' ? 'VALID' : question.ground_truth === 'INVALID' ? 'INVALID' : 'CONDITIONAL')),
    is_ambiguous: transformed.is_ambiguous !== undefined ? transformed.is_ambiguous : (transformed.label === 'AMBIGUOUS' || transformed.label === 'CONDITIONAL'),
    variables: transformed.variables || variables,
    trap_type: transformed.trap_type || question.trap_type || (pearlLevel === 'L3' ? 'F1' : pearlLevel === 'L2' ? 'T1' : 'A'),
    trap_subtype: transformed.trap_subtype || question.trap_subtype || null,
    difficulty: transformed.difficulty || question.difficulty || 'medium',
    causal_structure: transformed.causal_structure || question.causal_structure || null,
    key_insight: transformed.key_insight || (question as any).key_insight || null,
    domain: transformed.domain || question.domain || null,
    subdomain: transformed.subdomain || question.subdomain || null,
  };

  // Ensure variables.Z is an array
  if (!Array.isArray(result.variables.Z)) {
    result.variables.Z = result.variables.Z ? [result.variables.Z] : [];
  }

  // Level-specific fields
  if (pearlLevel === 'L1' || pearlLevel === 'L2') {
    result.claim = transformed.claim || question.claim || null;
    result.gold_rationale = transformed.gold_rationale || question.explanation || null;
    result.wise_refusal = transformed.wise_refusal || question.wise_refusal || null;
  } else if (pearlLevel === 'L2') {
    result.hidden_timestamp = transformed.hidden_timestamp || question.hidden_timestamp || null;
    if (result.is_ambiguous) {
      if (transformed.conditional_answers) {
        result.conditional_answers = typeof transformed.conditional_answers === 'string'
          ? transformed.conditional_answers
          : JSON.stringify(transformed.conditional_answers);
      } else if (conditionalAnswers) {
        result.conditional_answers = JSON.stringify(conditionalAnswers);
      } else {
        result.conditional_answers = null;
      }
    } else {
      result.conditional_answers = null;
    }
  } else if (pearlLevel === 'L3') {
    result.counterfactual_claim = transformed.counterfactual_claim || question.claim || null;
    result.gold_rationale = transformed.gold_rationale || question.explanation || null;
    result.wise_refusal = transformed.wise_refusal || question.wise_refusal || null;
    // Keep invariants as array for now, will be converted to JSON string when saving
    result.invariants = Array.isArray(transformed.invariants) ? transformed.invariants : invariants;
  }

  return result;
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

  const result: any = {
    scenario: question.scenario || '',
    label,
    is_ambiguous: isAmbiguous,
    variables: variables,
    trap_type: question.trap_type || (pearlLevel === 'L3' ? 'F1' : pearlLevel === 'L2' ? 'T1' : 'A'),
    trap_subtype: question.trap_subtype || null,
    difficulty: question.difficulty || 'medium',
    causal_structure: question.causal_structure || null,
    key_insight: (question as any).key_insight || null,
    domain: question.domain || null,
    subdomain: question.subdomain || null,
  };

  if (pearlLevel === 'L1' || pearlLevel === 'L2') {
    result.claim = question.claim || null;
    result.gold_rationale = question.explanation || null;
    result.wise_refusal = question.wise_refusal || null;
  }

  if (pearlLevel === 'L2') {
    result.hidden_timestamp = question.hidden_timestamp || null;
    result.conditional_answers = conditionalAnswers ? JSON.stringify(conditionalAnswers) : null;
  }

  if (pearlLevel === 'L3') {
    result.counterfactual_claim = question.claim || null;
    result.gold_rationale = question.explanation || null;
    result.wise_refusal = question.wise_refusal || null;
    // Keep invariants as array for now, will be converted to JSON string when saving
    result.invariants = invariants;
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
              is_verified: question.is_verified || false,
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
