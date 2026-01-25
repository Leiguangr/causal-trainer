import OpenAI from 'openai';
import { buildRubricPrompt, buildRubricPromptFromQuestion, type T3RubricPayload, type QuestionForEvaluationLegacy } from './rubric-prompts';
import { prisma } from './prisma';
import type { Difficulty, L1RubricPayload, L2RubricPayload, L3RubricPayload, PearlLevel } from './rubric-prompts';

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

function decideVerdict(totalScore: number, caseType: 'L1' | 'L2' | 'L3'): { 
  overallVerdict: T3OverallVerdict; 
  priorityLevel: number;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
} {
  // Unified decision rule based on rubric thresholds:
  // L1: 8-10 → ACCEPT, 6-7 → REVISE, ≤5 → REJECT
  // L2: ≥8.0 → ACCEPT, 6.0-7.5 → REVISE, <6.0 → REJECT
  // L3: 9-10 → ACCEPT, 7-8.5 → REVISE, 5-6.5 → REJECT, <5 → REJECT
  let acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  let overallVerdict: T3OverallVerdict;
  let priorityLevel: number;

  if (caseType === 'L1') {
    if (totalScore >= 8) {
      acceptanceThreshold = 'ACCEPT';
      overallVerdict = 'APPROVED';
      priorityLevel = 3;
    } else if (totalScore >= 6) {
      acceptanceThreshold = 'REVISE';
      overallVerdict = 'NEEDS_REVIEW';
      priorityLevel = 2;
    } else {
      acceptanceThreshold = 'REJECT';
      overallVerdict = 'REJECTED';
      priorityLevel = 1;
    }
  } else if (caseType === 'L2') {
    if (totalScore >= 8.0) {
      acceptanceThreshold = 'ACCEPT';
      overallVerdict = 'APPROVED';
      priorityLevel = 3;
    } else if (totalScore >= 6.0) {
      acceptanceThreshold = 'REVISE';
      overallVerdict = 'NEEDS_REVIEW';
      priorityLevel = 2;
    } else {
      acceptanceThreshold = 'REJECT';
      overallVerdict = 'REJECTED';
      priorityLevel = 1;
    }
  } else { // L3
    if (totalScore >= 9) {
      acceptanceThreshold = 'ACCEPT';
      overallVerdict = 'APPROVED';
      priorityLevel = 3;
    } else if (totalScore >= 7) {
      acceptanceThreshold = 'REVISE';
      overallVerdict = 'NEEDS_REVIEW';
      priorityLevel = 2;
    } else {
      acceptanceThreshold = 'REJECT';
      overallVerdict = 'REJECTED';
      priorityLevel = 1;
    }
  }

  return { overallVerdict, priorityLevel, acceptanceThreshold };
}

/**
 * Derive clarity score (1-5) from rubric category scores
 * Uses scenario clarity category if available, otherwise estimates from total score
 */
function deriveClarityScore(categoryScores: Record<string, number>, caseType: 'L1' | 'L2' | 'L3'): number {
  // Try to get scenario clarity score (L1/L2) or clarity score (L3)
  let clarityCategoryScore: number | undefined;
  
  if (caseType === 'L1' || caseType === 'L2') {
    clarityCategoryScore = categoryScores.scenarioClarity;
  } else if (caseType === 'L3') {
    clarityCategoryScore = categoryScores.clarity;
  }

  if (clarityCategoryScore !== undefined) {
    // Convert category score (0-2) to clarity score (1-5)
    // 2.0 → 5, 1.5 → 4, 1.0 → 3, 0.5 → 2, 0 → 1
    if (clarityCategoryScore >= 1.8) return 5;
    if (clarityCategoryScore >= 1.3) return 4;
    if (clarityCategoryScore >= 0.8) return 3;
    if (clarityCategoryScore >= 0.3) return 2;
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

export async function scoreT3CaseWithRubric(
  payload: T3RubricPayload,
  difficulty: string
): Promise<T3RubricEvaluation> {
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

  // Determine rubric version and acceptance threshold
  const rubricVersion = `${payload.caseType}-v1.0`;
  const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
    calculatedTotal,
    payload.caseType
  );

  const rubricScore: StoredRubricScore = {
    categoryScores,
    categoryNotes,
    totalScore: calculatedTotal,
    acceptanceThreshold,
    rubricVersion,
  };

  // Derive clarity score from rubric categories
  const clarityScore = deriveClarityScore(categoryScores, payload.caseType);

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
      const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l1CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          clarityScore: scored.clarityScore,
          difficultyAssessment: scored.difficultyAssessment,
          // T3 cases have fixed pearl level, ground truth, and trap type from their schema
          pearlLevelAssessment: 'CORRECT', // L1Case is always L1
          groundTruthAssessment: 'CORRECT', // Ground truth is part of the case schema
          trapTypeAssessment: 'N/A', // L1 uses evidenceClass, not trapType
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
      const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l2CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          clarityScore: scored.clarityScore,
          difficultyAssessment: scored.difficultyAssessment,
          // T3 cases have fixed pearl level and trap type from their schema
          pearlLevelAssessment: 'CORRECT', // L2Case is always L2
          trapTypeAssessment: 'CORRECT', // Trap type is part of the case schema
          groundTruthAssessment: 'N/A', // L2 cases don't have ground truth (they're ambiguous by design)
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
      const scored = await scoreT3CaseWithRubric(payload, row.difficulty);

      await prisma.caseEvaluation.create({
        data: {
          questionId: null,
          l3CaseId: row.id,
          evaluationBatchId,
          overallVerdict: scored.overallVerdict,
          priorityLevel: scored.priorityLevel,
          rubricScore: JSON.stringify(scored.rubricScore),
          clarityScore: scored.clarityScore,
          difficultyAssessment: scored.difficultyAssessment,
          // T3 cases have fixed pearl level and ground truth from their schema
          pearlLevelAssessment: 'CORRECT', // L3Case is always L3
          groundTruthAssessment: 'CORRECT', // Ground truth is part of the case schema
          trapTypeAssessment: 'N/A', // L3 uses family, not trapType
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

/**
 * Evaluate legacy Question records using rubric-based scoring
 */
export async function evaluateLegacyQuestions(
  evaluationBatchId: string,
  questionIds: string[],
  startingCompletedCount: number = 0
): Promise<void> {
  const total = questionIds.length;
  for (let i = 0; i < total; i++) {
    const id = questionIds[i];
    try {
      const question = await prisma.question.findUnique({ where: { id } });
      if (!question) continue;

      const pearlLevel = (question.pearlLevel as PearlLevel) || 'L1';
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
        categoryNotes?: unknown;
        totalScore?: unknown;
      };

      const categoryScores = normalizeScores(parsed.categoryScores);
      const categoryNotes = normalizeNotes(parsed.categoryNotes);
      const calculatedTotal = Object.values(categoryScores).reduce((sum, s) => sum + s, 0);

      const rubricVersion = `${pearlLevel}-v1.0`;
      const { overallVerdict, priorityLevel, acceptanceThreshold } = decideVerdict(
        calculatedTotal,
        pearlLevel
      );

      const rubricScore: StoredRubricScore = {
        categoryScores,
        categoryNotes,
        totalScore: calculatedTotal,
        acceptanceThreshold,
        rubricVersion,
      };

      // Derive clarity score from rubric categories
      const clarityScore = deriveClarityScore(categoryScores, pearlLevel);
      const difficulty = normalizeDifficulty(question.difficulty);

      await prisma.caseEvaluation.create({
        data: {
          questionId: question.id,
          l1CaseId: null,
          l2CaseId: null,
          l3CaseId: null,
          evaluationBatchId,
          overallVerdict,
          priorityLevel,
          rubricScore: JSON.stringify(rubricScore),
          clarityScore,
          difficultyAssessment: difficulty,
          // For legacy questions, we can't definitively say assessments are correct
          // since the Question schema may have errors, but we'll mark them as CORRECT
          // since they're the source of truth for legacy data
          pearlLevelAssessment: 'CORRECT',
          groundTruthAssessment: 'CORRECT',
          trapTypeAssessment: 'CORRECT',
          reportTags: JSON.stringify([]),
        },
      });
    } catch (error) {
      console.error(`Failed to evaluate Question ${id}:`, error);
    } finally {
      await prisma.evaluationBatch.update({
        where: { id: evaluationBatchId },
        data: { completedCount: startingCompletedCount + i + 1 },
      });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}


