import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;
    const caseType = body._caseType; // L1, L2, or L3

    // Determine which table to update by checking which one exists
    const [l1Exists, l2Exists, l3Exists] = await Promise.all([
      prisma.l1Case.findUnique({ where: { id }, select: { id: true } }),
      prisma.l2Case.findUnique({ where: { id }, select: { id: true } }),
      prisma.l3Case.findUnique({ where: { id }, select: { id: true } }),
    ]);

    if (l1Exists || caseType === 'L1') {
      // Update L1Case
      const l1Case = await prisma.l1Case.update({
        where: { id },
        data: {
          scenario: body.scenario,
          claim: body.claim,
          groundTruth: body.groundTruth,
          evidenceClass: body.evidenceClass,
          evidenceType: body.evidenceType,
          whyFlawedOrValid: body.whyFlawedOrValid,
          domain: body.domain,
          subdomain: body.subdomain,
          difficulty: body.difficulty,
          variables: typeof body.variables === 'string' ? body.variables : (body.variables ? JSON.stringify(body.variables) : null),
          causalStructure: body.causalStructure,
          author: body.author,
          isVerified: body.isVerified ?? false,
        },
      });
      return NextResponse.json({ success: true, case: l1Case });
    }

    if (l2Exists || caseType === 'L2') {
      // Update L2Case
      const l2Case = await prisma.l2Case.update({
        where: { id },
        data: {
          scenario: body.scenario,
          variables: typeof body.variables === 'string' ? body.variables : (body.variables ? JSON.stringify(body.variables) : null),
          trapType: body.trapType,
          difficulty: body.difficulty,
          causalStructure: body.causalStructure,
          hiddenQuestion: body.hiddenQuestion,
          answerIfA: body.answerIfA,
          answerIfB: body.answerIfB,
          wiseRefusal: body.wiseRefusal,
          author: body.author,
          isVerified: body.isVerified ?? false,
        },
      });
      return NextResponse.json({ success: true, case: l2Case });
    }

    if (l3Exists || caseType === 'L3') {
      // Update L3Case
      const l3Case = await prisma.l3Case.update({
        where: { id },
        data: {
          caseId: body.caseId,
          domain: body.domain,
          family: body.family,
          difficulty: body.difficulty,
          scenario: body.scenario,
          counterfactualClaim: body.counterfactualClaim,
          variables: typeof body.variables === 'string' ? body.variables : (body.variables ? JSON.stringify(body.variables) : null),
          invariants: typeof body.invariants === 'string' ? body.invariants : (Array.isArray(body.invariants) ? JSON.stringify(body.invariants) : body.invariants),
          groundTruth: body.groundTruth,
          justification: body.justification,
          wiseResponse: body.wiseResponse,
          author: body.author,
          isVerified: body.isVerified ?? false,
        },
      });
      return NextResponse.json({ success: true, case: l3Case });
    }

    return NextResponse.json(
      { error: 'Case not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Update T3 case error:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
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

    // Try to delete from each table in order
    try {
      await prisma.l1Case.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (l1Error) {
      // Not L1Case, try L2Case
      try {
        await prisma.l2Case.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch (l2Error) {
        // Not L2Case, try L3Case
        try {
          await prisma.l3Case.delete({ where: { id } });
          return NextResponse.json({ success: true });
        } catch (l3Error) {
          return NextResponse.json(
            { error: 'Case not found' },
            { status: 404 }
          );
        }
      }
    }
  } catch (error) {
    console.error('Delete T3 case error:', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}
