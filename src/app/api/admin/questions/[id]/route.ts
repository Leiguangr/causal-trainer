import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Legacy endpoint: Only handles Question table records
// For T3 cases (L1Case, L2Case, L3Case), use /api/admin/t3-cases/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    // Update question (legacy Question table only)
    const question = await prisma.question.update({
      where: { id },
      data: {
        scenario: body.scenario,
        claim: body.claim,
        pearl_level: body.pearl_level,
        domain: body.domain,
        subdomain: body.subdomain,
        trap_type: body.trap_type,
        trap_subtype: body.trap_subtype,
        explanation: body.explanation,
        difficulty: body.difficulty,
        ground_truth: body.ground_truth,
        variables: body.variables,
        causal_structure: body.causal_structure,
        key_insight: body.key_insight,
        wise_refusal: body.wise_refusal,
        // New metadata fields
        author: body.author,
        hidden_timestamp: body.hidden_timestamp,
        conditional_answers: body.conditional_answers,
        review_notes: body.review_notes,
        is_verified: body.is_verified ?? false,
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

    // First, check if the question exists
    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Delete from Question table (legacy only)
    await prisma.question.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete question error:', error);
    
    // Handle Prisma-specific errors
    if (error?.code === 'P2025' || error?.meta?.cause === 'Record to delete does not exist.') {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error?.message || 'Failed to delete question' },
      { status: 500 }
    );
  }
}

