import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE - Delete an evaluation batch and its associated evaluations
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // First, check if the batch exists
    const batch = await prisma.evaluationBatch.findUnique({
      where: { id: batchId },
      include: {
        evaluations: {
          select: { id: true },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Evaluation batch not found' }, { status: 404 });
    }

    // Delete all associated evaluations first (since there's no cascade delete in schema)
    const evaluationCount = batch.evaluations.length;
    if (evaluationCount > 0) {
      await prisma.caseEvaluation.deleteMany({
        where: { evaluation_batch_id: batchId },
      });
    }

    // Delete the evaluation batch
    await prisma.evaluationBatch.delete({
      where: { id: batchId },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted evaluation batch and ${evaluationCount} associated evaluations`,
      deletedEvaluations: evaluationCount,
    });
  } catch (error) {
    console.error('Delete evaluation batch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete evaluation batch',
      },
      { status: 500 }
    );
  }
}
