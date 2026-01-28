import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get all questions for the cs372-assignment2 dataset
    const questions = await prisma.question.findMany({
      where: { dataset: 'cs372-assignment2' },
      select: {
        pearlLevel: true,
        trapType: true,
        groundTruth: true,
        difficulty: true,
      },
    });

    // Build distribution data
    const distribution: Record<string, Record<string, Record<string, number>>> = {
      L1: {},
      L2: {},
      L3: {},
    };

    // Initialize difficulty counters
    const difficulties = ['Easy', 'Medium', 'Hard'];

    for (const q of questions) {
      const level = q.pearlLevel;
      const trapCode = q.trapType?.split(':')[0] || 'UNKNOWN';
      const difficulty = q.difficulty || 'Medium';

      if (!distribution[level]) {
        distribution[level] = {};
      }
      if (!distribution[level][trapCode]) {
        distribution[level][trapCode] = { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
      }

      distribution[level][trapCode][difficulty] = (distribution[level][trapCode][difficulty] || 0) + 1;
      distribution[level][trapCode]['Total'] = (distribution[level][trapCode]['Total'] || 0) + 1;
    }

    // Calculate totals by level and difficulty
    const levelTotals: Record<string, Record<string, number>> = {};
    for (const level of ['L1', 'L2', 'L3']) {
      levelTotals[level] = { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
      for (const trapCode of Object.keys(distribution[level] || {})) {
        for (const diff of difficulties) {
          levelTotals[level][diff] += distribution[level][trapCode][diff] || 0;
        }
        levelTotals[level]['Total'] += distribution[level][trapCode]['Total'] || 0;
      }
    }

    // Calculate grand totals
    const grandTotal = {
      Easy: levelTotals.L1.Easy + levelTotals.L2.Easy + levelTotals.L3.Easy,
      Medium: levelTotals.L1.Medium + levelTotals.L2.Medium + levelTotals.L3.Medium,
      Hard: levelTotals.L1.Hard + levelTotals.L2.Hard + levelTotals.L3.Hard,
      Total: levelTotals.L1.Total + levelTotals.L2.Total + levelTotals.L3.Total,
    };

    // L2 Family groupings
    const L2_FAMILIES: Record<string, { name: string; types: string[] }> = {
      F1: { name: 'Selection', types: ['T1', 'T2', 'T3', 'T4'] },
      F2: { name: 'Statistical', types: ['T5', 'T6'] },
      F3: { name: 'Confounding', types: ['T7', 'T8', 'T9'] },
      F4: { name: 'Direction', types: ['T10', 'T11', 'T12'] },
      F5: { name: 'Information', types: ['T13', 'T14'] },
      F6: { name: 'Mechanism', types: ['T15', 'T16', 'T17'] },
    };

    // L1 type names
    const L1_TYPE_NAMES: Record<string, string> = {
      W1: 'Selection Bias', W2: 'Survivorship', W3: 'Healthy User',
      W4: 'Regression to Mean', W5: 'Ecological Fallacy', W6: 'Base Rate',
      W7: 'Confounding', W8: "Simpson's", W9: 'Reverse Causation', W10: 'Post Hoc',
      S1: 'RCT', S2: 'Natural Experiment', S3: 'Lottery/Quasi-Random',
      S4: 'Controlled Ablation', S5: 'Mechanism+Dose', S6: 'Instrumental Variable',
      S7: 'Diff-in-Diff', S8: 'Regression Discontinuity',
    };

    // L2 type names
    const L2_TYPE_NAMES: Record<string, string> = {
      T1: 'SELECTION', T2: 'SURVIVORSHIP', T3: 'COLLIDER', T4: 'IMMORTAL TIME',
      T5: 'REGRESSION', T6: 'ECOLOGICAL',
      T7: 'CONFOUNDER', T8: "SIMPSON'S", T9: 'CONF-MED',
      T10: 'REVERSE', T11: 'FEEDBACK', T12: 'TEMPORAL',
      T13: 'MEASUREMENT', T14: 'RECALL',
      T15: 'MECHANISM', T16: 'GOODHART', T17: 'BACKFIRE',
    };

    // L3 family names
    const L3_FAMILY_NAMES: Record<string, string> = {
      F1: 'Deterministic', F2: 'Probabilistic', F3: 'Overdetermination',
      F4: 'Structural', F5: 'Temporal', F6: 'Epistemic',
      F7: 'Attribution', F8: 'Moral/Legal',
    };

    return NextResponse.json({
      distribution,
      levelTotals,
      grandTotal,
      L2_FAMILIES,
      L1_TYPE_NAMES,
      L2_TYPE_NAMES,
      L3_FAMILY_NAMES,
    });
  } catch (error) {
    console.error('Distribution API error:', error);
    return NextResponse.json({ error: 'Failed to get distribution' }, { status: 500 });
  }
}
