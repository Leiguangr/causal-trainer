import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Legacy endpoint: Only returns Question table records
// For T3 cases (L1Case, L2Case, L3Case), use /api/admin/t3-cases/unverified
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

    const where: any = { is_verified: false };
    if (pearlLevel && pearlLevel !== 'all') {
      where.pearl_level = pearlLevel;
    }
    if (domain && domain !== 'all') {
      where.domain = domain;
    }
    if (groundTruth && groundTruth !== 'all') {
      where.ground_truth = groundTruth;
    }
    if (trapType && trapType !== 'all') {
      where.trap_type = trapType;
    }
    if (dataset && dataset !== 'all') {
      where.dataset = dataset;
    }

    // Determine sort order
    let orderBy: any = { created_at: 'desc' };
    let useRandomSort = false;
    switch (sortBy) {
      case 'oldest':
        orderBy = { created_at: 'asc' };
        break;
      case 'level-asc':
        orderBy = { pearl_level: 'asc' };
        break;
      case 'level-desc':
        orderBy = { pearl_level: 'desc' };
        break;
      case 'domain':
        orderBy = { domain: 'asc' };
        break;
      case 'groundTruth':
        orderBy = { ground_truth: 'asc' };
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
    const [distinctDomains, distinctTrapTypes] = await Promise.all([
      prisma.question.findMany({
        where: { is_verified: false },
        select: { domain: true },
        distinct: ['domain'],
      }),
      prisma.question.findMany({
        where: { is_verified: false },
        select: { trap_type: true },
        distinct: ['trap_type'],
      }),
    ]);

    const allTrapTypes = new Set(
      distinctTrapTypes.map(t => t.trap_type).filter(Boolean)
    );
    
    const allDomains = new Set(
      distinctDomains.map(d => d.domain).filter(Boolean)
    );

    return NextResponse.json({
      questions,
      total,
      offset,
      limit,
      filters: {
        domains: Array.from(allDomains).sort(),
        trapTypes: Array.from(allTrapTypes).sort(),
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

