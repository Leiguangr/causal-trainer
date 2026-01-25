import { prisma } from './prisma';
import type { RubricScore } from './rubric-prompts';
import type { PearlLevel } from '@/types';

// Helper to generate aggregated report from evaluations
// This function works with both legacy Question evaluations and T3 case evaluations
export async function generateReport(evaluationBatchId: string): Promise<string> {
  const evaluations = await prisma.caseEvaluation.findMany({
    where: { evaluationBatchId },
    include: { question: true, l1Case: true, l2Case: true, l3Case: true },
  });

  if (evaluations.length === 0) {
    return '# Evaluation Report\n\nNo evaluations found for this batch.';
  }

  // Parse rubric scores (T3 StoredRubricScore format)
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

### Category-Level Breakdown
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

## (E) Seed → Scale Justification

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
