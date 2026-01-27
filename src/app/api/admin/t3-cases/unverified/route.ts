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

    // Build unified T3Case where clause
    const where: any = { is_verified: false };
    if (dataset && dataset !== 'all') {
      where.dataset = dataset;
    }
    if (domain && domain !== 'all') {
      where.domain = domain;
    }
    if (caseType !== 'all') {
      where.pearl_level = caseType;
    }
    // Map old filter names to new unified schema
    if (evidenceClass && evidenceClass !== 'all') {
      // For L1, evidenceClass maps to trap_type (W1-W10 for WOLF, S1-S8 for SHEEP)
      // This is a simplified mapping - may need refinement
      where.pearl_level = 'L1';
    }
    if (trapType && trapType !== 'all') {
      where.trap_type = trapType;
    }
    if (family && family !== 'all') {
      where.trap_type = family; // L3 family is stored in trap_type
      where.pearl_level = 'L3';
    }
    if (groundTruth && groundTruth !== 'all') {
      where.label = groundTruth; // Map groundTruth to label
    }

    // Determine sort order
    let orderBy: any = { created_at: 'desc' };
    let useRandomSort = false;
    switch (sortBy) {
      case 'oldest':
        orderBy = { created_at: 'asc' };
        break;
      case 'domain':
        orderBy = { domain: 'asc' };
        break;
      case 'groundTruth':
        orderBy = { label: 'asc' }; // Use label instead of groundTruth
        break;
      case 'random':
        useRandomSort = true;
        break;
    }

    const total = await prisma.t3Case.count({ where });

    let t3Cases;
    if (useRandomSort) {
      const allT3 = await prisma.t3Case.findMany({ where });
      for (let i = allT3.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allT3[i], allT3[j]] = [allT3[j], allT3[i]];
      }
      t3Cases = allT3.slice(offset, offset + Math.min(limit, 500));
    } else {
      t3Cases = await prisma.t3Case.findMany({
        where,
        orderBy,
        take: Math.min(limit, 500),
        skip: offset,
      });
    }

    // Cases are already in snake_case from database
    const cases = t3Cases.map(c => ({
      ...c,
      _case_type: c.pearl_level as 'L1' | 'L2' | 'L3', // Keep _caseType for backward compatibility
      _caseType: c.pearl_level as 'L1' | 'L2' | 'L3', // Also keep camelCase version
    }));

    // Get distinct values for filter dropdowns from unified T3Case
    const [domains, trapTypes, labels] = await Promise.all([
      prisma.t3Case.findMany({
        where: { is_verified: false },
        select: { domain: true },
        distinct: ['domain'],
      }),
      prisma.t3Case.findMany({
        where: { is_verified: false },
        select: { trap_type: true, pearl_level: true },
        distinct: ['trap_type'],
      }),
      prisma.t3Case.findMany({
        where: { is_verified: false },
        select: { label: true },
        distinct: ['label'],
      }),
    ]);

    // Separate trap types by level for backward compatibility
    const l1TrapTypes = trapTypes.filter(t => t.pearl_level === 'L1').map(t => t.trap_type).filter(Boolean);
    const l2TrapTypes = trapTypes.filter(t => t.pearl_level === 'L2').map(t => t.trap_type).filter(Boolean);
    const l3Families = trapTypes.filter(t => t.pearl_level === 'L3').map(t => t.trap_type).filter(Boolean);

    // Extract evidence classes from L1 trap types (W1-W10 = WOLF, S1-S8 = SHEEP)
    const evidenceClasses = new Set<string>();
    l1TrapTypes.forEach(tt => {
      if (tt.match(/^W[0-9]+/)) evidenceClasses.add('WOLF');
      else if (tt.match(/^S[0-9]+/)) evidenceClasses.add('SHEEP');
      else if (tt === 'A') evidenceClasses.add('NONE');
    });

    const allDomains = new Set(domains.map(d => d.domain).filter(Boolean));

    return NextResponse.json({
      cases,
      total,
      offset,
      limit,
      filters: {
        domains: Array.from(allDomains).sort(),
        evidenceClasses: Array.from(evidenceClasses).sort(),
        trapTypes: l2TrapTypes.sort(),
        families: l3Families.sort(),
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
