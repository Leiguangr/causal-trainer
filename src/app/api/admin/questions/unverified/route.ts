import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pearlLevel = searchParams.get('pearlLevel');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = { isVerified: false };
    if (pearlLevel && pearlLevel !== 'all') {
      where.pearlLevel = pearlLevel;
    }

    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Fetch unverified error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

