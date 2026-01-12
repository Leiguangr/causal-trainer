import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/datasets/[name] - Delete all questions in a dataset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    // Dataset is a required field with default "default"
    const datasetName = name || 'default';

    // Count questions to be deleted
    const count = await prisma.question.count({
      where: { dataset: datasetName },
    });

    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: `No questions found in dataset "${datasetName}"`,
        deletedCount: 0,
      });
    }

    // Delete all questions in this dataset
    const result = await prisma.question.deleteMany({
      where: { dataset: datasetName },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} questions from dataset "${datasetName}"`,
      deletedCount: result.count,
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

    const totalCount = await prisma.question.count({
      where: { dataset: datasetName },
    });

    const verifiedCount = await prisma.question.count({
      where: { dataset: datasetName, isVerified: true },
    });

    const levelCounts = await prisma.question.groupBy({
      by: ['pearlLevel'],
      where: { dataset: datasetName },
      _count: true,
    });

    const truthCounts = await prisma.question.groupBy({
      by: ['groundTruth'],
      where: { dataset: datasetName },
      _count: true,
    });

    return NextResponse.json({
      name: datasetName,
      totalCount,
      verifiedCount,
      byLevel: Object.fromEntries(levelCounts.map(l => [l.pearlLevel, l._count])),
      byGroundTruth: Object.fromEntries(truthCounts.map(t => [t.groundTruth, t._count])),
    });
  } catch (error) {
    console.error('Error getting dataset info:', error);
    return NextResponse.json(
      { error: 'Failed to get dataset info' },
      { status: 500 }
    );
  }
}

