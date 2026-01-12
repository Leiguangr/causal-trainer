import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    const batch = await prisma.generationBatch.findUnique({
      where: { id: batchId },
      include: {
        questions: {
          select: {
            id: true,
            pearlLevel: true,
            trapType: true,
            trapSubtype: true,
            domain: true,
            groundTruth: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Calculate progress percentage
    const progress = batch.requestedCount > 0
      ? Math.round((batch.currentIndex / batch.requestedCount) * 100)
      : 0;

    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      progress,
      currentIndex: batch.currentIndex,
      requestedCount: batch.requestedCount,
      generatedCount: batch.generatedCount,
      pearlLevel: batch.pearlLevel,
      domain: batch.domain,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      errorMessage: batch.errorMessage,
      questions: batch.questions,
    });

  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch status' },
      { status: 500 }
    );
  }
}

