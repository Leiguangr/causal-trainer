import OpenAI from 'openai';
import { buildRubricPrompt, buildRubricPromptFromQuestion, type T3RubricPayload, type QuestionForEvaluationLegacy } from './rubric-prompts';
import { prisma } from './prisma';
import type { Difficulty, PearlLevel, T3Case } from '@/types';
import { processBatch, shouldUseBatchAPI, type BatchRequest, type BatchResponse } from './openai-batch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type T3OverallVerdict = 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';

export interface StoredRubricScore {
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  totalScore: number;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  rubricVersion: string;
}

export interface T3RubricEvaluation {
  rubricScore: StoredRubricScore;
  overallVerdict: T3OverallVerdict;
  priorityLevel: number; // 1=urgent, 2=normal, 3=minor
  clarityScore: number; // 1-5, derived from rubric
  difficultyAssessment: string; // From case data
}

const RUBRIC_SCORING_SYSTEM_PROMPT = `You are an expert evaluator using standardized rubrics to assess the quality of causal reasoning cases. Your task is to apply the provided rubric to the provided case, and return ONLY valid JSON in the requested format. Be strict but fair.`;

function coerceNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Convert snake_case to camelCase for internal consistency
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeScores(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = coerceNumber(v);
    if (n !== null) {
      // Convert snake_case keys to camelCase for internal use
      const camelKey = snakeToCamel(k);
      out[camelKey] = n;
    }
  }
  return out;
}

function normalizeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') {
      // Convert snake_case keys to camelCase for internal use
      const camelKey = snakeToCamel(k);
      out[camelKey] = v;
    } else if (v == null) {
      const camelKey = snakeToCamel(k);
      out[camelKey] = '';
    } else {
      const camelKey = snakeToCamel(k);
      out[camelKey] = JSON.stringify(v);
    }
  }
  return out;
}

function decideVerdict(totalScore: number, caseType: 'L1' | 'L2' | 'L3'): { 
  overallVerdict: T3OverallVerdict; 
  priorityLevel: number;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
} {
  // Unified decision rule per Section A.3 of assignment requirements:
  // ≥8.0 → ACCEPT, 6.0-7.0 (inclusive) → REVISE, <6.0 → REJECT
  let acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  let overallVerdict: T3OverallVerdict;
  let priorityLevel: number;

  if (totalScore >= 8.0) {
    acceptanceThreshold = 'ACCEPT';
    overallVerdict = 'APPROVED';
    priorityLevel = 3;
  } else if (totalScore >= 6.0 && totalScore <= 7.0) {
    acceptanceThreshold = 'REVISE';
    overallVerdict = 'NEEDS_REVIEW';
    priorityLevel = 2;
  } else {
    acceptanceThreshold = 'REJECT';
    overallVerdict = 'REJECTED';
    priorityLevel = 1;
  }

  return { overallVerdict, priorityLevel, acceptanceThreshold };
}

/**
 * Derive clarity score (1-5) from rubric category scores
 * Uses scenario clarity category if available, otherwise estimates from total score
 */
function deriveClarityScore(categoryScores: Record<string, number>, caseType: 'L1' | 'L2' | 'L3'): number {
  // Unified rubric uses "scenario_clarity" (or "scenarioClarity" after normalization) for all levels
  const clarityCategoryScore = categoryScores.scenarioClarity;

  if (clarityCategoryScore !== undefined) {
    // Convert category score (0-1.0) to clarity score (1-5)
    // 1.0 → 5, 0.75 → 4, 0.5 → 3, 0.25 → 2, 0 → 1
    if (clarityCategoryScore >= 0.9) return 5;
    if (clarityCategoryScore >= 0.7) return 4;
    if (clarityCategoryScore >= 0.4) return 3;
    if (clarityCategoryScore >= 0.2) return 2;
    return 1;
  }

  // Fallback: estimate from total score (rough mapping)
  // This is less accurate but better than defaulting to 3
  const totalScore = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);
  if (totalScore >= 9) return 5;
  if (totalScore >= 7.5) return 4;
  if (totalScore >= 6) return 3;
  if (totalScore >= 4) return 2;
  return 1;
}

/**
 * Process a batch response and return T3RubricEvaluation
 */
function processBatchResponse(
  response: BatchResponse,
  caseType: 'L1' | 'L2' | 'L3',
  difficulty: string
): T3RubricEvaluation {
  if (response.error) {
    throw new Error(`Batch API error: ${response.error.message}`);
  }

  const content = response.response?.body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from T3 rubric scoring agent');
  }

  const parsed = JSON.parse(content) as {
    categoryScores?: unknown;
    category_scores?: unknown; // snake_case format
    categoryNotes?: unknown;
    category_notes?: unknown; // snake_case format
    totalScore?: unknown;
    total_score?: unknown; // snake_case format
  };

  // Support both camelCase (legacy) and snake_case (new format)
  const categoryScores = normalizeScores(parsed.categoryScores || parsed.category_scores);
  const categoryNotes = normalizeNotes(parsed.categoryNotes || parsed.category_notes);
  const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);
  
  // If total_score is provided and matches calculated, use it; otherwise use calculated
  const providedTotal = coerceNumber(parsed.totalScore || parsed.total_score);
  const finalTotal = providedTotal !== null && Math.abs(providedTotal - calculatedTotal) < 0.01 
    ? providedTotal 
    : calculatedTotal;

  // Determine acceptance threshold (unified rubric, no version needed)
  const rubricVersion = 'unified';
  const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
    calculatedTotal,
    caseType
  );

  const rubricScore: StoredRubricScore = {
    categoryScores,
    categoryNotes,
    totalScore: finalTotal,
    acceptanceThreshold,
    rubricVersion,
  };

  // Derive clarity score from rubric categories
  const clarityScore = deriveClarityScore(categoryScores, caseType);

  return {
    rubricScore,
    overallVerdict,
    priorityLevel,
    clarityScore,
    difficultyAssessment: normalizeDifficulty(difficulty),
  };
}

export async function scoreT3CaseWithRubric(
  payload: T3RubricPayload,
  difficulty: string
): Promise<T3RubricEvaluation> {
  const rubricPrompt = buildRubricPrompt(payload);
  const caseType = payload.case.pearl_level; // Extract pearl_level from the case

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
      { role: 'user', content: rubricPrompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from T3 rubric scoring agent');
  }

  const parsed = JSON.parse(content) as {
    categoryScores?: unknown;
    category_scores?: unknown; // snake_case format
    categoryNotes?: unknown;
    category_notes?: unknown; // snake_case format
    totalScore?: unknown;
    total_score?: unknown; // snake_case format
  };

  // Support both camelCase (legacy) and snake_case (new format)
  const categoryScores = normalizeScores(parsed.categoryScores || parsed.category_scores);
  const categoryNotes = normalizeNotes(parsed.categoryNotes || parsed.category_notes);
  const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);
  
  // If total_score is provided and matches calculated, use it; otherwise use calculated
  const providedTotal = coerceNumber(parsed.totalScore || parsed.total_score);
  const finalTotal = providedTotal !== null && Math.abs(providedTotal - calculatedTotal) < 0.01 
    ? providedTotal 
    : calculatedTotal;

  // Determine acceptance threshold (unified rubric, no version needed)
  const rubricVersion = 'unified';
  const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
    calculatedTotal,
    caseType
  );

  const rubricScore: StoredRubricScore = {
    categoryScores,
    categoryNotes,
    totalScore: finalTotal,
    acceptanceThreshold,
    rubricVersion,
  };

  // Derive clarity score from rubric categories
  const clarityScore = deriveClarityScore(categoryScores, caseType);

  return {
    rubricScore,
    overallVerdict,
    priorityLevel,
    clarityScore,
    difficultyAssessment: normalizeDifficulty(difficulty),
  };
}

function parseJsonOr<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeDifficulty(raw: string | null | undefined): Difficulty {
  const d = (raw || '').toLowerCase();
  if (d === 'easy' || d === 'medium' || d === 'hard') return d;
  return 'medium';
}

/**
 * Convert a Prisma T3Case row to T3RubricPayload for unified rubric evaluation
 * This function handles all Pearl levels (L1, L2, L3) using the same unified schema
 */
function buildT3RubricPayloadFromRow(row: {
  id: string;
  dataset: string;
  generation_batch_id: string | null;
  pearl_level: PearlLevel;
  difficulty: string;
  scenario: string;
  variables: string | null;
  causal_structure: string | null;
  claim: string | null;
  counterfactual_claim: string | null;
  label: string;
  is_ambiguous: boolean;
  trap_type: string;
  trap_type_name: string | null;
  trap_subtype: string | null;
  trap_subtype_name: string | null;
  hidden_timestamp: string | null;
  conditional_answers: string | null;
  wise_refusal: string | null;
  gold_rationale: string | null;
  key_insight: string | null;
  invariants: string | null;
  domain: string | null;
  subdomain: string | null;
  source_case: string | null;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}): T3RubricPayload {
  // Parse variables JSON
  let variables: T3Case['variables'] = null;
  try {
    if (row.variables) {
      const parsed = typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables;
      if (parsed && typeof parsed === 'object') {
        variables = {
          X: parsed.X || '',
          Y: parsed.Y || '',
          Z: Array.isArray(parsed.Z) ? parsed.Z : parsed.Z ? [parsed.Z] : [],
        };
      }
    }
  } catch {
    // ignore parse errors
  }

  // Parse invariants if present (L3 only)
  let invariants: string | null = null;
  if (row.invariants) {
    try {
      const parsed = typeof row.invariants === 'string' ? JSON.parse(row.invariants) : row.invariants;
      invariants = Array.isArray(parsed) ? JSON.stringify(parsed) : row.invariants;
    } catch {
      invariants = row.invariants;
    }
  }

  const t3Case: T3Case = {
    id: row.id,
    case_id: null,
    bucket: null,
    pearl_level: row.pearl_level,
    domain: row.domain,
    subdomain: row.subdomain,
    scenario: row.scenario,
    claim: row.claim,
    counterfactual_claim: row.counterfactual_claim,
    label: row.label as T3Case['label'],
    is_ambiguous: row.is_ambiguous,
    variables,
    trap_type: row.trap_type,
    trap_type_name: row.trap_type_name,
    trap_subtype: row.trap_subtype,
    trap_subtype_name: row.trap_subtype_name,
    difficulty: normalizeDifficulty(row.difficulty) as Difficulty,
    causal_structure: row.causal_structure,
    key_insight: row.key_insight,
    hidden_timestamp: row.hidden_timestamp,
    conditional_answers: row.conditional_answers,
    wise_refusal: row.wise_refusal,
    gold_rationale: row.gold_rationale,
    invariants,
    initial_author: null,
    validator: null,
    final_score: null,
    dataset: row.dataset,
    author: null,
    source_case: row.source_case,
    generation_batch_id: row.generation_batch_id,
    is_verified: row.is_verified,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return { case: t3Case };
}

export async function evaluateL1Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  const useBatch = shouldUseBatchAPI(total);
  let batchResponses: BatchResponse[] | null = null;

  if (useBatch) {
    console.log(`[Evaluation Batch ${evaluationBatchId}] Using OpenAI Batch API for ${total} L1 cases (cost savings)`);
    
    // Load all cases
    const rows = await Promise.all(
      caseIds.map(id => prisma.t3Case.findUnique({ where: { id, pearl_level: 'L1' } }))
    );
    const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);

    // Build batch requests
    const batchRequests: BatchRequest[] = validRows.map((row, idx) => {
      const payload = buildT3RubricPayloadFromRow(row);
      const rubricPrompt = buildRubricPrompt(payload);
      return {
        custom_id: `eval_l1_${evaluationBatchId}_${idx}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
            { role: 'user', content: rubricPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
      };
    });

    // Try batch processing, fall back to synchronous if token limit exceeded
    try {
      batchResponses = await processBatch(batchRequests, (status) => {
        console.log(`[Evaluation Batch ${evaluationBatchId}] Batch API status: ${status}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      const isTokenLimitError = (error as any)?.isTokenLimitError || errorMessage.includes('token_limit_exceeded') || errorMessage.includes('Enqueued token limit');
      
      if (isTokenLimitError) {
        // Token limit exceeded - fall back to synchronous processing
        console.warn(`[Evaluation Batch ${evaluationBatchId}] Token limit exceeded, falling back to synchronous API calls`);
        batchResponses = null; // Will trigger fallback below
      } else {
        // Other errors - mark as failed
        console.error(`[Evaluation Batch ${evaluationBatchId}] Batch API error:`, errorMessage);
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: {
            status: 'failed',
            error_message: errorMessage,
          },
        });
        throw error;
      }
    }

    // Process batch results if available
    if (batchResponses) {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const response = batchResponses[i];
        
        try {
          const scored = processBatchResponse(response, 'L1', row.difficulty);

          await prisma.caseEvaluation.create({
            data: {
              question_id: null,
              t3_case_id: row.id,
              evaluation_batch_id: evaluationBatchId,
              overall_verdict: scored.overallVerdict,
              priority_level: scored.priorityLevel,
              rubric_score: JSON.stringify(scored.rubricScore),
              clarity_score: scored.clarityScore,
              difficulty_assessment: scored.difficultyAssessment,
              pearl_level_assessment: 'CORRECT',
              ground_truth_assessment: 'CORRECT',
              trap_type_assessment: 'CORRECT',
              report_tags: JSON.stringify([]),
            },
          });
        } catch (error) {
          console.error(`Failed to evaluate L1Case ${row.id}:`, error);
        } finally {
          await prisma.evaluationBatch.update({
            where: { id: evaluationBatchId },
            data: { completed_count: startingCompletedCount + i + 1 },
          });
        }
      }
      return; // Batch processing completed successfully
    }
  }
  
  // Use synchronous API if batch wasn't used or failed with token limit
  if (!useBatch || batchResponses === null) {
    // Use synchronous API for small batches
    for (let i = 0; i < total; i++) {
      const id = caseIds[i];
      try {
        const row = await prisma.t3Case.findUnique({ where: { id, pearl_level: 'L1' } });
        if (!row) continue;

        const payload = buildT3RubricPayloadFromRow(row);
        const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

        await prisma.caseEvaluation.create({
          data: {
            question_id: null,
            t3_case_id: row.id,
            evaluation_batch_id: evaluationBatchId,
            overall_verdict: scored.overallVerdict,
            priority_level: scored.priorityLevel,
            rubric_score: JSON.stringify(scored.rubricScore),
            clarity_score: scored.clarityScore,
            difficulty_assessment: scored.difficultyAssessment,
            // T3 cases have fixed pearl level, ground truth, and trap type from their schema
            pearl_level_assessment: 'CORRECT', // T3Case pearl_level is always correct
            ground_truth_assessment: 'CORRECT', // Label is part of the case schema
            trap_type_assessment: 'CORRECT', // Trap type is part of the case schema
            report_tags: JSON.stringify([]),
          },
        });
      } catch (error) {
        console.error(`Failed to evaluate L1Case ${id}:`, error);
      } finally {
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: { completed_count: startingCompletedCount + i + 1 },
        });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}

export async function evaluateL2Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  const useBatch = shouldUseBatchAPI(total);
  let batchResponses: BatchResponse[] | null = null;

  if (useBatch) {
    console.log(`[Evaluation Batch ${evaluationBatchId}] Using OpenAI Batch API for ${total} L2 cases (cost savings)`);
    
    // Load all cases
    const rows = await Promise.all(
      caseIds.map(id => prisma.t3Case.findUnique({ where: { id, pearl_level: 'L2' } }))
    );
    const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);

    // Build batch requests
    const batchRequests: BatchRequest[] = validRows.map((row, idx) => {
      const payload = buildT3RubricPayloadFromRow(row);
      const rubricPrompt = buildRubricPrompt(payload);
      return {
        custom_id: `eval_l2_${evaluationBatchId}_${idx}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
            { role: 'user', content: rubricPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
      };
    });

    // Try batch processing, fall back to synchronous if token limit exceeded
    try {
      batchResponses = await processBatch(batchRequests, (status) => {
        console.log(`[Evaluation Batch ${evaluationBatchId}] Batch API status: ${status}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      const isTokenLimitError = (error as any)?.isTokenLimitError || errorMessage.includes('token_limit_exceeded') || errorMessage.includes('Enqueued token limit');
      
      if (isTokenLimitError) {
        console.warn(`[Evaluation Batch ${evaluationBatchId}] Token limit exceeded, falling back to synchronous API calls`);
        batchResponses = null;
      } else {
        console.error(`[Evaluation Batch ${evaluationBatchId}] Batch API error:`, errorMessage);
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: {
            status: 'failed',
            error_message: errorMessage,
          },
        });
        throw error;
      }
    }

    // Process batch results if available
    if (batchResponses) {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const response = batchResponses[i];
        
        try {
          const scored = processBatchResponse(response, 'L2', row.difficulty);

          await prisma.caseEvaluation.create({
            data: {
              question_id: null,
              t3_case_id: row.id,
              evaluation_batch_id: evaluationBatchId,
              overall_verdict: scored.overallVerdict,
              priority_level: scored.priorityLevel,
              rubric_score: JSON.stringify(scored.rubricScore),
              clarity_score: scored.clarityScore,
              difficulty_assessment: scored.difficultyAssessment,
              pearl_level_assessment: 'CORRECT',
              trap_type_assessment: 'CORRECT',
              ground_truth_assessment: 'CORRECT',
              report_tags: JSON.stringify([]),
            },
          });
        } catch (error) {
          console.error(`Failed to evaluate L2Case ${row.id}:`, error);
        } finally {
          await prisma.evaluationBatch.update({
            where: { id: evaluationBatchId },
            data: { completed_count: startingCompletedCount + i + 1 },
          });
        }
      }
      return; // Batch processing completed successfully
    }
  }
  
  // Use synchronous API if batch wasn't used or failed with token limit
  if (!useBatch || batchResponses === null) {
    // Use synchronous API for small batches
    for (let i = 0; i < total; i++) {
      const id = caseIds[i];
      try {
        const row = await prisma.t3Case.findUnique({ where: { id, pearl_level: 'L2' } });
        if (!row) continue;

        const payload = buildT3RubricPayloadFromRow(row);
        const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

        await prisma.caseEvaluation.create({
          data: {
            question_id: null,
            t3_case_id: row.id,
            evaluation_batch_id: evaluationBatchId,
            overall_verdict: scored.overallVerdict,
            priority_level: scored.priorityLevel,
            rubric_score: JSON.stringify(scored.rubricScore),
            clarity_score: scored.clarityScore,
            difficulty_assessment: scored.difficultyAssessment,
            // T3 cases have fixed pearl level and trap type from their schema
            pearl_level_assessment: 'CORRECT', // T3Case pearl_level is always correct
            trap_type_assessment: 'CORRECT', // Trap type is part of the case schema
            ground_truth_assessment: 'CORRECT', // Label is part of the case schema (L2 always NO)
            report_tags: JSON.stringify([]),
          },
        });
      } catch (error) {
        console.error(`Failed to evaluate L2Case ${id}:`, error);
      } finally {
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: { completed_count: startingCompletedCount + i + 1 },
        });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}

export async function evaluateL3Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  const useBatch = shouldUseBatchAPI(total);
  let batchResponses: BatchResponse[] | null = null;

  if (useBatch) {
    console.log(`[Evaluation Batch ${evaluationBatchId}] Using OpenAI Batch API for ${total} L3 cases (cost savings)`);
    
    // Load all cases
    const rows = await Promise.all(
      caseIds.map(id => prisma.t3Case.findUnique({ where: { id, pearl_level: 'L3' } }))
    );
    const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);

    // Build batch requests
    const batchRequests: BatchRequest[] = validRows.map((row, idx) => {
      const payload = buildT3RubricPayloadFromRow(row);
      const rubricPrompt = buildRubricPrompt(payload);
      return {
        custom_id: `eval_l3_${evaluationBatchId}_${idx}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
            { role: 'user', content: rubricPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
      };
    });

    // Try batch processing, fall back to synchronous if token limit exceeded
    try {
      batchResponses = await processBatch(batchRequests, (status) => {
        console.log(`[Evaluation Batch ${evaluationBatchId}] Batch API status: ${status}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      const isTokenLimitError = (error as any)?.isTokenLimitError || errorMessage.includes('token_limit_exceeded') || errorMessage.includes('Enqueued token limit');
      
      if (isTokenLimitError) {
        console.warn(`[Evaluation Batch ${evaluationBatchId}] Token limit exceeded, falling back to synchronous API calls`);
        batchResponses = null;
      } else {
        console.error(`[Evaluation Batch ${evaluationBatchId}] Batch API error:`, errorMessage);
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: {
            status: 'failed',
            error_message: errorMessage,
          },
        });
        throw error;
      }
    }

    // Process batch results if available
    if (batchResponses) {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const response = batchResponses[i];
        
        try {
          const scored = processBatchResponse(response, 'L3', row.difficulty);

          await prisma.caseEvaluation.create({
            data: {
              question_id: null,
              t3_case_id: row.id,
              evaluation_batch_id: evaluationBatchId,
              overall_verdict: scored.overallVerdict,
              priority_level: scored.priorityLevel,
              rubric_score: JSON.stringify(scored.rubricScore),
              clarity_score: scored.clarityScore,
              difficulty_assessment: scored.difficultyAssessment,
              pearl_level_assessment: 'CORRECT',
              ground_truth_assessment: 'CORRECT',
              trap_type_assessment: 'CORRECT',
              report_tags: JSON.stringify([]),
            },
          });
        } catch (error) {
          console.error(`Failed to evaluate L3Case ${row.id}:`, error);
        } finally {
          await prisma.evaluationBatch.update({
            where: { id: evaluationBatchId },
            data: { completed_count: startingCompletedCount + i + 1 },
          });
        }
      }
      return; // Batch processing completed successfully
    }
  }
  
  // Use synchronous API if batch wasn't used or failed with token limit
  if (!useBatch || batchResponses === null) {
    // Use synchronous API for small batches
    for (let i = 0; i < total; i++) {
      const id = caseIds[i];
      try {
        const row = await prisma.t3Case.findUnique({ where: { id, pearl_level: 'L3' } });
        if (!row) continue;

        const payload = buildT3RubricPayloadFromRow(row);
        const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

        await prisma.caseEvaluation.create({
          data: {
            question_id: null,
            t3_case_id: row.id,
            evaluation_batch_id: evaluationBatchId,
            overall_verdict: scored.overallVerdict,
            priority_level: scored.priorityLevel,
            rubric_score: JSON.stringify(scored.rubricScore),
            clarity_score: scored.clarityScore,
            difficulty_assessment: scored.difficultyAssessment,
            // T3 cases have fixed pearl level and ground truth from their schema
            pearl_level_assessment: 'CORRECT', // T3Case pearl_level is always correct
            ground_truth_assessment: 'CORRECT', // Label is part of the case schema
            trap_type_assessment: 'CORRECT', // Trap type (family) is part of the case schema
            report_tags: JSON.stringify([]),
          },
        });
      } catch (error) {
        console.error(`Failed to evaluate L3Case ${id}:`, error);
      } finally {
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: { completed_count: startingCompletedCount + i + 1 },
        });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}

/**
 * Evaluate legacy Question records using rubric-based scoring
 */
export async function evaluateLegacyQuestions(
  evaluationBatchId: string,
  questionIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = questionIds.length;
  const useBatch = shouldUseBatchAPI(total);
  let batchResponses: BatchResponse[] | null = null;

  if (useBatch) {
    console.log(`[Evaluation Batch ${evaluationBatchId}] Using OpenAI Batch API for ${total} legacy questions (cost savings)`);
    
    // Load all questions
    const questions = await Promise.all(
      questionIds.map(id => prisma.question.findUnique({ where: { id } }))
    );
    const validQuestions = questions.filter((q): q is NonNullable<typeof q> => q !== null);

    // Build batch requests
    const batchRequests: BatchRequest[] = validQuestions.map((question, idx) => {
      const pearlLevel = (question.pearl_level as PearlLevel) || 'L1';
      const rubricPrompt = buildRubricPromptFromQuestion(question, pearlLevel);
      return {
        custom_id: `eval_legacy_${evaluationBatchId}_${idx}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
            { role: 'user', content: rubricPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
      };
    });

    // Try batch processing, fall back to synchronous if token limit exceeded
    try {
      batchResponses = await processBatch(batchRequests, (status) => {
        console.log(`[Evaluation Batch ${evaluationBatchId}] Batch API status: ${status}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      const isTokenLimitError = (error as any)?.isTokenLimitError || errorMessage.includes('token_limit_exceeded') || errorMessage.includes('Enqueued token limit');
      
      if (isTokenLimitError) {
        console.warn(`[Evaluation Batch ${evaluationBatchId}] Token limit exceeded, falling back to synchronous API calls`);
        batchResponses = null;
      } else {
        console.error(`[Evaluation Batch ${evaluationBatchId}] Batch API error:`, errorMessage);
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: {
            status: 'failed',
            error_message: errorMessage,
          },
        });
        throw error;
      }
    }

    // Process batch results if available
    if (batchResponses) {
      for (let i = 0; i < validQuestions.length; i++) {
      const question = validQuestions[i];
      const response = batchResponses[i];
      const pearlLevel = (question.pearl_level as PearlLevel) || 'L1';
      
      try {
        const parsed = JSON.parse(response.response?.body?.choices?.[0]?.message?.content || '{}') as {
          categoryScores?: unknown;
          category_scores?: unknown;
          categoryNotes?: unknown;
          category_notes?: unknown;
          totalScore?: unknown;
          total_score?: unknown;
        };

        const categoryScores = normalizeScores(parsed.categoryScores || parsed.category_scores);
        const categoryNotes = normalizeNotes(parsed.categoryNotes || parsed.category_notes);
        const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);
        
        const providedTotal = coerceNumber(parsed.totalScore || parsed.total_score);
        const finalTotal = providedTotal !== null && Math.abs(providedTotal - calculatedTotal) < 0.01 
          ? providedTotal 
          : calculatedTotal;

        const rubricVersion = 'unified';
        const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
          finalTotal,
          pearlLevel
        );

        const rubricScore: StoredRubricScore = {
          categoryScores,
          categoryNotes,
          totalScore: finalTotal,
          acceptanceThreshold,
          rubricVersion,
        };

        const clarityScore = deriveClarityScore(categoryScores, pearlLevel);
        const difficulty = normalizeDifficulty(question.difficulty);

        await prisma.caseEvaluation.create({
          data: {
            question_id: question.id,
            t3_case_id: null,
            evaluation_batch_id: evaluationBatchId,
            overall_verdict: overallVerdict,
            priority_level: priorityLevel,
            rubric_score: JSON.stringify(rubricScore),
            clarity_score: clarityScore,
            difficulty_assessment: difficulty,
            pearl_level_assessment: 'CORRECT',
            ground_truth_assessment: 'CORRECT',
            trap_type_assessment: 'CORRECT',
            report_tags: JSON.stringify([]),
          },
        });
      } catch (error) {
        console.error(`Failed to evaluate Question ${question.id}:`, error);
      } finally {
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: { completed_count: startingCompletedCount + i + 1 },
        });
      }
    }
    return; // Batch processing completed successfully
  }
  
  // Use synchronous API if batch wasn't used or failed with token limit
  if (!useBatch || batchResponses === null) {
    // Use synchronous API for small batches or fallback
    for (let i = 0; i < total; i++) {
      const id = questionIds[i];
      try {
        const question = await prisma.question.findUnique({ where: { id } });
        if (!question) continue;

        const pearlLevel = (question.pearl_level as PearlLevel) || 'L1';
        const rubricPrompt = buildRubricPromptFromQuestion(question, pearlLevel);

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
            { role: 'user', content: rubricPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from rubric scoring agent');
        }

        const parsed = JSON.parse(content) as {
          categoryScores?: unknown;
          category_scores?: unknown; // snake_case format
          categoryNotes?: unknown;
          category_notes?: unknown; // snake_case format
          totalScore?: unknown;
          total_score?: unknown; // snake_case format
        };

        // Support both camelCase (legacy) and snake_case (new format)
        const categoryScores = normalizeScores(parsed.categoryScores || parsed.category_scores);
        const categoryNotes = normalizeNotes(parsed.categoryNotes || parsed.category_notes);
        const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);
        
        // If total_score is provided and matches calculated, use it; otherwise use calculated
        const providedTotal = coerceNumber(parsed.totalScore || parsed.total_score);
        const finalTotal = providedTotal !== null && Math.abs(providedTotal - calculatedTotal) < 0.01 
          ? providedTotal 
          : calculatedTotal;

        // Unified rubric (no version needed)
        const rubricVersion = 'unified';
        const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
          finalTotal,
          pearlLevel
        );

        const rubricScore: StoredRubricScore = {
          categoryScores,
          categoryNotes,
          totalScore: finalTotal,
          acceptanceThreshold,
          rubricVersion,
        };

        // Derive clarity score from rubric categories
        const clarityScore = deriveClarityScore(categoryScores, pearlLevel);
        const difficulty = normalizeDifficulty(question.difficulty);

        await prisma.caseEvaluation.create({
          data: {
            question_id: question.id,
            t3_case_id: null,
            evaluation_batch_id: evaluationBatchId,
            overall_verdict: overallVerdict,
            priority_level: priorityLevel,
            rubric_score: JSON.stringify(rubricScore),
            clarity_score: clarityScore,
            difficulty_assessment: difficulty,
            // For legacy questions, we can't definitively say assessments are correct
            // since the Question schema may have errors, but we'll mark them as CORRECT
            // since they're the source of truth for legacy data
            pearl_level_assessment: 'CORRECT',
            ground_truth_assessment: 'CORRECT',
            trap_type_assessment: 'CORRECT',
            report_tags: JSON.stringify([]),
          },
        });
      } catch (error) {
        console.error(`Failed to evaluate Question ${id}:`, error);
      } finally {
        await prisma.evaluationBatch.update({
          where: { id: evaluationBatchId },
          data: { completed_count: startingCompletedCount + i + 1 },
        });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}
}
