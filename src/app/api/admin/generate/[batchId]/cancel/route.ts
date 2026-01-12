import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/generate/[batchId]/cancel - Cancel a running batch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    const batch = await prisma.generationBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (batch.status !== 'pending' && batch.status !== 'running') {
      return NextResponse.json({
        success: false,
        message: `Batch is already ${batch.status}`,
      });
    }

    // Update status to cancelled
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        errorMessage: 'Cancelled by user',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Batch ${batchId} has been cancelled. It will stop after the current question completes.`,
    });

  } catch (error) {
    console.error('Cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel batch' },
      { status: 500 }
    );
  }
}

