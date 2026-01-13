import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    // Update question
    const question = await prisma.question.update({
      where: { id },
      data: {
        scenario: body.scenario,
        claim: body.claim,
        pearlLevel: body.pearlLevel,
        domain: body.domain,
        subdomain: body.subdomain,
        trapType: body.trapType,
        trapSubtype: body.trapSubtype,
        explanation: body.explanation,
        difficulty: body.difficulty,
        groundTruth: body.groundTruth,
        variables: body.variables,
        causalStructure: body.causalStructure,
        keyInsight: body.keyInsight,
        wiseRefusal: body.wiseRefusal,
        // New metadata fields
        author: body.author,
        hiddenTimestamp: body.hiddenTimestamp,
        conditionalAnswers: body.conditionalAnswers,
        reviewNotes: body.reviewNotes,
        isVerified: body.isVerified ?? false,
      },
    });

    return NextResponse.json({ success: true, question });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}

