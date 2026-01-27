import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateReport } from '@/lib/evaluation-agent';

// GET - Get report for an evaluation batch or generate one for a dataset
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const evaluationBatchId = searchParams.get('evaluationBatchId');
  const dataset = searchParams.get('dataset');
  const format = searchParams.get('format') || 'markdown';

  // If evaluationBatchId is provided, get that report
  if (evaluationBatchId) {
    const batch = await prisma.evaluationBatch.findUnique({
      where: { id: evaluationBatchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Evaluation batch not found' }, { status: 404 });
    }

    if (!batch.report_generated || !batch.report_content) {
      // Generate report now if not already generated
      const report = await generateReport(evaluationBatchId);
      
      if (format === 'text') {
        return new NextResponse(report, {
          headers: { 'Content-Type': 'text/markdown' },
        });
      }
      
      return NextResponse.json({ report });
    }

    if (format === 'text') {
      return new NextResponse(batch.report_content, {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    return NextResponse.json({ report: batch.report_content });
  }

  // If dataset is provided, generate an aggregate report for all evaluations in that dataset
  if (dataset) {
    const evaluations = await prisma.caseEvaluation.findMany({
      where: {
        OR: [
          { question: { dataset } },
          { t3_case: { dataset } },
        ],
      },
      include: { question: true, t3_case: true },
    });

    if (evaluations.length === 0) {
      return NextResponse.json({
        error: `No evaluations found for dataset "${dataset}". Run evaluation first.`,
      }, { status: 404 });
    }

    // Generate ad-hoc report from these evaluations
    const report = generateAdhocReport(evaluations, dataset);

    if (format === 'text') {
      return new NextResponse(report, {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    return NextResponse.json({ report, evaluationCount: evaluations.length });
  }

  return NextResponse.json({
    error: 'Either evaluationBatchId or dataset is required',
  }, { status: 400 });
}

// Helper to generate report from any set of evaluations
function generateAdhocReport(
  evaluations: Array<{
    pearl_level_assessment: string | null;
    trap_type_assessment: string | null;
    ground_truth_assessment: string | null;
    has_ambiguity: boolean;
    has_logical_issues: boolean;
    has_domain_errors: boolean;
    clarity_score: number;
    overall_verdict: string;
    priority_level: number;
    report_tags: string | null;
    suggested_corrections: string | null;
    structural_notes: string | null;
    rubric_score: string | null;
    question: {
      source_case: string | null;
      scenario: string;
      pearl_level: string;
      ground_truth: string;
      trap_type: string;
      dataset: string;
    } | null;
    t3_case: { 
      source_case: string | null; 
      scenario: string; 
      label: string; 
      trap_type: string;
      pearl_level: string;
      dataset: string 
    } | null;
  }>,
  datasetName: string
): string {
  const getCaseType = (e: (typeof evaluations)[number]) => {
    if (e.question?.pearl_level) return e.question.pearl_level;
    if (e.t3_case?.pearl_level) return e.t3_case.pearl_level;
    return 'UNKNOWN';
  };

  const getGroundTruth = (e: (typeof evaluations)[number]) => {
    return e.question?.ground_truth ?? e.t3_case?.label ?? 'UNKNOWN';
  };

  const rubricTotals: number[] = [];
  evaluations.forEach(e => {
    if (!e.rubric_score) return;
    try {
      const parsed = JSON.parse(e.rubric_score) as { totalScore?: number };
      if (typeof parsed.totalScore === 'number') rubricTotals.push(parsed.totalScore);
    } catch {
      // ignore
    }
  });

  const stats = {
    total: evaluations.length,
    approved: evaluations.filter(e => e.overall_verdict === 'APPROVED').length,
    needsReview: evaluations.filter(e => e.overall_verdict === 'NEEDS_REVIEW').length,
    rejected: evaluations.filter(e => e.overall_verdict === 'REJECTED').length,
    pearlLevelMismatches: evaluations.filter(e => e.pearl_level_assessment === 'INCORRECT').length,
    trapTypeMismatches: evaluations.filter(e => e.trap_type_assessment === 'INCORRECT').length,
    groundTruthMismatches: evaluations.filter(e => e.ground_truth_assessment === 'INCORRECT').length,
    ambiguousCases: evaluations.filter(e => e.has_ambiguity).length,
    logicalIssues: evaluations.filter(e => e.has_logical_issues).length,
    domainErrors: evaluations.filter(e => e.has_domain_errors).length,
    avgClarity: evaluations.reduce((sum, e) => sum + e.clarity_score, 0) / evaluations.length,
    rubricScored: rubricTotals.length,
    avgRubric: rubricTotals.length ? rubricTotals.reduce((a, b) => a + b, 0) / rubricTotals.length : 0,
  };

  const pearlDist = {
    L1: evaluations.filter(e => getCaseType(e) === 'L1').length,
    L2: evaluations.filter(e => getCaseType(e) === 'L2').length,
    L3: evaluations.filter(e => getCaseType(e) === 'L3').length,
  };

  const gtDist = {
    YES: evaluations.filter(e => getGroundTruth(e) === 'YES' || getGroundTruth(e) === 'VALID').length,
    NO: evaluations.filter(e => getGroundTruth(e) === 'NO' || getGroundTruth(e) === 'INVALID').length,
    AMBIGUOUS: evaluations.filter(e => getGroundTruth(e) === 'AMBIGUOUS' || getGroundTruth(e) === 'CONDITIONAL').length,
  };

  return `# Dataset Evaluation Report: ${datasetName}

**Generated**: ${new Date().toISOString()}
**Total Cases**: ${stats.total}

## Summary

| Metric | Value |
|--------|-------|
| Approved | ${stats.approved} (${(stats.approved/stats.total*100).toFixed(1)}%) |
| Needs Review | ${stats.needsReview} (${(stats.needsReview/stats.total*100).toFixed(1)}%) |
| Rejected | ${stats.rejected} (${(stats.rejected/stats.total*100).toFixed(1)}%) |

## Distribution

**Pearl Level**: L1=${pearlDist.L1}, L2=${pearlDist.L2}, L3=${pearlDist.L3}
**Ground Truth**: YES=${gtDist.YES}, NO=${gtDist.NO}, AMBIGUOUS=${gtDist.AMBIGUOUS}

## Issues

- Pearl Level Mismatches: ${stats.pearlLevelMismatches}
- Trap Type Mismatches: ${stats.trapTypeMismatches}
- Ground Truth Mismatches: ${stats.groundTruthMismatches}
- Ambiguous Scenarios: ${stats.ambiguousCases}
- Logical Issues: ${stats.logicalIssues}
- Domain Errors: ${stats.domainErrors}

## Rubric

- Scored: ${stats.rubricScored} / ${stats.total}
- Avg totalScore: ${stats.avgRubric.toFixed(2)}

_Report generated by Evaluation Agent_`;
}

