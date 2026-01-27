import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateLegacyQuestions } from '@/lib/t3-evaluator';
import { generateReport } from '@/lib/evaluation-agent';

// Evaluation endpoint for legacy Question records
// For T3 cases (L1Case, L2Case, L3Case), use /api/admin/evaluate-t3-cases

// GET - List evaluation batches
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const batchId = searchParams.get('batchId');

  if (batchId) {
    // Get specific batch with evaluations (include L1/L2/L3 for T3 batches)
    const batch = await prisma.evaluationBatch.findUnique({
      where: { id: batchId },
      include: {
        evaluations: {
          include: {
            question: true,
            t3_case: true,
          },
          orderBy: { priority_level: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  // List all evaluation batches
  const batches = await prisma.evaluationBatch.findMany({
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  return NextResponse.json({ batches }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export interface EvaluateRequest {
  dataset?: string;         // Filter by dataset name
  questionIds?: string[];   // Specific question IDs to evaluate
  batchId?: string;         // Generation batch ID to evaluate
  unverifiedOnly?: boolean; // Only evaluate unverified questions
  skipAlreadyEvaluated?: boolean; // Skip questions that already have evaluations
}

// POST - Start evaluation for legacy Question records
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
      where.generation_batch_id = batchId;
    }

    if (questionIds && questionIds.length > 0) {
      where.id = { in: questionIds };
    }

    if (unverifiedOnly) {
      where.is_verified = false;
    }

    // Get questions to evaluate
    let questions = await prisma.question.findMany({
      where,
      select: { id: true },
    });

    const initialCount = questions.length;
    let evaluatedCount = 0;

    // Optionally skip already evaluated
    if (skipAlreadyEvaluated && questions.length > 0) {
      const existingEvaluations = await prisma.caseEvaluation.findMany({
        where: { question_id: { in: questions.map(q => q.id) } },
        select: { question_id: true },
      });
      const evaluatedIds = new Set(existingEvaluations.map(e => e.question_id).filter(Boolean));
      evaluatedCount = evaluatedIds.size;
      questions = questions.filter(q => !evaluatedIds.has(q.id));
    }

    if (questions.length === 0) {
      const errorDetails: string[] = [];
      if (initialCount === 0) {
        errorDetails.push('No questions found matching the specified criteria');
        if (dataset) errorDetails.push(`Dataset: ${dataset}`);
        if (batchId) errorDetails.push(`Generation batch: ${batchId}`);
        if (unverifiedOnly) errorDetails.push('Unverified only: true');
      } else if (evaluatedCount > 0) {
        errorDetails.push(`All ${initialCount} matching questions have already been evaluated`);
      }
      
      return NextResponse.json({
        error: errorDetails.join('. ') || 'No questions found matching criteria',
        details: {
          initialCount,
          evaluatedCount,
          remainingCount: questions.length,
          filters: { dataset, batchId, unverifiedOnly, skipAlreadyEvaluated },
        },
      }, { status: 400 });
    }

    // Create evaluation batch
    const evalBatch = await prisma.evaluationBatch.create({
      data: {
        dataset: dataset || null,
        question_filter: JSON.stringify({ batchId, unverifiedOnly }),
        total_count: questions.length,
        completed_count: 0,
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

        await evaluateLegacyQuestions(evalBatch.id, questionIds_);

        // Generate report after completion
        try {
          await generateReport(evalBatch.id);
        } catch (error) {
          console.error('Failed to generate report:', error);
          // Don't fail the batch if report generation fails
        }

        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: {
            status: 'completed',
            completed_at: new Date(),
          },
        });
      } catch (error) {
        console.error('Evaluation batch error:', error);
        await prisma.evaluationBatch.update({
          where: { id: evalBatch.id },
          data: {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      evaluation_batch_id: evalBatch.id,
      evaluationBatchId: evalBatch.id, // Backward compatibility
      questionsCount: questions.length,
      message: `Started evaluation of ${questions.length} legacy questions. Poll GET /api/admin/evaluate?batchId=${evalBatch.id} for status.`,
    });
  } catch (error) {
    console.error('Evaluate API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to start evaluation',
    }, { status: 500 });
  }
}

