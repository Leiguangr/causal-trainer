import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CHEATSHEET_TAXONOMY } from '@/lib/cheatsheet-taxonomy';

export async function GET() {
  try {
    // Count questions by Pearl level (total and verified).
    // Sources:
    // - Legacy: Question table (L1/L2/L3)
    // - New: L1Case/L2Case/L3Case tables
    const [
      legacyL1,
      legacyL2,
      legacyL3,
      legacyL1Verified,
      legacyL2Verified,
      legacyL3Verified,
      l1Count,
      l2Count,
      l3Count,
      l1Verified,
      l2Verified,
      l3Verified,
    ] = await Promise.all([
      prisma.question.count({ where: { pearlLevel: 'L1' } }),
      prisma.question.count({ where: { pearlLevel: 'L2' } }),
      prisma.question.count({ where: { pearlLevel: 'L3' } }),
      prisma.question.count({ where: { pearlLevel: 'L1', isVerified: true } }),
      prisma.question.count({ where: { pearlLevel: 'L2', isVerified: true } }),
      prisma.question.count({ where: { pearlLevel: 'L3', isVerified: true } }),
      prisma.l1Case.count(),
      prisma.l2Case.count(),
      prisma.l3Case.count(),
      prisma.l1Case.count({ where: { isVerified: true } }),
      prisma.l2Case.count({ where: { isVerified: true } }),
      prisma.l3Case.count({ where: { isVerified: true } }),
    ]);

    // Get trap type distribution
    const allQuestions = await prisma.question.findMany({
      select: { pearlLevel: true, trapType: true, trapSubtype: true },
    });

    // Build trap type counts by level
    const trapDistribution: Record<string, Record<string, { count: number; subtypes: Record<string, number> }>> = {
      L1: {},
      L2: {},
      L3: {},
    };

    // Initialize with all trap types from taxonomy
    CHEATSHEET_TAXONOMY.forEach(trap => {
      trap.pearlLevels.forEach(level => {
        trapDistribution[level][trap.type] = { count: 0, subtypes: {} };
        trap.subtypes
          .filter(s => s.pearlLevel === level)
          .forEach(s => {
            trapDistribution[level][trap.type].subtypes[s.name] = 0;
          });
      });
    });

    // Count existing questions
    allQuestions.forEach(q => {
      if (q.pearlLevel && trapDistribution[q.pearlLevel]) {
        const level = trapDistribution[q.pearlLevel];
        if (q.trapType && level[q.trapType]) {
          level[q.trapType].count++;
          if (q.trapSubtype && level[q.trapType].subtypes[q.trapSubtype] !== undefined) {
            level[q.trapType].subtypes[q.trapSubtype]++;
          }
        }
      }
    });

    // Calculate coverage stats
    const totalTrapTypes = CHEATSHEET_TAXONOMY.length;
    const coveredTrapTypes = new Set(allQuestions.map(q => q.trapType).filter(Boolean)).size;
    const totalSubtypes = CHEATSHEET_TAXONOMY.reduce((sum, t) => sum + t.subtypes.length, 0);
    const coveredSubtypes = new Set(allQuestions.map(q => q.trapSubtype).filter(Boolean)).size;

    return NextResponse.json({
      L1: { current: legacyL1 + l1Count, verified: legacyL1Verified + l1Verified, target: 50 },
      L2: { current: legacyL2 + l2Count, verified: legacyL2Verified + l2Verified, target: 297 },
      L3: { current: legacyL3 + l3Count, verified: legacyL3Verified + l3Verified, target: 103 },
      trapDistribution,
      coverage: {
        trapTypes: { covered: coveredTrapTypes, total: totalTrapTypes },
        subtypes: { covered: coveredSubtypes, total: totalSubtypes },
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

