import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caseType = searchParams.get('caseType') || 'all'; // L1, L2, L3, or all
    const dataset = searchParams.get('dataset');
    const domain = searchParams.get('domain');
    const evidenceClass = searchParams.get('evidenceClass'); // For L1: WOLF, SHEEP, NONE
    const trapType = searchParams.get('trapType'); // For L2: T1-T17
    const family = searchParams.get('family'); // For L3: F1-F8
    const groundTruth = searchParams.get('groundTruth'); // YES/NO/AMBIGUOUS for L1, VALID/INVALID/CONDITIONAL for L3
    const sortBy = searchParams.get('sortBy') || 'newest';
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = parseInt(searchParams.get('offset') || '0');

    const cases: any[] = [];
    let total = 0;

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    let useRandomSort = false;
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
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

    // Fetch L1Case records
    if (caseType === 'all' || caseType === 'L1') {
      const l1Where: any = { isVerified: false };
      if (dataset && dataset !== 'all') {
        l1Where.dataset = dataset;
      }
      if (domain && domain !== 'all') {
        l1Where.domain = domain;
      }
      if (evidenceClass && evidenceClass !== 'all') {
        l1Where.evidenceClass = evidenceClass;
      }
      if (groundTruth && groundTruth !== 'all') {
        l1Where.groundTruth = groundTruth;
      }

      const l1Count = await prisma.l1Case.count({ where: l1Where });
      total += l1Count;

      let l1Cases;
      if (useRandomSort) {
        const allL1 = await prisma.l1Case.findMany({ where: l1Where });
        for (let i = allL1.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allL1[i], allL1[j]] = [allL1[j], allL1[i]];
        }
        l1Cases = allL1.slice(offset, offset + Math.min(limit, 500));
      } else {
        const l1OrderBy: any = {};
        if (orderBy.createdAt) l1OrderBy.createdAt = orderBy.createdAt;
        if (orderBy.domain) l1OrderBy.domain = orderBy.domain;
        if (orderBy.groundTruth) l1OrderBy.groundTruth = orderBy.groundTruth;

        l1Cases = await prisma.l1Case.findMany({
          where: l1Where,
          orderBy: Object.keys(l1OrderBy).length > 0 ? l1OrderBy : { createdAt: 'desc' },
          take: Math.min(limit, 500),
          skip: offset,
        });
      }

      cases.push(...l1Cases.map(c => ({
        ...c,
        _caseType: 'L1' as const,
      })));
    }

    // Fetch L2Case records
    if (caseType === 'all' || caseType === 'L2') {
      const l2Where: any = { isVerified: false };
      if (dataset && dataset !== 'all') {
        l2Where.dataset = dataset;
      }
      if (trapType && trapType !== 'all') {
        l2Where.trapType = trapType;
      }

      const l2Count = await prisma.l2Case.count({ where: l2Where });
      total += l2Count;

      let l2Cases;
      if (useRandomSort) {
        const allL2 = await prisma.l2Case.findMany({ where: l2Where });
        for (let i = allL2.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allL2[i], allL2[j]] = [allL2[j], allL2[i]];
        }
        l2Cases = allL2.slice(offset, offset + Math.min(limit, 500));
      } else {
        const l2OrderBy: any = {};
        if (orderBy.createdAt) l2OrderBy.createdAt = orderBy.createdAt;

        l2Cases = await prisma.l2Case.findMany({
          where: l2Where,
          orderBy: l2OrderBy.createdAt ? l2OrderBy : { createdAt: 'desc' },
          take: Math.min(limit, 500),
          skip: offset,
        });
      }

      cases.push(...l2Cases.map(c => ({
        ...c,
        _caseType: 'L2' as const,
      })));
    }

    // Fetch L3Case records
    if (caseType === 'all' || caseType === 'L3') {
      const l3Where: any = { isVerified: false };
      if (dataset && dataset !== 'all') {
        l3Where.dataset = dataset;
      }
      if (domain && domain !== 'all') {
        l3Where.domain = domain;
      }
      if (family && family !== 'all') {
        l3Where.family = family;
      }
      if (groundTruth && groundTruth !== 'all') {
        l3Where.groundTruth = groundTruth;
      }

      const l3Count = await prisma.l3Case.count({ where: l3Where });
      total += l3Count;

      let l3Cases;
      if (useRandomSort) {
        const allL3 = await prisma.l3Case.findMany({ where: l3Where });
        for (let i = allL3.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allL3[i], allL3[j]] = [allL3[j], allL3[i]];
        }
        l3Cases = allL3.slice(offset, offset + Math.min(limit, 500));
      } else {
        const l3OrderBy: any = {};
        if (orderBy.createdAt) l3OrderBy.createdAt = orderBy.createdAt;
        if (orderBy.domain) l3OrderBy.domain = orderBy.domain;
        if (orderBy.groundTruth) l3OrderBy.groundTruth = orderBy.groundTruth;

        l3Cases = await prisma.l3Case.findMany({
          where: l3Where,
          orderBy: Object.keys(l3OrderBy).length > 0 ? l3OrderBy : { createdAt: 'desc' },
          take: Math.min(limit, 500),
          skip: offset,
        });
      }

      cases.push(...l3Cases.map(c => ({
        ...c,
        _caseType: 'L3' as const,
      })));
    }

    // Get distinct values for filter dropdowns
    const [l1Domains, l1EvidenceClasses, l2TrapTypes, l3Domains, l3Families] = await Promise.all([
      prisma.l1Case.findMany({
        where: { isVerified: false },
        select: { domain: true },
        distinct: ['domain'],
      }),
      prisma.l1Case.findMany({
        where: { isVerified: false },
        select: { evidenceClass: true },
        distinct: ['evidenceClass'],
      }),
      prisma.l2Case.findMany({
        where: { isVerified: false },
        select: { trapType: true },
        distinct: ['trapType'],
      }),
      prisma.l3Case.findMany({
        where: { isVerified: false },
        select: { domain: true },
        distinct: ['domain'],
      }),
      prisma.l3Case.findMany({
        where: { isVerified: false },
        select: { family: true },
        distinct: ['family'],
      }),
    ]);

    const allDomains = new Set([
      ...l1Domains.map(d => d.domain).filter(Boolean),
      ...l3Domains.map(d => d.domain).filter(Boolean),
    ]);

    return NextResponse.json({
      cases,
      total,
      offset,
      limit,
      filters: {
        domains: Array.from(allDomains).sort(),
        evidenceClasses: Array.from(new Set(l1EvidenceClasses.map(e => e.evidenceClass).filter(Boolean))).sort(),
        trapTypes: Array.from(new Set(l2TrapTypes.map(t => t.trapType).filter(Boolean))).sort(),
        families: Array.from(new Set(l3Families.map(f => f.family).filter(Boolean))).sort(),
      },
    });
  } catch (error) {
    console.error('Fetch unverified T3 cases error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch T3 cases' },
      { status: 500 }
    );
  }
}
