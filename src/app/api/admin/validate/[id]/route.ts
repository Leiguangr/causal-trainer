import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH: Update validation scores for a question
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    const question = await prisma.question.update({
      where: { id },
      data: {
        validator: body.validator,
        validationStatus: body.validationStatus,
        validatorNotes: body.validatorNotes,
        // Revised rubric scores (Table 7)
        scenarioClarityScore: body.scenarioClarityScore,      // 0-1 pt
        hiddenQuestionScore: body.hiddenQuestionScore,        // 0-1 pt
        conditionalAnswerAScore: body.conditionalAnswerAScore, // 0-1.5 pts
        conditionalAnswerBScore: body.conditionalAnswerBScore, // 0-1.5 pts
        wiseRefusalScore: body.wiseRefusalScore,              // 0-2 pts
        difficultyCalibrationScore: body.difficultyCalibrationScore, // 0-1 pt
        finalLabelScore: body.finalLabelScore,                // 0-1 pt (NEW)
        trapTypeScore: body.trapTypeScore,                    // 0-1 pt (NEW)
        finalScore: body.finalScore,                          // 0-10 total
        // Also mark as verified if approved
        isVerified: body.validationStatus === 'approved',
      },
    });

    return NextResponse.json({ success: true, question });
  } catch (error) {
    console.error('Error updating validation:', error);
    return NextResponse.json(
      { error: 'Failed to update validation' },
      { status: 500 }
    );
  }
}

// PUT: Update question content (JSON editing)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    // Only allow updating specific content fields (not metadata)
    const allowedFields = [
      'scenario', 'claim', 'groundTruth', 'difficulty',
      'variables', 'trapType', 'trapSubtype', 
      'causalStructure', 'keyInsight', 'explanation',
      'wiseRefusal', 'hiddenTimestamp', 'conditionalAnswers',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Handle JSON fields
        if (['variables', 'conditionalAnswers'].includes(field) && typeof body[field] === 'object') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const question = await prisma.question.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, question });
  } catch (error) {
    console.error('Error updating question content:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

// GET: Get a single question for validation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

