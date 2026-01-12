import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { id } = params;

    // Update question
    const question = await prisma.question.update({
      where: { id },
      data: {
        scenario: body.scenario,
        // claim/explanation are legacy-only; allow updates but they are not
        // required by the new unified schema
        claim: body.claim ?? null,
        pearlLevel: body.pearlLevel,
        domain: body.domain,
        subdomain: body.subdomain,
        trapType: body.trapType,
        trapSubtype: body.trapSubtype,
        explanation: body.explanation ?? null,
        difficulty: body.difficulty,
        groundTruth: body.groundTruth,
        variables: body.variables,
        causalStructure: body.causalStructure,
        keyInsight: body.keyInsight,
        wiseRefusal: body.wiseRefusal,
        hiddenTimestamp: body.hiddenTimestamp,
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
