import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/datasets/[name] - Delete all items in a dataset (legacy + T3)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    // Dataset is a required field with default "default"
    const datasetName = name || 'default';

    // Count items to be deleted
    const qCount = await prisma.question.count({ where: { dataset: datasetName } });
    let t3Count = 0;
    try {
      t3Count = await prisma.t3Case.count({ where: { dataset: datasetName } });
    } catch (error: any) {
      if (!error?.message?.includes('does not exist') && error?.code !== 'P2021') {
        throw error;
      }
      // T3Case table doesn't exist, continue with 0 count
    }

    // Count evaluation batches that reference this dataset
    const evalBatchCount = await prisma.evaluationBatch.count({ 
      where: { dataset: datasetName } 
    });

    const total = qCount + t3Count;

    if (total === 0 && evalBatchCount === 0) {
      return NextResponse.json({
        success: true,
        message: `No items found in dataset "${datasetName}"`,
        deletedCount: 0,
        deletedEvaluationBatches: 0,
      });
    }

    // Delete evaluation batches first (this will cascade delete their evaluations)
    // We need to delete evaluations manually since there's no cascade from EvaluationBatch to CaseEvaluation
    const evalBatches = await prisma.evaluationBatch.findMany({
      where: { dataset: datasetName },
      select: { id: true },
    });
    
    let deletedEvalBatches = 0;
    if (evalBatches.length > 0) {
      // Delete all evaluations for these batches first
      await prisma.caseEvaluation.deleteMany({
        where: { evaluation_batch_id: { in: evalBatches.map(b => b.id) } },
      });
      
      // Then delete the batches
      const deleted = await prisma.evaluationBatch.deleteMany({ 
        where: { dataset: datasetName } 
      });
      deletedEvalBatches = deleted.count;
    }

    // Delete all items in this dataset
    // Order shouldn't matter (no cross-table required FKs by dataset), but delete evaluations via cascades if configured.
    const qDeleted = await prisma.question.deleteMany({ where: { dataset: datasetName } });
    let t3Deleted = { count: 0 };
    try {
      t3Deleted = await prisma.t3Case.deleteMany({ where: { dataset: datasetName } });
    } catch (error: any) {
      if (!error?.message?.includes('does not exist') && error?.code !== 'P2021') {
        throw error;
      }
      // T3Case table doesn't exist, continue with 0 deleted
    }

    const deletedTotal = qDeleted.count + t3Deleted.count;

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedTotal} items from dataset "${datasetName}" (legacy=${qDeleted.count}, t3=${t3Deleted.count})${deletedEvalBatches > 0 ? ` and ${deletedEvalBatches} evaluation batch(es)` : ''}`,
      deletedCount: deletedTotal,
      deletedEvaluationBatches: deletedEvalBatches,
    });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return NextResponse.json(
      { error: 'Failed to delete dataset' },
      { status: 500 }
    );
  }
}

// GET /api/admin/datasets/[name] - Get dataset info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const datasetName = name || 'default';

    const [
      totalLegacy,
      verifiedLegacy,
      levelCountsLegacy,
      truthCountsLegacy,
    ] = await Promise.all([
      prisma.question.count({ where: { dataset: datasetName } }),
      prisma.question.count({ where: { dataset: datasetName, is_verified: true } }),
      prisma.question.groupBy({
        by: ['pearl_level'],
        where: { dataset: datasetName },
        _count: true,
      }),
      prisma.question.groupBy({
        by: ['ground_truth'],
        where: { dataset: datasetName },
        _count: true,
      }),
    ]);

    // Handle T3Case queries - table might not exist if migrations haven't been applied
    let totalT3 = 0;
    let verifiedT3 = 0;
    let levelCountsT3: Array<{ pearl_level: string; _count: number }> = [];
    let labelCountsT3: Array<{ label: string; _count: number }> = [];

    try {
      const t3Results = await Promise.all([
        prisma.t3Case.count({ where: { dataset: datasetName } }).catch(() => 0),
        prisma.t3Case.count({ where: { dataset: datasetName, is_verified: true } }).catch(() => 0),
        prisma.t3Case.groupBy({
          by: ['pearl_level'],
          where: { dataset: datasetName },
          _count: true,
        }).catch(() => []),
        prisma.t3Case.groupBy({
          by: ['label'],
          where: { dataset: datasetName },
          _count: true,
        }).catch(() => []),
      ]);
      [totalT3, verifiedT3, levelCountsT3, labelCountsT3] = t3Results;
    } catch (error: any) {
      if (!error?.message?.includes('does not exist') && error?.code !== 'P2021') {
        throw error;
      }
      // T3Case table doesn't exist, continue with empty arrays and 0 counts
    }

    const totalCount = totalLegacy + totalT3;
    const verifiedCount = verifiedLegacy + verifiedT3;

    // Combine level counts from both sources
    const byLevel = new Map<string, number>();
    levelCountsLegacy.forEach(l => byLevel.set(l.pearl_level, (byLevel.get(l.pearl_level) || 0) + l._count));
    levelCountsT3.forEach(l => byLevel.set(l.pearl_level, (byLevel.get(l.pearl_level) || 0) + l._count));

    // Combine ground truth/label counts
    const byGroundTruth = new Map<string, number>();
    truthCountsLegacy.forEach(t => byGroundTruth.set(t.ground_truth, (byGroundTruth.get(t.ground_truth) || 0) + t._count));
    labelCountsT3.forEach(l => byGroundTruth.set(l.label, (byGroundTruth.get(l.label) || 0) + l._count));

    return NextResponse.json({
      name: datasetName,
      totalCount,
      verifiedCount,
      byLevel: Object.fromEntries(byLevel),
      byGroundTruth: Object.fromEntries(byGroundTruth),
      byTable: {
        legacy: totalLegacy,
        t3: totalT3,
      },
    });
  } catch (error) {
    console.error('Error getting dataset info:', error);
    return NextResponse.json(
      { error: 'Failed to get dataset info' },
      { status: 500 }
    );
  }
}

