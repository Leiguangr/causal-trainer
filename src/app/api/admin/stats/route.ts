import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {

    // Count questions by Pearl level
    const [l1Count, l2Count, l3Count] = await Promise.all([
      prisma.question.count({ where: { pearlLevel: 'L1' } }),
      prisma.question.count({ where: { pearlLevel: 'L2' } }),
      prisma.question.count({ where: { pearlLevel: 'L3' } }),
    ]);

    return NextResponse.json({
      L1: { current: l1Count, target: 50 },
      L2: { current: l2Count, target: 297 },
      L3: { current: l3Count, target: 103 },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

