import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pearlLevel = searchParams.get('pearlLevel');
    const domain = searchParams.get('domain');
    const groundTruth = searchParams.get('groundTruth');
    const trapType = searchParams.get('trapType');
    const dataset = searchParams.get('dataset');
    const sortBy = searchParams.get('sortBy') || 'newest';
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { isVerified: false };
    if (pearlLevel && pearlLevel !== 'all') {
      where.pearlLevel = pearlLevel;
    }
    if (domain && domain !== 'all') {
      where.domain = domain;
    }
    if (groundTruth && groundTruth !== 'all') {
      where.groundTruth = groundTruth;
    }
    if (trapType && trapType !== 'all') {
      where.trapType = trapType;
    }
    if (dataset && dataset !== 'all') {
      where.dataset = dataset;
    }

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    let useRandomSort = false;
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'level-asc':
        orderBy = { pearlLevel: 'asc' };
        break;
      case 'level-desc':
        orderBy = { pearlLevel: 'desc' };
        break;
      case 'domain':
        orderBy = { domain: 'asc' };
        break;
      case 'groundTruth':
        orderBy = { groundTruth: 'asc' };
        break;
      case 'random':
        useRandomSort = true;
        break;
    }

    // Get total count for pagination info
    const total = await prisma.question.count({ where });

    let questions;
    if (useRandomSort) {
      // For random sort, fetch all matching questions and shuffle
      const allQuestions = await prisma.question.findMany({
        where,
      });
      // Fisher-Yates shuffle
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }
      questions = allQuestions.slice(offset, offset + Math.min(limit, 500));
    } else {
      questions = await prisma.question.findMany({
        where,
        orderBy,
        take: Math.min(limit, 500), // Max 500 at a time
        skip: offset,
      });
    }

    // Get distinct values for filter dropdowns
    const distinctDomains = await prisma.question.findMany({
      where: { isVerified: false },
      select: { domain: true },
      distinct: ['domain'],
    });
    const distinctTrapTypes = await prisma.question.findMany({
      where: { isVerified: false },
      select: { trapType: true },
      distinct: ['trapType'],
    });

    return NextResponse.json({
      questions,
      total,
      offset,
      limit,
      filters: {
        domains: distinctDomains.map(d => d.domain).filter(Boolean).sort(),
        trapTypes: distinctTrapTypes.map(t => t.trapType).filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error('Fetch unverified error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

