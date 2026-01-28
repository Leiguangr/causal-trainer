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

    if (evaluationBatchId) where.evaluation_batch_id = evaluationBatchId;
    if (caseType === 'legacy') where.question_id = { not: null };
    if (caseType === 'L1') where.t3_case_id = { not: null };
    if (caseType === 'L2') where.t3_case_id = { not: null };
    if (caseType === 'L3') where.t3_case_id = { not: null };

    if (dataset) {
      where.OR = [
        { evaluation_batch: { is: { dataset } } },
        { question: { is: { dataset } } },
        { t3_case: { is: { dataset } } },
      ];
    }

    // Get all evaluations with related data
    const evaluations = await prisma.caseEvaluation.findMany({
      where,
      include: {
        evaluation_batch: true,
        question: true,
        t3_case: true,
      },
    });

    const total = evaluations.length;

    // Verdict breakdown
    const verdictCounts = {
      APPROVED: evaluations.filter(e => e.overall_verdict === 'APPROVED').length,
      NEEDS_REVIEW: evaluations.filter(e => e.overall_verdict === 'NEEDS_REVIEW').length,
      REJECTED: evaluations.filter(e => e.overall_verdict === 'REJECTED').length,
    };

    // Priority breakdown
    const priorityCounts = {
      urgent: evaluations.filter(e => e.priority_level === 1).length,
      normal: evaluations.filter(e => e.priority_level === 2).length,
      minor: evaluations.filter(e => e.priority_level === 3).length,
    };

    // Case type breakdown
    const caseTypeCounts = {
      legacy: evaluations.filter(e => e.question_id).length,
      L1: evaluations.filter(e => e.t3_case?.pearl_level === 'L1').length,
      L2: evaluations.filter(e => e.t3_case?.pearl_level === 'L2').length,
      L3: evaluations.filter(e => e.t3_case?.pearl_level === 'L3').length,
    };

    // Quality flags
    const qualityFlags = {
      hasAmbiguity: evaluations.filter(e => e.has_ambiguity).length,
      hasLogicalIssues: evaluations.filter(e => e.has_logical_issues).length,
      hasDomainErrors: evaluations.filter(e => e.has_domain_errors).length,
    };

    // Clarity score distribution
    const clarityScores = evaluations.map(e => e.clarity_score);
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
        CORRECT: evaluations.filter(e => e.pearl_level_assessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.pearl_level_assessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.pearl_level_assessment === 'UNCERTAIN').length,
      },
      trapType: {
        CORRECT: evaluations.filter(e => e.trap_type_assessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.trap_type_assessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.trap_type_assessment === 'UNCERTAIN').length,
      },
      groundTruth: {
        CORRECT: evaluations.filter(e => e.ground_truth_assessment === 'CORRECT').length,
        INCORRECT: evaluations.filter(e => e.ground_truth_assessment === 'INCORRECT').length,
        UNCERTAIN: evaluations.filter(e => e.ground_truth_assessment === 'UNCERTAIN').length,
      },
    };

    // Rubric score analysis
    const rubricScores: number[] = [];
    const rubricThresholds: Record<string, number> = {};
    const rubricVersions: Record<string, number> = {};

    evaluations.forEach(e => {
      if (e.rubric_score) {
        const rubric = safeJsonParse<RubricScore>(e.rubric_score);
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
      const ds = e.evaluation_batch?.dataset || 
                 e.question?.dataset || 
                 e.t3_case?.dataset || 
                 'unknown';
      datasetCounts[ds] = (datasetCounts[ds] || 0) + 1;
    });

    // Time series (by day)
    const timeSeries: Record<string, number> = {};
    evaluations.forEach(e => {
      const date = new Date(e.created_at).toISOString().split('T')[0];
      timeSeries[date] = (timeSeries[date] || 0) + 1;
    });

    // Evaluation batch breakdown
    const batchCounts: Record<string, { count: number; dataset: string | null; status: string }> = {};
    evaluations.forEach(e => {
      if (e.evaluation_batch_id) {
        const batchId = e.evaluation_batch_id;
        if (!batchCounts[batchId]) {
          batchCounts[batchId] = {
            count: 0,
            dataset: e.evaluation_batch?.dataset || null,
            status: e.evaluation_batch?.status || 'unknown',
          };
        }
        batchCounts[batchId].count++;
      }
    });

    // Label distribution (by case type)
    const labelDistribution: Record<string, Record<string, number>> = {
      L1: { YES: 0, NO: 0, AMBIGUOUS: 0 },
      L2: { NO: 0 },
      L3: { VALID: 0, INVALID: 0, CONDITIONAL: 0 },
      legacy: { YES: 0, NO: 0, AMBIGUOUS: 0, VALID: 0, INVALID: 0, CONDITIONAL: 0 },
    };
    evaluations.forEach(e => {
      if (e.t3_case) {
        const level = e.t3_case.pearl_level;
        const label = e.t3_case.label;
        if (level && labelDistribution[level] && labelDistribution[level][label] !== undefined) {
          labelDistribution[level][label]++;
        }
      } else if (e.question) {
        const gt = e.question.ground_truth;
        if (gt && labelDistribution.legacy[gt] !== undefined) {
          labelDistribution.legacy[gt]++;
        }
      }
    });

    // Trap type distribution (by case type)
    const trapTypeDistribution: Record<string, Record<string, number>> = {
      L1: {},
      L2: {},
      L3: {},
      legacy: {},
    };
    evaluations.forEach(e => {
      if (e.t3_case) {
        const level = e.t3_case.pearl_level;
        const trapType = e.t3_case.trap_type;
        if (level && trapType) {
          trapTypeDistribution[level][trapType] = (trapTypeDistribution[level][trapType] || 0) + 1;
        }
      } else if (e.question) {
        const trapType = e.question.trap_type;
        if (trapType) {
          trapTypeDistribution.legacy[trapType] = (trapTypeDistribution.legacy[trapType] || 0) + 1;
        }
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
      labelDistribution,
      trapTypeDistribution,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Grading stats API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load stats' },
      { status: 500 }
    );
  }
}
