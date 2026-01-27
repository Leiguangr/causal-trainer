import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List all datasets with counts
export async function GET() {
  try {
    // Check if Prisma client and models are properly initialized
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }
    if (!prisma.question) {
      throw new Error('Prisma question model is not available. Please run: npx prisma generate');
    }
    if (!prisma.t3Case) {
      throw new Error('Prisma t3Case model is not available. Please run: npx prisma generate');
    }

    // Datasets exist across legacy Question table and unified T3Case table.
    // Handle case where T3Case table might not exist yet (migrations not applied)
    const questionPromises = [
      prisma.question.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }),
      prisma.question.groupBy({
        by: ['dataset'],
        where: { is_verified: true },
        _count: { id: true },
      }),
    ];

    const t3CasePromises = [
      prisma.t3Case.groupBy({
        by: ['dataset'],
        _count: { id: true },
      }).catch((error: any) => {
        // If T3Case table doesn't exist, return empty array
        if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
          console.warn('T3Case table does not exist yet. Run migrations: npx prisma migrate deploy');
          return [];
        }
        throw error;
      }),
      prisma.t3Case.groupBy({
        by: ['dataset'],
        where: { is_verified: true },
        _count: { id: true },
      }).catch((error: any) => {
        // If T3Case table doesn't exist, return empty array
        if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
          return [];
        }
        throw error;
      }),
    ];

    const [qAll, qVerified, t3All, t3Verified] = await Promise.all([
      ...questionPromises,
      ...t3CasePromises,
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
    addCounts(t3All, totals);

    addCounts(qVerified, verified);
    addCounts(t3Verified, verified);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch datasets',
        details: errorMessage,
        hint: errorMessage.includes('groupBy') || errorMessage.includes('not available') 
          ? 'Prisma client may need to be regenerated. Run: npx prisma generate'
          : undefined
      },
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

