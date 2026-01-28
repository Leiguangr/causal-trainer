import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parseIntParam(x: string | null, fallback: number): number {
  const n = x ? Number.parseInt(x, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const dataset = searchParams.get('dataset') || '';
    const evaluationBatchId = searchParams.get('evaluationBatchId') || '';
    const overallVerdict = searchParams.get('overallVerdict') || '';
    const priorityLevel = searchParams.get('priorityLevel') || '';
    const caseType = searchParams.get('caseType') || 'all'; // legacy|L1|L2|L3|all
    const sortBy = searchParams.get('sortBy') || 'priority'; // priority|caseType|created
    const sortOrder = searchParams.get('sortOrder') || 'asc'; // asc|desc

    const page = Math.max(1, parseIntParam(searchParams.get('page'), 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseIntParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE))
    );

    const batches = await prisma.evaluationBatch.findMany({
      where: dataset ? { dataset } : undefined,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (evaluationBatchId) where.evaluation_batch_id = evaluationBatchId;
    if (overallVerdict) where.overall_verdict = overallVerdict;
    if (priorityLevel) where.priority_level = Number.parseInt(priorityLevel, 10);

    if (caseType === 'legacy') {
      where.question_id = { not: null };
    } else if (caseType === 'L1') {
      where.t3_case_id = { not: null };
      where.t3_case = { pearl_level: 'L1' };
    } else if (caseType === 'L2') {
      where.t3_case_id = { not: null };
      where.t3_case = { pearl_level: 'L2' };
    } else if (caseType === 'L3') {
      where.t3_case_id = { not: null };
      where.t3_case = { pearl_level: 'L3' };
    }

    if (dataset) {
      // Support cases where EvaluationBatch.dataset might be null (e.g., all-dataset runs),
      // by filtering on the underlying case dataset as well.
      // If we already have a t3_case filter, we need to combine it with the dataset filter
      if (where.t3_case) {
        const existingT3CaseFilter = where.t3_case;
        where.t3_case = {
          ...existingT3CaseFilter,
          dataset,
        };
        // Also allow dataset match via evaluation_batch or question
        where.OR = [
          { evaluation_batch: { is: { dataset } } },
          { question: { is: { dataset } } },
        ];
      } else {
        where.OR = [
          { evaluation_batch: { is: { dataset } } },
          { question: { is: { dataset } } },
          { t3_case: { is: { dataset } } },
        ];
      }
    }

    // Build orderBy clause based on sortBy parameter
    let orderBy: any[] = [];
    if (sortBy === 'caseType') {
      // Sort by case type: legacy first, then L1, L2, L3
      // We'll need to handle this in a custom way since Prisma doesn't support conditional ordering easily
      orderBy = [{ created_at: sortOrder === 'asc' ? 'asc' : 'desc' }];
    } else if (sortBy === 'priority') {
      orderBy = [{ priority_level: sortOrder === 'asc' ? 'asc' : 'desc' }, { created_at: 'desc' }];
    } else {
      orderBy = [{ created_at: sortOrder === 'asc' ? 'asc' : 'desc' }];
    }

    const [total, evaluations] = await Promise.all([
      prisma.caseEvaluation.count({ where }),
      prisma.caseEvaluation.findMany({
        where,
        include: {
          evaluation_batch: true,
          question: true,
          t3_case: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // If sorting by case type, sort in memory
    let sortedEvaluations = evaluations;
    if (sortBy === 'caseType') {
      sortedEvaluations = [...evaluations].sort((a, b) => {
        const getCaseTypeOrder = (e: typeof a) => {
          if (e.question_id) return 0; // legacy
          if (e.t3_case?.pearl_level === 'L1') return 1;
          if (e.t3_case?.pearl_level === 'L2') return 2;
          if (e.t3_case?.pearl_level === 'L3') return 3;
          return 4;
        };
        const orderA = getCaseTypeOrder(a);
        const orderB = getCaseTypeOrder(b);
        if (orderA !== orderB) {
          return sortOrder === 'asc' ? orderA - orderB : orderB - orderA;
        }
        // Secondary sort by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return NextResponse.json({
      batches,
      page,
      pageSize,
      total,
      evaluations: sortedEvaluations,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Grading API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load grading data' },
      { status: 500 }
    );
  }
}

