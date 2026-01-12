import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateBatch, generateReport } from '@/lib/evaluation-agent';

export interface EvaluateRequest {
  dataset?: string;         // Filter by dataset name
  questionIds?: string[];   // Specific question IDs to evaluate
  batchId?: string;         // Generation batch ID to evaluate
  unverifiedOnly?: boolean; // Only evaluate unverified questions
  skipAlreadyEvaluated?: boolean; // Skip questions that already have evaluations
}

// GET - List evaluation batches
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const batchId = searchParams.get('batchId');

  if (batchId) {
    // Get specific batch with evaluations
    const batch = await prisma.evaluationBatch.findUnique({
      where: { id: batchId },
      include: {
        evaluations: {
          include: { question: true },
          orderBy: { priorityLevel: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  }

  // List all evaluation batches
  const batches = await prisma.evaluationBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ batches });
}

// POST - Start new evaluation batch
export async function POST(req: NextRequest) {
  try {
    const body: EvaluateRequest = await req.json();
    const { dataset, questionIds, batchId, unverifiedOnly = false, skipAlreadyEvaluated = true } = body;

    // Build query for questions to evaluate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (dataset) {
      where.dataset = dataset;
    }

    if (batchId) {
      where.generationBatchId = batchId;
    }

    if (questionIds && questionIds.length > 0) {
      where.id = { in: questionIds };
    }

    if (unverifiedOnly) {
      where.isVerified = false;
    }

    // Get questions to evaluate
    let questions = await prisma.question.findMany({
      where,
      select: { id: true },
    });

    // Optionally skip already evaluated
    if (skipAlreadyEvaluated && questions.length > 0) {
      const existingEvaluations = await prisma.caseEvaluation.findMany({
        where: { questionId: { in: questions.map(q => q.id) } },
        select: { questionId: true },
      });
      const evaluatedIds = new Set(existingEvaluations.map(e => e.questionId));
      questions = questions.filter(q => !evaluatedIds.has(q.id));
    }

    if (questions.length === 0) {
      return NextResponse.json({
        error: 'No questions found matching criteria (or all already evaluated)',
      }, { status: 400 });
    }

    // Create evaluation batch
    const evalBatch = await prisma.evaluationBatch.create({
      data: {
        dataset: dataset || null,
        questionFilter: JSON.stringify({ batchId, unverifiedOnly }),
        totalCount: questions.length,
        completedCount: 0,
        status: 'pending',
      },
    });

    // Start background evaluation
    const questionIds_ = questions.map(q => q.id);
    setImmediate(async () => {
      try {
        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: { status: 'running' },
        });

        await evaluateBatch(evalBatch.id, questionIds_);

        // Generate report after completion
        await generateReport(evalBatch.id);
      } catch (error) {
        console.error('Evaluation batch error:', error);
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
      questionsCount: questions.length,
      message: `Started evaluation of ${questions.length} questions. Poll GET /api/admin/evaluate?batchId=${evalBatch.id} for status.`,
    });
  } catch (error) {
    console.error('Evaluate API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to start evaluation',
    }, { status: 500 });
  }
}

