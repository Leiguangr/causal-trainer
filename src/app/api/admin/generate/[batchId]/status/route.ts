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
        l1Cases: {
          select: {
            id: true,
            evidenceClass: true,
            evidenceType: true,
            domain: true,
            groundTruth: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        l2Cases: {
          select: {
            id: true,
            trapType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        l3Cases: {
          select: {
            id: true,
            family: true,
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
      questions: [
        ...batch.questions.map(q => ({
          id: q.id,
          pearlLevel: q.pearlLevel,
          trapType: q.trapType,
          trapSubtype: q.trapSubtype,
          domain: q.domain,
          groundTruth: q.groundTruth,
        })),
        ...batch.l1Cases.map(c => ({
          id: c.id,
          pearlLevel: 'L1',
          trapType: c.evidenceClass, // displayed in UI; legacy label says "trapType"
          trapSubtype: c.evidenceType || 'NONE',
          domain: c.domain || 'N/A',
          groundTruth: c.groundTruth,
        })),
        ...batch.l2Cases.map(c => ({
          id: c.id,
          pearlLevel: 'L2',
          trapType: c.trapType, // displayed in UI; legacy label says "trapType"
          trapSubtype: 'N/A',
          domain: 'N/A',
          groundTruth: 'N/A',
        })),
        ...batch.l3Cases.map(c => ({
          id: c.id,
          pearlLevel: 'L3',
          trapType: c.family, // displayed in UI; legacy label says "trapType"
          trapSubtype: 'N/A',
          domain: c.domain || 'N/A',
          groundTruth: c.groundTruth,
        })),
      ],
    });

  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch status' },
      { status: 500 }
    );
  }
}

