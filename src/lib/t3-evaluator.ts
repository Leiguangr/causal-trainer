import OpenAI from 'openai';
import { buildRubricPrompt, type T3RubricPayload } from './rubric-prompts';
import { prisma } from './prisma';
import type { Difficulty, L1RubricPayload, L2RubricPayload, L3RubricPayload } from './rubric-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type T3OverallVerdict = 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';

export interface StoredRubricScore {
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  totalScore: number;
}

export interface T3RubricEvaluation {
  rubricScore: StoredRubricScore;
  overallVerdict: T3OverallVerdict;
  priorityLevel: number; // 1=urgent, 2=normal, 3=minor
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

function normalizeScores(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = coerceNumber(v);
    if (n !== null) out[k] = n;
  }
  return out;
}

function normalizeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (v == null) out[k] = '';
    else out[k] = JSON.stringify(v);
  }
  return out;
}

function decideVerdict(totalScore: number): { overallVerdict: T3OverallVerdict; priorityLevel: number } {
  // Unified decision rule:
  // - totalScore < 6.0 → REJECTED
  // - totalScore >= 8.0 → APPROVED
  // - else → NEEDS_REVIEW
  if (totalScore < 6.0) return { overallVerdict: 'REJECTED', priorityLevel: 1 };
  if (totalScore >= 8.0) return { overallVerdict: 'APPROVED', priorityLevel: 3 };
  return { overallVerdict: 'NEEDS_REVIEW', priorityLevel: 2 };
}

export async function scoreT3CaseWithRubric(payload: T3RubricPayload): Promise<T3RubricEvaluation> {
  const rubricPrompt = buildRubricPrompt(payload);

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
    categoryNotes?: unknown;
    totalScore?: unknown;
  };

  const categoryScores = normalizeScores(parsed.categoryScores);
  const categoryNotes = normalizeNotes(parsed.categoryNotes);
  const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);

  const rubricScore: StoredRubricScore = {
    categoryScores,
    categoryNotes,
    totalScore: calculatedTotal,
  };

  const { overallVerdict, priorityLevel } = decideVerdict(rubricScore.totalScore);
  return { rubricScore, overallVerdict, priorityLevel };
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

function asL1GroundTruth(raw: string | null | undefined): L1RubricPayload['groundTruth'] {
  if (raw === 'YES' || raw === 'NO' || raw === 'AMBIGUOUS') return raw;
  return 'AMBIGUOUS';
}

function asL1EvidenceClass(raw: string | null | undefined): L1RubricPayload['evidenceClass'] {
  if (raw === 'WOLF' || raw === 'SHEEP' || raw === 'NONE') return raw;
  return 'NONE';
}

function asL3GroundTruth(raw: string | null | undefined): L3RubricPayload['groundTruth'] {
  if (raw === 'VALID' || raw === 'INVALID' || raw === 'CONDITIONAL') return raw;
  return 'CONDITIONAL';
}

export function buildL1PayloadFromRow(row: {
  id: string;
  dataset: string;
  generationBatchId: string | null;
  difficulty: string;
  scenario: string;
  variables: string | null;
  causalStructure: string | null;
  claim: string;
  groundTruth: string;
  evidenceClass: string;
  evidenceType: string | null;
  whyFlawedOrValid: string;
  domain: string | null;
  subdomain: string | null;
}): L1RubricPayload {
  return {
    caseType: 'L1',
    id: row.id,
    dataset: row.dataset,
    generationBatchId: row.generationBatchId,
    difficulty: normalizeDifficulty(row.difficulty),
    scenario: row.scenario,
    variables: parseJsonOr<Record<string, unknown>>(row.variables, {}),
    causalStructure: row.causalStructure,
    claim: row.claim,
    groundTruth: asL1GroundTruth(row.groundTruth),
    evidenceClass: asL1EvidenceClass(row.evidenceClass),
    evidenceType: row.evidenceType,
    whyFlawedOrValid: row.whyFlawedOrValid,
    domain: row.domain,
    subdomain: row.subdomain,
  };
}

export function buildL2PayloadFromRow(row: {
  id: string;
  dataset: string;
  generationBatchId: string | null;
  difficulty: string;
  scenario: string;
  variables: string | null;
  causalStructure: string | null;
  trapType: string;
  hiddenQuestion: string;
  answerIfA: string;
  answerIfB: string;
  wiseRefusal: string;
}): L2RubricPayload {
  return {
    caseType: 'L2',
    id: row.id,
    dataset: row.dataset,
    generationBatchId: row.generationBatchId,
    difficulty: normalizeDifficulty(row.difficulty),
    scenario: row.scenario,
    variables: parseJsonOr<Record<string, unknown>>(row.variables, {}),
    causalStructure: row.causalStructure,
    trapType: row.trapType,
    hiddenQuestion: row.hiddenQuestion,
    answerIfA: row.answerIfA,
    answerIfB: row.answerIfB,
    wiseRefusal: row.wiseRefusal,
  };
}

export function buildL3PayloadFromRow(row: {
  id: string;
  dataset: string;
  generationBatchId: string | null;
  difficulty: string;
  scenario: string;
  variables: string;
  causalStructure?: string | null;
  family: string;
  counterfactualClaim: string;
  invariants: string;
  groundTruth: string;
  justification: string;
  wiseResponse: string;
  domain: string | null;
}): L3RubricPayload {
  return {
    caseType: 'L3',
    id: row.id,
    dataset: row.dataset,
    generationBatchId: row.generationBatchId,
    difficulty: normalizeDifficulty(row.difficulty),
    scenario: row.scenario,
    variables: parseJsonOr<Record<string, unknown>>(row.variables, {}),
    causalStructure: row.causalStructure ?? null,
    family: row.family,
    counterfactualClaim: row.counterfactualClaim,
    invariants: parseJsonOr<string[]>(row.invariants, []),
    groundTruth: asL3GroundTruth(row.groundTruth),
    justification: row.justification,
    wiseResponse: row.wiseResponse,
    domain: row.domain,
  };
}

export async function evaluateL1Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  for (let i = 0; i < total; i++) {
    const id = caseIds[i];
    try {
      const row = await prisma.l1Case.findUnique({ where: { id } });
      if (!row) continue;

      const payload = buildL1PayloadFromRow(row);
      const scored = await scoreT3CaseWithRubric(payload);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l1CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          // Keep legacy fields empty for T3-case evaluations
          reportTags: JSON.stringify([]),
        },
      });
    } catch (error) {
      console.error(`Failed to evaluate L1Case ${id}:`, error);
    } finally {
      await prisma.evaluationBatch.update({
        where: { id: evaluationBatchId },
        data: { completedCount: startingCompletedCount + i + 1 },
      });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

export async function evaluateL2Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  for (let i = 0; i < total; i++) {
    const id = caseIds[i];
    try {
      const row = await prisma.l2Case.findUnique({ where: { id } });
      if (!row) continue;

      const payload = buildL2PayloadFromRow(row);
      const scored = await scoreT3CaseWithRubric(payload);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l2CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          reportTags: JSON.stringify([]),
        },
      });
    } catch (error) {
      console.error(`Failed to evaluate L2Case ${id}:`, error);
    } finally {
      await prisma.evaluationBatch.update({
        where: { id: evaluationBatchId },
        data: { completedCount: startingCompletedCount + i + 1 },
      });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

export async function evaluateL3Cases(
  evaluationBatchId: string,
  caseIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = caseIds.length;
  for (let i = 0; i < total; i++) {
    const id = caseIds[i];
    try {
      const row = await prisma.l3Case.findUnique({ where: { id } });
      if (!row) continue;

      const payload = buildL3PayloadFromRow(row);
      const scored = await scoreT3CaseWithRubric(payload);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l3CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          reportTags: JSON.stringify([]),
        },
      });
    } catch (error) {
      console.error(`Failed to evaluate L3Case ${id}:`, error);
    } finally {
      await prisma.evaluationBatch.update({
        where: { id: evaluationBatchId },
        data: { completedCount: startingCompletedCount + i + 1 },
      });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}


