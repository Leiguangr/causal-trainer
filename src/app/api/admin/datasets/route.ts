import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List all datasets with counts
export async function GET() {
  try {
    // Get distinct datasets with counts
    const datasets = await prisma.question.groupBy({
      by: ['dataset'],
      _count: {
        id: true,
      },
      orderBy: {
        dataset: 'asc',
      },
    });

    // Get verified counts for each dataset
    const verifiedCounts = await prisma.question.groupBy({
      by: ['dataset'],
      where: { isVerified: true },
      _count: {
        id: true,
      },
    });

    const verifiedMap = new Map(
      verifiedCounts.map(d => [d.dataset, d._count.id])
    );

    const result = datasets.map(d => ({
      name: d.dataset,
      totalCount: d._count.id,
      verifiedCount: verifiedMap.get(d.dataset) || 0,
    }));

    return NextResponse.json({
      datasets: result,
    });
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 }
    );
  }
}

// POST: Update dataset for questions (bulk move)
export async function POST(req: NextRequest) {
  try {
    const { questionIds, dataset } = await req.json();

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: 'Question IDs are required' },
        { status: 400 }
      );
    }

    if (!dataset || typeof dataset !== 'string') {
      return NextResponse.json(
        { error: 'Dataset name is required' },
        { status: 400 }
      );
    }

    const updated = await prisma.question.updateMany({
      where: { id: { in: questionIds } },
      data: { dataset: dataset.trim() },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
    });
  } catch (error) {
    console.error('Error updating dataset:', error);
    return NextResponse.json(
      { error: 'Failed to update dataset' },
      { status: 500 }
    );
  }
}

