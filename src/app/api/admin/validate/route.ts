import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch questions for validation
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get('dataset') || 'cs372-assignment2';
    const pearlLevel = searchParams.get('pearlLevel');
    const validationStatus = searchParams.get('validationStatus');
    const scoreFilter = searchParams.get('scoreFilter'); // 'rejected', 'revision', 'accepted'
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build where clause
    const where: Record<string, unknown> = { dataset };
    if (pearlLevel && pearlLevel !== 'all') {
      where.pearlLevel = pearlLevel;
    }
    if (validationStatus && validationStatus !== 'all') {
      where.validationStatus = validationStatus;
    }
    // Score filter: rejected (<6), revision (6-7), accepted (>=8)
    if (scoreFilter === 'rejected') {
      where.finalScore = { lt: 6 };
    } else if (scoreFilter === 'revision') {
      where.finalScore = { gte: 6, lt: 8 };
    } else if (scoreFilter === 'accepted') {
      where.finalScore = { gte: 8 };
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      orderBy: [
        { validationStatus: 'asc' }, // pending first
        { pearlLevel: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        scenario: true,
        claim: true,
        pearlLevel: true,
        domain: true,
        subdomain: true,
        trapType: true,
        trapSubtype: true,
        explanation: true,
        difficulty: true,
        groundTruth: true,
        variables: true,
        causalStructure: true,
        keyInsight: true,
        wiseRefusal: true,
        hiddenTimestamp: true,
        conditionalAnswers: true,
        initialAuthor: true,
        validator: true,
        validationStatus: true,
        validatorNotes: true,
        scenarioClarityScore: true,
        hiddenQuestionScore: true,
        conditionalAnswerAScore: true,
        conditionalAnswerBScore: true,
        wiseRefusalScore: true,
        difficultyCalibrationScore: true,
        finalLabelScore: true,
        trapTypeScore: true,
        finalScore: true,
        sourceCase: true,
      },
    });

    // Calculate stats
    const allInDataset = await prisma.question.findMany({
      where: { dataset },
      select: { validationStatus: true, pearlLevel: true },
    });

    const stats = {
      total: allInDataset.length,
      pending: allInDataset.filter(q => q.validationStatus === 'pending').length,
      scored: allInDataset.filter(q => q.validationStatus === 'scored').length,
      approved: allInDataset.filter(q => q.validationStatus === 'approved').length,
      rejected: allInDataset.filter(q => q.validationStatus === 'rejected').length,
      byLevel: {
        L1: allInDataset.filter(q => q.pearlLevel === 'L1').length,
        L2: allInDataset.filter(q => q.pearlLevel === 'L2').length,
        L3: allInDataset.filter(q => q.pearlLevel === 'L3').length,
      },
    };

    return NextResponse.json({ questions, stats });
  } catch (error) {
    console.error('Error fetching validation questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

