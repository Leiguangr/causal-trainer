import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List all datasets with counts
export async function GET() {
  try {
    // Datasets exist across legacy Question table and new per-level case tables.
    const [qAll, qVerified, l1All, l1Verified, l2All, l2Verified, l3All, l3Verified] = await Promise.all([
      prisma.question.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }),
      prisma.question.groupBy({
        by: ['dataset'],
        where: { isVerified: true },
        _count: { id: true },
      }),
      prisma.l1Case.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }),
      prisma.l1Case.groupBy({
        by: ['dataset'],
        where: { isVerified: true },
        _count: { id: true },
      }),
      prisma.l2Case.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }),
      prisma.l2Case.groupBy({
        by: ['dataset'],
        where: { isVerified: true },
        _count: { id: true },
      }),
      prisma.l3Case.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }),
      prisma.l3Case.groupBy({
        by: ['dataset'],
        where: { isVerified: true },
        _count: { id: true },
      }),
    ]);

    const totals = new Map<string, number>();
    const verified = new Map<string, number>();

    const addCounts = (
      rows: Array<{ dataset: string; _count: { id: number } }>,
      target: Map<string, number>
    ) => {
      for (const row of rows) {
        target.set(row.dataset, (target.get(row.dataset) || 0) + row._count.id);
      }
    };

    addCounts(qAll, totals);
    addCounts(l1All, totals);
    addCounts(l2All, totals);
    addCounts(l3All, totals);

    addCounts(qVerified, verified);
    addCounts(l1Verified, verified);
    addCounts(l2Verified, verified);
    addCounts(l3Verified, verified);

    // Union of dataset names across all sources.
    const allNames = Array.from(
      new Set<string>([...totals.keys(), ...verified.keys()])
    ).sort((a, b) => a.localeCompare(b));

    const result = allNames.map(name => ({
      name,
      totalCount: totals.get(name) || 0,
      verifiedCount: verified.get(name) || 0,
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

