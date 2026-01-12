import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QuestionForEvaluation {
  id: string;
  scenario: string;
  claim: string;
  pearlLevel: string;
  domain: string;
  subdomain?: string | null;
  trapType: string;
  trapSubtype: string;
  groundTruth: string;
  explanation: string;
  variables?: string | null;
  causalStructure?: string | null;
  keyInsight?: string | null;
  wiseRefusal?: string | null;
}

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

export async function evaluateQuestion(question: QuestionForEvaluation): Promise<EvaluationResult> {
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
  return result;
}

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
    include: { question: true },
  });

  if (evaluations.length === 0) {
    return '# Evaluation Report\n\nNo evaluations found for this batch.';
  }

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
  };

  // Pearl level distribution
  const pearlDist = {
    L1: evaluations.filter(e => e.question.pearlLevel === 'L1').length,
    L2: evaluations.filter(e => e.question.pearlLevel === 'L2').length,
    L3: evaluations.filter(e => e.question.pearlLevel === 'L3').length,
  };

  // Ground truth distribution
  const gtDist = {
    YES: evaluations.filter(e => e.question.groundTruth === 'YES').length,
    NO: evaluations.filter(e => e.question.groundTruth === 'NO').length,
    AMBIGUOUS: evaluations.filter(e => e.question.groundTruth === 'AMBIGUOUS').length,
  };

  // Trap type distribution
  const trapTypes: Record<string, number> = {};
  evaluations.forEach(e => {
    trapTypes[e.question.trapType] = (trapTypes[e.question.trapType] || 0) + 1;
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

## (B) Issue Tags Distribution

${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => `- **${tag}**: ${count} cases`).join('\n')}

---

## (C) Cases Needing Attention

### Priority 1 (Urgent)
`;

  const urgent = evaluations.filter(e => e.priorityLevel === 1);
  if (urgent.length === 0) {
    report += '_No urgent issues found._\n\n';
  } else {
    urgent.forEach(e => {
      report += `#### Case: ${e.question.sourceCase || e.questionId.slice(0, 8)}\n`;
      report += `- **Scenario**: ${e.question.scenario.slice(0, 100)}...\n`;
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
    const key = `${e.question.pearlLevel}-${e.question.groundTruth}`;
    cells[key] = (cells[key] || 0) + 1;
  });
  Object.entries(cells).forEach(([key, count]) => {
    report += `   - ${key}: ${count} cases\n`;
  });

  report += `
3. **Expansion Recommendation**: For stable statistics (e.g., 30+ per cell for confidence intervals), controlled expansion is necessary. Current issues rate of ${((stats.needsReview + stats.rejected) / stats.total * 100).toFixed(1)}% suggests generation quality is ${stats.approved / stats.total > 0.7 ? 'acceptable for scaling' : 'needs improvement before scaling'}.

---

## (E) Recommendations

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

