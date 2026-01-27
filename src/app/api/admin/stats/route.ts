import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CHEATSHEET_TAXONOMY } from '@/lib/cheatsheet-taxonomy';

export async function GET() {
  try {
    // Count questions by Pearl level (total and verified).
    // Sources:
    // - Legacy: Question table (L1/L2/L3)
    // - New: Unified T3Case table
    const [
      legacyL1,
      legacyL2,
      legacyL3,
      legacyL1Verified,
      legacyL2Verified,
      legacyL3Verified,
    ] = await Promise.all([
      prisma.question.count({ where: { pearl_level: 'L1' } }),
      prisma.question.count({ where: { pearl_level: 'L2' } }),
      prisma.question.count({ where: { pearl_level: 'L3' } }),
      prisma.question.count({ where: { pearl_level: 'L1', is_verified: true } }),
      prisma.question.count({ where: { pearl_level: 'L2', is_verified: true } }),
      prisma.question.count({ where: { pearl_level: 'L3', is_verified: true } }),
    ]);

    // Handle T3Case queries - table might not exist if migrations haven't been applied
    let t3L1Count = 0;
    let t3L2Count = 0;
    let t3L3Count = 0;
    let t3L1Verified = 0;
    let t3L2Verified = 0;
    let t3L3Verified = 0;

    try {
      const t3Counts = await Promise.all([
        prisma.t3Case.count({ where: { pearl_level: 'L1' } }).catch(() => 0),
        prisma.t3Case.count({ where: { pearl_level: 'L2' } }).catch(() => 0),
        prisma.t3Case.count({ where: { pearl_level: 'L3' } }).catch(() => 0),
        prisma.t3Case.count({ where: { pearl_level: 'L1', is_verified: true } }).catch(() => 0),
        prisma.t3Case.count({ where: { pearl_level: 'L2', is_verified: true } }).catch(() => 0),
        prisma.t3Case.count({ where: { pearl_level: 'L3', is_verified: true } }).catch(() => 0),
      ]);
      [t3L1Count, t3L2Count, t3L3Count, t3L1Verified, t3L2Verified, t3L3Verified] = t3Counts;
    } catch (error: any) {
      // If T3Case table doesn't exist, log warning and continue with 0 counts
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        console.warn('T3Case table does not exist yet. Run migrations: npx prisma migrate deploy');
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }

    // Get trap type distribution
    const allQuestions = await prisma.question.findMany({
      select: { pearl_level: true, trap_type: true, trap_subtype: true },
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
      if (q.pearl_level && trapDistribution[q.pearl_level]) {
        const level = trapDistribution[q.pearl_level];
        if (q.trap_type && level[q.trap_type]) {
          level[q.trap_type].count++;
          if (q.trap_subtype && level[q.trap_type].subtypes[q.trap_subtype] !== undefined) {
            level[q.trap_type].subtypes[q.trap_subtype]++;
          }
        }
      }
    });

    // Calculate coverage stats
    const totalTrapTypes = CHEATSHEET_TAXONOMY.length;
    const coveredTrapTypes = new Set(allQuestions.map(q => q.trap_type).filter(Boolean)).size;
    const totalSubtypes = CHEATSHEET_TAXONOMY.reduce((sum, t) => sum + t.subtypes.length, 0);
    const coveredSubtypes = new Set(allQuestions.map(q => q.trap_subtype).filter(Boolean)).size;

    return NextResponse.json({
      L1: { current: legacyL1 + t3L1Count, verified: legacyL1Verified + t3L1Verified, target: 50 },
      L2: { current: legacyL2 + t3L2Count, verified: legacyL2Verified + t3L2Verified, target: 297 },
      L3: { current: legacyL3 + t3L3Count, verified: legacyL3Verified + t3L3Verified, target: 103 },
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

