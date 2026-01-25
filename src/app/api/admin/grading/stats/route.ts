import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

interface RubricScore {
  totalScore?: number;
  acceptanceThreshold?: string;
  rubricVersion?: string;
  categoryScores?: Record<string, number>;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get('dataset') || '';
    const evaluationBatchId = searchParams.get('evaluationBatchId') || '';
    const caseType = searchParams.get('caseType') || 'all';

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (evaluationBatchId) where.evaluationBatchId = evaluationBatchId;
    if (caseType === 'legacy') where.questionId = { not: null };
    if (caseType === 'L1') where.l1CaseId = { not: null };
    if (caseType === 'L2') where.l2CaseId = { not: null };
    if (caseType === 'L3') where.l3CaseId = { not: null };

    if (dataset) {
      where.OR = [
        { evaluationBatch: { is: { dataset } } },
        { question: { is: { dataset } } },
        { l1Case: { is: { dataset } } },
        { l2Case: { is: { dataset } } },
        { l3Case: { is: { dataset } } },
      ];
    }

    // Get all evaluations with related data
    const evaluations = await prisma.caseEvaluation.findMany({
      where,
      include: {
        evaluationBatch: true,
        question: true,
        l1Case: true,
        l2Case: true,
        l3Case: true,
      },
    });

    const total = evaluations.length;

    // Verdict breakdown
    const verdictCounts = {
      APPROVED: evaluations.filter(e => e.overallVerdict === 'APPROVED').length,
      NEEDS_REVIEW: evaluations.filter(e => e.overallVerdict === 'NEEDS_REVIEW').length,
      REJECTED: evaluations.filter(e => e.overallVerdict === 'REJECTED').length,
    };

    // Priority breakdown
    const priorityCounts = {
      urgent: evaluations.filter(e => e.priorityLevel === 1).length,
      normal: evaluations.filter(e => e.priorityLevel === 2).length,
      minor: evaluations.filter(e => e.priorityLevel === 3).length,
    };

    // Case type breakdown
    const caseTypeCounts = {
      legacy: evaluations.filter(e => e.questionId).length,
      L1: evaluations.filter(e => e.l1CaseId).length,
      L2: evaluations.filter(e => e.l2CaseId).length,
      L3: evaluations.filter(e => e.l3CaseId).length,
    };

    // Quality flags
    const qualityFlags = {
      hasAmbiguity: evaluations.filter(e => e.hasAmbiguity).length,
      hasLogicalIssues: evaluations.filter(e => e.hasLogicalIssues).length,
      hasDomainErrors: evaluations.filter(e => e.hasDomainErrors).length,
    };

    // Clarity score distribution
    const clarityScores = evaluations.map(e => e.clarityScore);
    const avgClarity = clarityScores.length > 0
      ? clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length
      : 0;
    const clarityDistribution = {
      1: clarityScores.filter(s => s === 1).length,
      2: clarityScores.filter(s => s === 2).length,
      3: clarityScores.filter(s => s === 3).length,
      4: clarityScores.filter(s => s === 4).length,
      5: clarityScores.filter(s => s === 5).length,
    };

    // Assessment accuracy (CORRECT vs INCORRECT vs UNCERTAIN)
    const assessments = {
      pearlLevel: {
        CORRECT: evaluations.filter(e => e.pearlLevelAssessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.pearlLevelAssessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.pearlLevelAssessment === 'UNCERTAIN').length,
      },
      trapType: {
        CORRECT: evaluations.filter(e => e.trapTypeAssessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.trapTypeAssessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.trapTypeAssessment === 'UNCERTAIN').length,
      },
      groundTruth: {
        CORRECT: evaluations.filter(e => e.groundTruthAssessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.groundTruthAssessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.groundTruthAssessment === 'UNCERTAIN').length,
      },
    };

    // Rubric score analysis
    const rubricScores: number[] = [];
    const rubricThresholds: Record<string, number> = {};
    const rubricVersions: Record<string, number> = {};

    evaluations.forEach(e => {
      if (e.rubricScore) {
        const rubric = safeJsonParse<RubricScore>(e.rubricScore);
        if (rubric?.totalScore !== undefined) {
          rubricScores.push(rubric.totalScore);
        }
        if (rubric?.acceptanceThreshold) {
          rubricThresholds[rubric.acceptanceThreshold] = (rubricThresholds[rubric.acceptanceThreshold] || 0) + 1;
        }
        if (rubric?.rubricVersion) {
          rubricVersions[rubric.rubricVersion] = (rubricVersions[rubric.rubricVersion] || 0) + 1;
        }
      }
    });

    const avgRubricScore = rubricScores.length > 0
      ? rubricScores.reduce((a, b) => a + b, 0) / rubricScores.length
      : null;
    const minRubricScore = rubricScores.length > 0 ? Math.min(...rubricScores) : null;
    const maxRubricScore = rubricScores.length > 0 ? Math.max(...rubricScores) : null;

    // Rubric score distribution (buckets)
    const rubricDistribution = {
      '0-20': rubricScores.filter(s => s >= 0 && s < 20).length,
      '20-40': rubricScores.filter(s => s >= 20 && s < 40).length,
      '40-60': rubricScores.filter(s => s >= 40 && s < 60).length,
      '60-80': rubricScores.filter(s => s >= 60 && s < 80).length,
      '80-100': rubricScores.filter(s => s >= 80 && s <= 100).length,
    };

    // Dataset breakdown
    const datasetCounts: Record<string, number> = {};
    evaluations.forEach(e => {
      const ds = e.evaluationBatch?.dataset || 
                 e.question?.dataset || 
                 e.l1Case?.dataset || 
                 e.l2Case?.dataset || 
                 e.l3Case?.dataset || 
                 'unknown';
      datasetCounts[ds] = (datasetCounts[ds] || 0) + 1;
    });

    // Time series (by day)
    const timeSeries: Record<string, number> = {};
    evaluations.forEach(e => {
      const date = new Date(e.createdAt).toISOString().split('T')[0];
      timeSeries[date] = (timeSeries[date] || 0) + 1;
    });

    // Evaluation batch breakdown
    const batchCounts: Record<string, { count: number; dataset: string | null; status: string }> = {};
    evaluations.forEach(e => {
      if (e.evaluationBatchId) {
        const batchId = e.evaluationBatchId;
        if (!batchCounts[batchId]) {
          batchCounts[batchId] = {
            count: 0,
            dataset: e.evaluationBatch?.dataset || null,
            status: e.evaluationBatch?.status || 'unknown',
          };
        }
        batchCounts[batchId].count++;
      }
    });

    return NextResponse.json({
      total,
      verdictCounts,
      priorityCounts,
      caseTypeCounts,
      qualityFlags,
      clarity: {
        average: avgClarity,
        distribution: clarityDistribution,
      },
      assessments,
      rubric: {
        average: avgRubricScore,
        min: minRubricScore,
        max: maxRubricScore,
        distribution: rubricDistribution,
        thresholds: rubricThresholds,
        versions: rubricVersions,
        totalWithRubric: rubricScores.length,
      },
      datasetCounts,
      timeSeries,
      batchCounts,
    });
  } catch (error) {
    console.error('Grading stats API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load stats' },
      { status: 500 }
    );
  }
}
