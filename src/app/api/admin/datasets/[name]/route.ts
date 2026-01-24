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
    const [qCount, l1Count, l2Count, l3Count] = await Promise.all([
      prisma.question.count({ where: { dataset: datasetName } }),
      prisma.l1Case.count({ where: { dataset: datasetName } }),
      prisma.l2Case.count({ where: { dataset: datasetName } }),
      prisma.l3Case.count({ where: { dataset: datasetName } }),
    ]);

    const total = qCount + l1Count + l2Count + l3Count;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        message: `No items found in dataset "${datasetName}"`,
        deletedCount: 0,
      });
    }

    // Delete all items in this dataset
    // Order shouldn't matter (no cross-table required FKs by dataset), but delete evaluations via cascades if configured.
    const [qDeleted, l1Deleted, l2Deleted, l3Deleted] = await Promise.all([
      prisma.question.deleteMany({ where: { dataset: datasetName } }),
      prisma.l1Case.deleteMany({ where: { dataset: datasetName } }),
      prisma.l2Case.deleteMany({ where: { dataset: datasetName } }),
      prisma.l3Case.deleteMany({ where: { dataset: datasetName } }),
    ]);

    const deletedTotal = qDeleted.count + l1Deleted.count + l2Deleted.count + l3Deleted.count;

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedTotal} items from dataset "${datasetName}" (legacy=${qDeleted.count}, l1=${l1Deleted.count}, l2=${l2Deleted.count}, l3=${l3Deleted.count})`,
      deletedCount: deletedTotal,
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
      totalL1,
      totalL2,
      totalL3,
      verifiedLegacy,
      verifiedL1,
      verifiedL2,
      verifiedL3,
      levelCountsLegacy,
      truthCountsLegacy,
    ] = await Promise.all([
      prisma.question.count({ where: { dataset: datasetName } }),
      prisma.l1Case.count({ where: { dataset: datasetName } }),
      prisma.l2Case.count({ where: { dataset: datasetName } }),
      prisma.l3Case.count({ where: { dataset: datasetName } }),
      prisma.question.count({ where: { dataset: datasetName, isVerified: true } }),
      prisma.l1Case.count({ where: { dataset: datasetName, isVerified: true } }),
      prisma.l2Case.count({ where: { dataset: datasetName, isVerified: true } }),
      prisma.l3Case.count({ where: { dataset: datasetName, isVerified: true } }),
      prisma.question.groupBy({
        by: ['pearlLevel'],
        where: { dataset: datasetName },
        _count: true,
      }),
      prisma.question.groupBy({
        by: ['groundTruth'],
        where: { dataset: datasetName },
        _count: true,
      }),
    ]);

    const totalCount = totalLegacy + totalL1 + totalL2 + totalL3;
    const verifiedCount = verifiedLegacy + verifiedL1 + verifiedL2 + verifiedL3;

    return NextResponse.json({
      name: datasetName,
      totalCount,
      verifiedCount,
      byLevel: Object.fromEntries(levelCountsLegacy.map(l => [l.pearlLevel, l._count])),
      byGroundTruth: Object.fromEntries(truthCountsLegacy.map(t => [t.groundTruth, t._count])),
      byTable: {
        legacy: totalLegacy,
        l1: totalL1,
        l2: totalL2,
        l3: totalL3,
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

