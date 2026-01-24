import OpenAI from 'openai';
import { prisma } from './prisma';
import {
  buildRubricPromptFromQuestion,
  type QuestionForEvaluationLegacy,
  type RubricScore,
} from './rubric-prompts';
import type { PearlLevel } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type QuestionForEvaluation = QuestionForEvaluationLegacy;

export interface EvaluationResult {
  // Structural assessments
  pearlLevelAssessment: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
  suggestedPearlLevel?: string;
  trapTypeAssessment: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
  suggestedTrapType?: string;
  trapSubtypeAssessment: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
  suggestedTrapSubtype?: string;
  groundTruthAssessment: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
  suggestedGroundTruth?: string;

  // Quality flags
  hasAmbiguity: boolean;
  ambiguityNotes?: string;
  hasLogicalIssues: boolean;
  logicalIssueNotes?: string;
  hasDomainErrors: boolean;
  domainErrorNotes?: string;
  clarityScore: number; // 1-5
  difficultyAssessment: string;

  // Detailed notes
  structuralNotes: string;
  causalGraphNotes: string;
  variableNotes: string;

  // Recommendations
  overallVerdict: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';
  suggestedCorrections: string;
  priorityLevel: number; // 1=urgent, 2=normal, 3=minor
  reportTags: string[];

  // Rubric-based scoring
  rubricScore?: RubricScore;
}

const RUBRIC_SCORING_SYSTEM_PROMPT = `You are an expert evaluator using standardized rubrics to assess the quality of causal reasoning cases. Your task is to apply the appropriate rubric (L1, L2, or L3) to evaluate case quality and return structured scoring results.

You must:
1. Carefully read the rubric instructions
2. Evaluate each category according to the rubric criteria
3. Assign points based on the scoring guidelines
4. Provide clear justifications for each score
5. Calculate the total score and determine the acceptance threshold
6. Return ONLY valid JSON matching the specified format

Be strict but fair in your evaluation.`;

function buildEvaluationPrompt(question: QuestionForEvaluation): string {
  let variables: { X?: string; Y?: string; Z?: string[] } = {};
  try {
    if (question.variables) {
      variables = JSON.parse(question.variables);
    }
  } catch {
    // ignore parse errors
  }

  return `Evaluate this causal reasoning question:

**SCENARIO**: ${question.scenario}

**CLAIM**: ${question.claim}

**ASSIGNED LABELS**:
- Pearl Level: ${question.pearlLevel}
- Trap Type: ${question.trapType}
- Trap Subtype: ${question.trapSubtype}
- Ground Truth: ${question.groundTruth}
- Domain: ${question.domain}${question.subdomain ? ` / ${question.subdomain}` : ''}

**VARIABLES**:
- X (Treatment/Cause): ${variables.X || 'Not specified'}
- Y (Outcome): ${variables.Y || 'Not specified'}
- Z (Confounders/Mechanisms): ${Array.isArray(variables.Z) ? variables.Z.join(', ') : 'Not specified'}

**CAUSAL STRUCTURE**: ${question.causalStructure || 'Not specified'}

**EXPLANATION**: ${question.explanation}

**KEY INSIGHT**: ${question.keyInsight || 'Not specified'}

**WISE REFUSAL**: ${question.wiseRefusal || 'Not specified'}

---

Analyze this question and return a JSON object with these fields:
{
  "pearlLevelAssessment": "CORRECT|INCORRECT|UNCERTAIN",
  "suggestedPearlLevel": "L1|L2|L3 (only if INCORRECT)",
  "trapTypeAssessment": "CORRECT|INCORRECT|UNCERTAIN",
  "suggestedTrapType": "string (only if INCORRECT)",
  "trapSubtypeAssessment": "CORRECT|INCORRECT|UNCERTAIN",
  "suggestedTrapSubtype": "string (only if INCORRECT)",
  "groundTruthAssessment": "CORRECT|INCORRECT|UNCERTAIN",
  "suggestedGroundTruth": "YES|NO|AMBIGUOUS (only if INCORRECT)",
  "hasAmbiguity": boolean,
  "ambiguityNotes": "string describing any ambiguity in scenario/claim",
  "hasLogicalIssues": boolean,
  "logicalIssueNotes": "string describing any logical inconsistencies",
  "hasDomainErrors": boolean,
  "domainErrorNotes": "string describing any factual/domain errors",
  "clarityScore": 1-5,
  "difficultyAssessment": "easy|medium|hard",
  "structuralNotes": "Overall assessment of question structure and quality",
  "causalGraphNotes": "Assessment of causal structure accuracy",
  "variableNotes": "Assessment of X, Y, Z variable assignments",
  "overallVerdict": "APPROVED|NEEDS_REVIEW|REJECTED",
  "suggestedCorrections": "Markdown list of recommended fixes (empty if APPROVED)",
  "priorityLevel": 1-3 (1=urgent fix needed, 2=normal review, 3=minor polish),
  "reportTags": ["array", "of", "tags"]
}

Report tags should include relevant categories like:
- "pearl_level_mismatch", "trap_type_mismatch", "ground_truth_mismatch"
- "ambiguous_scenario", "unclear_claim", "missing_variables"
- "domain_error", "logical_inconsistency", "good_example"
- "needs_stronger_trap", "overcomplicated", "too_simple"`;
}

/**
 * Score a case using the appropriate rubric (L1, L2, or L3)
 */
export async function scoreCaseWithRubric(
  question: QuestionForEvaluation,
  pearlLevel: PearlLevel
): Promise<RubricScore> {
  const rubricPrompt = buildRubricPromptFromQuestion(question, pearlLevel);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RUBRIC_SCORING_SYSTEM_PROMPT },
      { role: 'user', content: rubricPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from rubric scoring agent');
  }

  const parsed = JSON.parse(content) as {
    categoryScores: Record<string, number>;
    categoryNotes: Record<string, string>;
    totalScore: number;
  };

  // Validate and construct RubricScore
  const totalScore = parsed.totalScore;
  const calculatedTotal = Object.values(parsed.categoryScores).reduce(
    (sum, score) => sum + score,
    0
  );

  // Warn if totals don't match, but use the calculated total
  if (Math.abs(totalScore - calculatedTotal) > 0.1) {
    console.warn(
      `Rubric score mismatch: reported ${totalScore}, calculated ${calculatedTotal}`
    );
  }

  // Determine acceptance threshold based on calculated total
  let acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  if (calculatedTotal >= 8) {
    acceptanceThreshold = 'ACCEPT';
  } else if (calculatedTotal >= 6) {
    acceptanceThreshold = 'REVISE';
  } else {
    acceptanceThreshold = 'REJECT';
  }

  // Determine rubric version based on level
  const rubricVersion = `${pearlLevel}-v1.0`;

  return {
    totalScore: calculatedTotal,
    categoryScores: parsed.categoryScores,
    categoryNotes: parsed.categoryNotes,
    acceptanceThreshold,
    rubricVersion,
  };
}

export async function evaluateQuestion(question: QuestionForEvaluation): Promise<EvaluationResult> {
  // Score using rubric
  const pearlLevel = question.pearlLevel as PearlLevel;
  let rubricScore: RubricScore | undefined;
  
  try {
    rubricScore = await scoreCaseWithRubric(question, pearlLevel);
  } catch (error) {
    console.error('Failed to score with rubric:', error);
    // Continue with evaluation even if rubric scoring fails
  }

  // Build legacy evaluation prompt for backward compatibility
  const prompt = buildEvaluationPrompt(question);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from evaluation agent');
  }

  const result = JSON.parse(content) as EvaluationResult;
  
  // Merge rubric score into result
  if (rubricScore) {
    result.rubricScore = rubricScore;
    
    // Update overallVerdict based on rubric if available
    if (rubricScore.acceptanceThreshold === 'ACCEPT') {
      result.overallVerdict = 'APPROVED';
    } else if (rubricScore.acceptanceThreshold === 'REJECT') {
      result.overallVerdict = 'REJECTED';
    } else {
      result.overallVerdict = 'NEEDS_REVIEW';
    }
  }

  return result;
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert evaluator of causal reasoning questions. Your task is to proofread and assess the quality of generated questions for a causal inference training dataset.

You will analyze each question for:
1. **Pearl Level Accuracy**: Is the assigned Pearl level (L1/L2/L3) correct for the claim?
   - L1 (Association): Observational claims like "X is correlated/associated with Y"
   - L2 (Intervention): Causal claims like "X causes Y" or "doing X leads to Y"
   - L3 (Counterfactual): What-if reasoning like "If X had/hadn't happened, Y would..."

2. **Trap Type/Subtype Accuracy**: Does the scenario actually exhibit the labeled trap?

3. **Ground Truth Accuracy**: Is YES/NO/AMBIGUOUS correct for this claim?
   - YES: The claim is causally valid and supported
   - NO: There's a causal fallacy/trap making the claim invalid
   - AMBIGUOUS: Information is insufficient to evaluate the claim

4. **Logical Consistency**: Does the explanation match the scenario and claim?

5. **Domain Accuracy**: Are there factual errors in the domain knowledge?

6. **Clarity**: Is the scenario clear and understandable?

7. **Variable Accuracy**: Are X, Y, Z correctly identified?

Respond with a JSON object containing your assessment.`;

export async function evaluateBatch(
  batchId: string,
  questionIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const total = questionIds.length;

  for (let i = 0; i < total; i++) {
    const questionId = questionIds[i];

    try {
      // Fetch full question
      const question = await prisma.question.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        console.warn(`Question ${questionId} not found, skipping`);
        continue;
      }

      // Run evaluation
      const result = await evaluateQuestion(question);

      // Save evaluation result
      await prisma.caseEvaluation.create({
        data: {
          questionId,
          evaluationBatchId: batchId,
          pearlLevelAssessment: result.pearlLevelAssessment,
          suggestedPearlLevel: result.suggestedPearlLevel,
          trapTypeAssessment: result.trapTypeAssessment,
          suggestedTrapType: result.suggestedTrapType,
          trapSubtypeAssessment: result.trapSubtypeAssessment,
          suggestedTrapSubtype: result.suggestedTrapSubtype,
          groundTruthAssessment: result.groundTruthAssessment,
          suggestedGroundTruth: result.suggestedGroundTruth,
          hasAmbiguity: result.hasAmbiguity,
          ambiguityNotes: result.ambiguityNotes,
          hasLogicalIssues: result.hasLogicalIssues,
          logicalIssueNotes: result.logicalIssueNotes,
          hasDomainErrors: result.hasDomainErrors,
          domainErrorNotes: result.domainErrorNotes,
          clarityScore: result.clarityScore,
          difficultyAssessment: result.difficultyAssessment,
          structuralNotes: result.structuralNotes,
          causalGraphNotes: result.causalGraphNotes,
          variableNotes: result.variableNotes,
          overallVerdict: result.overallVerdict,
          suggestedCorrections: result.suggestedCorrections,
          priorityLevel: result.priorityLevel,
          reportTags: JSON.stringify(result.reportTags || []),
          rubricScore: result.rubricScore ? JSON.stringify(result.rubricScore) : null,
        },
      });

      // Update batch progress
      await prisma.evaluationBatch.update({
        where: { id: batchId },
        data: { completedCount: i + 1 },
      });

      onProgress?.(i + 1, total);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to evaluate question ${questionId}:`, error);
      // Continue with next question
    }
  }

  // Mark batch as completed
  await prisma.evaluationBatch.update({
    where: { id: batchId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });
}

// Helper to generate aggregated report from evaluations
export async function generateReport(evaluationBatchId: string): Promise<string> {
  const evaluations = await prisma.caseEvaluation.findMany({
    where: { evaluationBatchId },
    include: { question: true, l1Case: true, l2Case: true, l3Case: true },
  });

  if (evaluations.length === 0) {
    return '# Evaluation Report\n\nNo evaluations found for this batch.';
  }

  // Parse rubric scores (legacy RubricScore or T3 StoredRubricScore)
  const rubricScores: Array<RubricScore | (Pick<RubricScore, 'totalScore' | 'categoryScores' | 'categoryNotes'> & { acceptanceThreshold?: RubricScore['acceptanceThreshold'] })> = [];
  evaluations.forEach(e => {
    if (e.rubricScore) {
      try {
        const parsed = JSON.parse(e.rubricScore) as Partial<RubricScore> & {
          categoryScores?: Record<string, number>;
          categoryNotes?: Record<string, string>;
          totalScore?: number;
        };

        const totalScore = typeof parsed.totalScore === 'number' ? parsed.totalScore : 0;
        const acceptanceThreshold: RubricScore['acceptanceThreshold'] =
          parsed.acceptanceThreshold ??
          (totalScore >= 8 ? 'ACCEPT' : totalScore >= 6 ? 'REVISE' : 'REJECT');

        rubricScores.push({
          totalScore,
          categoryScores: parsed.categoryScores || {},
          categoryNotes: parsed.categoryNotes || {},
          acceptanceThreshold,
          rubricVersion: parsed.rubricVersion || 'unknown',
        });
      } catch {
        // ignore parse errors
      }
    }
  });

  const getCaseType = (e: (typeof evaluations)[number]): PearlLevel | 'UNKNOWN' => {
    if (e.question?.pearlLevel === 'L1' || e.question?.pearlLevel === 'L2' || e.question?.pearlLevel === 'L3') {
      return e.question.pearlLevel as PearlLevel;
    }
    if (e.l1Case) return 'L1';
    if (e.l2Case) return 'L2';
    if (e.l3Case) return 'L3';
    return 'UNKNOWN';
  };

  const getGroundTruth = (e: (typeof evaluations)[number]): string => {
    return (
      e.question?.groundTruth ??
      e.l1Case?.groundTruth ??
      e.l2Case?.trapType /* L2 has no groundTruth; keep something informative */ ??
      e.l3Case?.groundTruth ??
      'UNKNOWN'
    );
  };

  const getTrapType = (e: (typeof evaluations)[number]): string => {
    return e.question?.trapType ?? e.l2Case?.trapType ?? 'N/A';
  };

  const getSourceCase = (e: (typeof evaluations)[number]): string => {
    return (
      e.question?.sourceCase ??
      e.l1Case?.sourceCase ??
      e.l2Case?.sourceCase ??
      e.l3Case?.sourceCase ??
      e.id.slice(0, 8)
    );
  };

  const getScenario = (e: (typeof evaluations)[number]): string => {
    return e.question?.scenario ?? e.l1Case?.scenario ?? e.l2Case?.scenario ?? e.l3Case?.scenario ?? '';
  };

  // Aggregate statistics
  const stats = {
    total: evaluations.length,
    approved: evaluations.filter(e => e.overallVerdict === 'APPROVED').length,
    needsReview: evaluations.filter(e => e.overallVerdict === 'NEEDS_REVIEW').length,
    rejected: evaluations.filter(e => e.overallVerdict === 'REJECTED').length,
    pearlLevelMismatches: evaluations.filter(e => e.pearlLevelAssessment === 'INCORRECT').length,
    trapTypeMismatches: evaluations.filter(e => e.trapTypeAssessment === 'INCORRECT').length,
    groundTruthMismatches: evaluations.filter(e => e.groundTruthAssessment === 'INCORRECT').length,
    ambiguousCases: evaluations.filter(e => e.hasAmbiguity).length,
    logicalIssues: evaluations.filter(e => e.hasLogicalIssues).length,
    domainErrors: evaluations.filter(e => e.hasDomainErrors).length,
    avgClarity: evaluations.reduce((sum, e) => sum + e.clarityScore, 0) / evaluations.length,
    rubricScored: rubricScores.length,
    avgRubricScore: rubricScores.length > 0
      ? rubricScores.reduce((sum, s) => sum + s.totalScore, 0) / rubricScores.length
      : 0,
    rubricAccept: rubricScores.filter(s => s.acceptanceThreshold === 'ACCEPT').length,
    rubricRevise: rubricScores.filter(s => s.acceptanceThreshold === 'REVISE').length,
    rubricReject: rubricScores.filter(s => s.acceptanceThreshold === 'REJECT').length,
  };

  // Pearl level distribution
  const pearlDist = {
    L1: evaluations.filter(e => getCaseType(e) === 'L1').length,
    L2: evaluations.filter(e => getCaseType(e) === 'L2').length,
    L3: evaluations.filter(e => getCaseType(e) === 'L3').length,
  };

  // Ground truth distribution
  const gtDist = {
    YES: evaluations.filter(e => getGroundTruth(e) === 'YES' || getGroundTruth(e) === 'VALID').length,
    NO: evaluations.filter(e => getGroundTruth(e) === 'NO' || getGroundTruth(e) === 'INVALID').length,
    AMBIGUOUS: evaluations.filter(e => getGroundTruth(e) === 'AMBIGUOUS' || getGroundTruth(e) === 'CONDITIONAL').length,
  };

  // Trap type distribution
  const trapTypes: Record<string, number> = {};
  evaluations.forEach(e => {
    const t = getTrapType(e);
    trapTypes[t] = (trapTypes[t] || 0) + 1;
  });

  // Collect all tags
  const tagCounts: Record<string, number> = {};
  evaluations.forEach(e => {
    try {
      const tags = JSON.parse(e.reportTags || '[]') as string[];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    } catch {
      // ignore
    }
  });

  // Build markdown report
  let report = `# Evaluation Agent Report

**Generated**: ${new Date().toISOString()}
**Total Cases Evaluated**: ${stats.total}

---

## (A) Structural Sanity Check

### Overall Quality Distribution
| Verdict | Count | Percentage |
|---------|-------|------------|
| ✅ Approved | ${stats.approved} | ${(stats.approved / stats.total * 100).toFixed(1)}% |
| ⚠️ Needs Review | ${stats.needsReview} | ${(stats.needsReview / stats.total * 100).toFixed(1)}% |
| ❌ Rejected | ${stats.rejected} | ${(stats.rejected / stats.total * 100).toFixed(1)}% |

### Pearl Level Distribution
| Level | Count | Percentage |
|-------|-------|------------|
| L1 (Association) | ${pearlDist.L1} | ${(pearlDist.L1 / stats.total * 100).toFixed(1)}% |
| L2 (Intervention) | ${pearlDist.L2} | ${(pearlDist.L2 / stats.total * 100).toFixed(1)}% |
| L3 (Counterfactual) | ${pearlDist.L3} | ${(pearlDist.L3 / stats.total * 100).toFixed(1)}% |

### Ground Truth Distribution
| Answer | Count | Percentage |
|--------|-------|------------|
| YES | ${gtDist.YES} | ${(gtDist.YES / stats.total * 100).toFixed(1)}% |
| NO | ${gtDist.NO} | ${(gtDist.NO / stats.total * 100).toFixed(1)}% |
| AMBIGUOUS | ${gtDist.AMBIGUOUS} | ${(gtDist.AMBIGUOUS / stats.total * 100).toFixed(1)}% |

### Trap Type Coverage
| Trap Type | Count |
|-----------|-------|
${Object.entries(trapTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => `| ${type} | ${count} |`).join('\n')}

### Label Accuracy Issues
| Issue Type | Count | Percentage |
|------------|-------|------------|
| Pearl Level Mismatches | ${stats.pearlLevelMismatches} | ${(stats.pearlLevelMismatches / stats.total * 100).toFixed(1)}% |
| Trap Type Mismatches | ${stats.trapTypeMismatches} | ${(stats.trapTypeMismatches / stats.total * 100).toFixed(1)}% |
| Ground Truth Mismatches | ${stats.groundTruthMismatches} | ${(stats.groundTruthMismatches / stats.total * 100).toFixed(1)}% |

### Quality Issues
| Issue Type | Count | Percentage |
|------------|-------|------------|
| Ambiguous Scenarios | ${stats.ambiguousCases} | ${(stats.ambiguousCases / stats.total * 100).toFixed(1)}% |
| Logical Issues | ${stats.logicalIssues} | ${(stats.logicalIssues / stats.total * 100).toFixed(1)}% |
| Domain Errors | ${stats.domainErrors} | ${(stats.domainErrors / stats.total * 100).toFixed(1)}% |

**Average Clarity Score**: ${stats.avgClarity.toFixed(2)} / 5.0

---

## (B) Rubric-Based Quality Scoring

${stats.rubricScored > 0 ? `
### Rubric Score Statistics
- **Cases Scored**: ${stats.rubricScored} / ${stats.total} (${(stats.rubricScored / stats.total * 100).toFixed(1)}%)
- **Average Rubric Score**: ${stats.avgRubricScore.toFixed(2)} / 10.0

### Rubric Acceptance Thresholds
| Threshold | Count | Percentage |
|-----------|-------|------------|
| ✅ ACCEPT (8-10) | ${stats.rubricAccept} | ${(stats.rubricAccept / stats.rubricScored * 100).toFixed(1)}% |
| ⚠️ REVISE (6-7) | ${stats.rubricRevise} | ${(stats.rubricRevise / stats.rubricScored * 100).toFixed(1)}% |
| ❌ REJECT (≤5) | ${stats.rubricReject} | ${(stats.rubricReject / stats.rubricScored * 100).toFixed(1)}% |

### Category-Level Breakdown (L1 Rubric)
${(() => {
  if (rubricScores.length === 0) return '_No rubric scores available._';
  
  const categories = [
    'scenarioClarity',
    'causalClaimExplicitness',
    'wiseRefusalQuality',
    'groundTruthUnambiguity',
    'difficultyCalibration',
    'domainPlausibility',
    'noiseDiscipline',
    'hiddenQuestionQuality',
    'conditionalAnswerA',
    'conditionalAnswerB',
    'selfContained',
    'clarity',
    'correctness',
    'familyFit',
    'novelty',
    'realism'
  ];
  const categoryStats: Record<string, { total: number; count: number; avg: number }> = {};
  
  categories.forEach(cat => {
    categoryStats[cat] = { total: 0, count: 0, avg: 0 };
  });
  
  rubricScores.forEach(score => {
    Object.entries(score.categoryScores).forEach(([cat, points]) => {
      if (categoryStats[cat]) {
        categoryStats[cat].total += points;
        categoryStats[cat].count += 1;
      }
    });
  });
  
  Object.keys(categoryStats).forEach(cat => {
    if (categoryStats[cat].count > 0) {
      categoryStats[cat].avg = categoryStats[cat].total / categoryStats[cat].count;
    }
  });
  
  const maxPoints: Record<string, number> = {
    scenarioClarity: 2,
    causalClaimExplicitness: 1,
    wiseRefusalQuality: 2,
    groundTruthUnambiguity: 2,
    difficultyCalibration: 1,
    domainPlausibility: 1,
    noiseDiscipline: 1,
    hiddenQuestionQuality: 2,
    conditionalAnswerA: 1.5,
    conditionalAnswerB: 1.5,
    selfContained: 2,
    clarity: 2,
    correctness: 2,
    familyFit: 1.5,
    novelty: 1.5,
    realism: 1,
  };
  
  const categoryLabels: Record<string, string> = {
    scenarioClarity: 'Scenario Clarity',
    causalClaimExplicitness: 'Causal Claim Explicitness',
    wiseRefusalQuality: 'Wise Refusal Quality',
    groundTruthUnambiguity: 'Ground Truth Unambiguity',
    difficultyCalibration: 'Difficulty Calibration',
    domainPlausibility: 'Domain Plausibility',
    noiseDiscipline: 'Noise Discipline',
    hiddenQuestionQuality: 'Hidden Question Quality',
    conditionalAnswerA: 'Conditional Answer A',
    conditionalAnswerB: 'Conditional Answer B',
    selfContained: 'Self-Contained',
    clarity: 'Clarity of Variables',
    correctness: 'Counterfactual Correctness',
    familyFit: 'Family Fit',
    novelty: 'Novelty',
    realism: 'Realism',
  };
  
  return `| Category | Avg Score | Max Points | Performance |
|----------|-----------|------------|-------------|
${categories.filter(cat => categoryStats[cat].count > 0).map(cat => {
  const stats = categoryStats[cat];
  const max = maxPoints[cat] || 1;
  const pct = (stats.avg / max * 100).toFixed(1);
  const performance = stats.avg >= max * 0.8 ? '✅' : stats.avg >= max * 0.6 ? '⚠️' : '❌';
  return `| ${categoryLabels[cat]} | ${stats.avg.toFixed(2)} | ${max} | ${performance} ${pct}% |`;
}).join('\n')}`;
})()}
` : `
_No rubric scores available for this batch._
`}

---

## (C) Issue Tags Distribution

${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => `- **${tag}**: ${count} cases`).join('\n')}

---

## (D) Cases Needing Attention

### Priority 1 (Urgent)
`;

  const urgent = evaluations.filter(e => e.priorityLevel === 1);
  if (urgent.length === 0) {
    report += '_No urgent issues found._\n\n';
  } else {
    urgent.forEach(e => {
      report += `#### Case: ${getSourceCase(e)}\n`;
      report += `- **Scenario**: ${getScenario(e).slice(0, 100)}...\n`;
      report += `- **Issues**: ${e.suggestedCorrections || e.structuralNotes}\n\n`;
    });
  }

  report += `### Priority 2 (Normal Review)\n`;
  const normal = evaluations.filter(e => e.priorityLevel === 2 && e.overallVerdict !== 'APPROVED');
  report += `_${normal.length} cases need standard review._\n\n`;

  report += `---

## (D) Seed → Scale Justification

Based on this evaluation:

1. **Structural Richness**: The dataset covers ${Object.keys(trapTypes).length} distinct trap types across all 3 Pearl levels.

2. **Sample Size Concerns**: With ${stats.total} cases, statistical stability for any single (Level × Trap × GroundTruth) cell is limited. Current cell sizes:
`;

  // Calculate cell sizes
  const cells: Record<string, number> = {};
  evaluations.forEach(e => {
    const key = `${getCaseType(e)}-${getGroundTruth(e)}`;
    cells[key] = (cells[key] || 0) + 1;
  });
  Object.entries(cells).forEach(([key, count]) => {
    report += `   - ${key}: ${count} cases\n`;
  });

  report += `
3. **Expansion Recommendation**: For stable statistics (e.g., 30+ per cell for confidence intervals), controlled expansion is necessary. Current issues rate of ${((stats.needsReview + stats.rejected) / stats.total * 100).toFixed(1)}% suggests generation quality is ${stats.approved / stats.total > 0.7 ? 'acceptable for scaling' : 'needs improvement before scaling'}.

---

## (F) Recommendations

${stats.pearlLevelMismatches > stats.total * 0.1
  ? '- ⚠️ High Pearl level mismatch rate suggests generation prompts need refinement\n'
  : '- ✅ Pearl level accuracy is good\n'}
${stats.trapTypeMismatches > stats.total * 0.1
  ? '- ⚠️ High trap type mismatch rate - review trap definitions in prompts\n'
  : '- ✅ Trap type accuracy is good\n'}
${stats.groundTruthMismatches > stats.total * 0.1
  ? '- ⚠️ Ground truth accuracy issues - claims may not clearly reflect intended answers\n'
  : '- ✅ Ground truth labels are consistent\n'}
${stats.ambiguousCases > stats.total * 0.2
  ? '- ⚠️ Many ambiguous scenarios - consider tightening scenario constraints\n'
  : '- ✅ Scenario clarity is acceptable\n'}

---

_Report generated by Evaluation Agent_
`;

  // Save report to batch
  await prisma.evaluationBatch.update({
    where: { id: evaluationBatchId },
    data: {
      reportGenerated: true,
      reportContent: report,
    },
  });

  return report;
}

