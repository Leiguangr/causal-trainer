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
            pearl_level: true,
            trap_type: true,
            trap_subtype: true,
            domain: true,
            ground_truth: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
        t3_cases: {
          select: {
            id: true,
            pearl_level: true,
            trap_type: true,
            trap_subtype: true,
            domain: true,
            label: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Calculate progress percentage
    const progress = batch.requested_count > 0
      ? Math.round((batch.current_index / batch.requested_count) * 100)
      : 0;

    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      progress,
      currentIndex: batch.current_index,
      requestedCount: batch.requested_count,
      generatedCount: batch.generated_count,
      pearlLevel: batch.pearl_level,
      domain: batch.domain,
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
      errorMessage: batch.error_message,
      questions: [
        ...batch.questions.map(q => ({
          id: q.id,
          pearl_level: q.pearl_level,
          trap_type: q.trap_type,
          trap_subtype: q.trap_subtype,
          domain: q.domain,
          ground_truth: q.ground_truth,
        })),
        ...batch.t3_cases.map(c => ({
          id: c.id,
          pearl_level: c.pearl_level,
          trap_type: c.trap_type,
          trap_subtype: c.trap_subtype || 'N/A',
          domain: c.domain || 'N/A',
          ground_truth: c.label, // T3Case uses 'label' instead of 'ground_truth'
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

