import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateL1Cases, evaluateL2Cases, evaluateL3Cases } from '@/lib/t3-evaluator';
import { generateReport } from '@/lib/evaluation-agent';

export interface EvaluateT3Request {
  caseType: 'L1' | 'L2' | 'L3' | 'all';
  dataset?: string;
  generationBatchId?: string;
  unverifiedOnly?: boolean;
  skipAlreadyEvaluated?: boolean;
}

// GET - Poll a batch status (and optionally list recent batches)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const batchId = searchParams.get('batchId');

  if (batchId) {
    const batch = await prisma.evaluationBatch.findUnique({
      where: { id: batchId },
      include: {
        evaluations: {
          include: {
            l1Case: true,
            l2Case: true,
            l3Case: true,
            question: true,
          },
          orderBy: { priorityLevel: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  }

  const batches = await prisma.evaluationBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ batches });
}

// POST - Start evaluation for T3 case tables (L1Case/L2Case/L3Case)
export async function POST(req: NextRequest) {
  try {
    const body: EvaluateT3Request = await req.json();
    const {
      caseType,
      dataset,
      generationBatchId,
      unverifiedOnly = false,
      skipAlreadyEvaluated = true,
    } = body;

    if (!caseType) {
      return NextResponse.json({ error: 'caseType is required' }, { status: 400 });
    }

    const idsByType: { L1: string[]; L2: string[]; L3: string[] } = { L1: [], L2: [], L3: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = {};
    if (dataset) baseWhere.dataset = dataset;
    if (generationBatchId) baseWhere.generationBatchId = generationBatchId;
    if (unverifiedOnly) baseWhere.isVerified = false;

    if (caseType === 'L1' || caseType === 'all') {
      const rows = await prisma.l1Case.findMany({ where: baseWhere, select: { id: true } });
      idsByType.L1 = rows.map(r => r.id);
    }
    if (caseType === 'L2' || caseType === 'all') {
      const rows = await prisma.l2Case.findMany({ where: baseWhere, select: { id: true } });
      idsByType.L2 = rows.map(r => r.id);
    }
    if (caseType === 'L3' || caseType === 'all') {
      const rows = await prisma.l3Case.findMany({ where: baseWhere, select: { id: true } });
      idsByType.L3 = rows.map(r => r.id);
    }

    if (skipAlreadyEvaluated) {
      if (idsByType.L1.length > 0) {
        const existing = await prisma.caseEvaluation.findMany({
          where: { l1CaseId: { in: idsByType.L1 } },
          select: { l1CaseId: true },
        });
        const done = new Set(existing.map(e => e.l1CaseId).filter(Boolean) as string[]);
        idsByType.L1 = idsByType.L1.filter(id => !done.has(id));
      }
      if (idsByType.L2.length > 0) {
        const existing = await prisma.caseEvaluation.findMany({
          where: { l2CaseId: { in: idsByType.L2 } },
          select: { l2CaseId: true },
        });
        const done = new Set(existing.map(e => e.l2CaseId).filter(Boolean) as string[]);
        idsByType.L2 = idsByType.L2.filter(id => !done.has(id));
      }
      if (idsByType.L3.length > 0) {
        const existing = await prisma.caseEvaluation.findMany({
          where: { l3CaseId: { in: idsByType.L3 } },
          select: { l3CaseId: true },
        });
        const done = new Set(existing.map(e => e.l3CaseId).filter(Boolean) as string[]);
        idsByType.L3 = idsByType.L3.filter(id => !done.has(id));
      }
    }

    const totalCount = idsByType.L1.length + idsByType.L2.length + idsByType.L3.length;
    if (totalCount === 0) {
      return NextResponse.json(
        { error: 'No cases found matching criteria (or all already evaluated)' },
        { status: 400 }
      );
    }

    const evalBatch = await prisma.evaluationBatch.create({
      data: {
        dataset: dataset || null,
        questionFilter: JSON.stringify({
          caseType,
          generationBatchId: generationBatchId || null,
          unverifiedOnly,
          skipAlreadyEvaluated,
        }),
        totalCount,
        completedCount: 0,
        status: 'pending',
      },
    });

    setImmediate(async () => {
      try {
        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: { status: 'running' },
        });

        let completed = 0;
        if (idsByType.L1.length > 0) {
          await evaluateL1Cases(evalBatch.id, idsByType.L1, completed);
          completed += idsByType.L1.length;
        }
        if (idsByType.L2.length > 0) {
          await evaluateL2Cases(evalBatch.id, idsByType.L2, completed);
          completed += idsByType.L2.length;
        }
        if (idsByType.L3.length > 0) {
          await evaluateL3Cases(evalBatch.id, idsByType.L3, completed);
          completed += idsByType.L3.length;
        }

        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            completedCount: completed,
          },
        });

        // Generate report after completion
        try {
          await generateReport(evalBatch.id);
        } catch (error) {
          console.error('Failed to generate report:', error);
          // Don't fail the batch if report generation fails
        }
      } catch (error) {
        console.error('T3 evaluation batch error:', error);
        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      evaluationBatchId: evalBatch.id,
      totalCount,
      byType: {
        L1: idsByType.L1.length,
        L2: idsByType.L2.length,
        L3: idsByType.L3.length,
      },
      message: `Started T3 evaluation of ${totalCount} cases. Poll GET /api/admin/evaluate-t3-cases?batchId=${evalBatch.id} for status.`,
    });
  } catch (error) {
    console.error('Evaluate T3 API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start T3 evaluation' },
      { status: 500 }
    );
  }
}

