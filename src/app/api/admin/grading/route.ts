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

    const page = Math.max(1, parseIntParam(searchParams.get('page'), 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseIntParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE))
    );

    const batches = await prisma.evaluationBatch.findMany({
      where: dataset ? { dataset } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (evaluationBatchId) where.evaluationBatchId = evaluationBatchId;
    if (overallVerdict) where.overallVerdict = overallVerdict;
    if (priorityLevel) where.priorityLevel = Number.parseInt(priorityLevel, 10);

    if (caseType === 'legacy') where.questionId = { not: null };
    if (caseType === 'L1') where.l1CaseId = { not: null };
    if (caseType === 'L2') where.l2CaseId = { not: null };
    if (caseType === 'L3') where.l3CaseId = { not: null };

    if (dataset) {
      // Support cases where EvaluationBatch.dataset might be null (e.g., all-dataset runs),
      // by filtering on the underlying case dataset as well.
      where.OR = [
        { evaluationBatch: { is: { dataset } } },
        { question: { is: { dataset } } },
        { l1Case: { is: { dataset } } },
        { l2Case: { is: { dataset } } },
        { l3Case: { is: { dataset } } },
      ];
    }

    const [total, evaluations] = await Promise.all([
      prisma.caseEvaluation.count({ where }),
      prisma.caseEvaluation.findMany({
        where,
        include: {
          evaluationBatch: true,
          question: true,
          l1Case: true,
          l2Case: true,
          l3Case: true,
        },
        orderBy: [{ priorityLevel: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      batches,
      page,
      pageSize,
      total,
      evaluations,
    });
  } catch (error) {
    console.error('Grading API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load grading data' },
      { status: 500 }
    );
  }
}

