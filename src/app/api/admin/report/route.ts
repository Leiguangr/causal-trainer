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

    if (!batch.reportGenerated || !batch.reportContent) {
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
      return new NextResponse(batch.reportContent, {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    return NextResponse.json({ report: batch.reportContent });
  }

  // If dataset is provided, generate an aggregate report for all evaluations in that dataset
  if (dataset) {
    const evaluations = await prisma.caseEvaluation.findMany({
      where: {
        question: { dataset },
      },
      include: { question: true },
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
    questionId: string;
    pearlLevelAssessment: string | null;
    trapTypeAssessment: string | null;
    groundTruthAssessment: string | null;
    hasAmbiguity: boolean;
    hasLogicalIssues: boolean;
    hasDomainErrors: boolean;
    clarityScore: number;
    overallVerdict: string;
    priorityLevel: number;
    reportTags: string | null;
    suggestedCorrections: string | null;
    structuralNotes: string | null;
    question: {
      sourceCase: string | null;
      scenario: string;
      pearlLevel: string;
      groundTruth: string;
      trapType: string;
    };
  }>,
  datasetName: string
): string {
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

  const pearlDist = {
    L1: evaluations.filter(e => e.question.pearlLevel === 'L1').length,
    L2: evaluations.filter(e => e.question.pearlLevel === 'L2').length,
    L3: evaluations.filter(e => e.question.pearlLevel === 'L3').length,
  };

  const gtDist = {
    YES: evaluations.filter(e => e.question.groundTruth === 'YES').length,
    NO: evaluations.filter(e => e.question.groundTruth === 'NO').length,
    AMBIGUOUS: evaluations.filter(e => e.question.groundTruth === 'AMBIGUOUS').length,
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

_Report generated by Evaluation Agent_`;
}

