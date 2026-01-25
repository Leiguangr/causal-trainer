import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, caseType } = body;

    if (!caseId || !caseType) {
      return NextResponse.json(
        { error: 'caseId and caseType are required' },
        { status: 400 }
      );
    }

    // Fetch the original case to get parameters for regeneration guidance
    let originalCase: any = null;
    let pearlLevel: string | null = null;
    let domain: string | null = null;
    let dataset: string = 'default';
    let trapType: string | null = null;
    let family: string | null = null;

    if (caseType === 'legacy') {
      originalCase = await prisma.question.findUnique({ where: { id: caseId } });
      if (originalCase) {
        pearlLevel = originalCase.pearlLevel;
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
        trapType = originalCase.trapType || null;
      }
    } else if (caseType === 'L1') {
      originalCase = await prisma.l1Case.findUnique({ where: { id: caseId } });
      if (originalCase) {
        pearlLevel = 'L1';
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
      }
    } else if (caseType === 'L2') {
      originalCase = await prisma.l2Case.findUnique({ where: { id: caseId } });
      if (originalCase) {
        pearlLevel = 'L2';
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
        trapType = originalCase.trapType || null;
      }
    } else if (caseType === 'L3') {
      originalCase = await prisma.l3Case.findUnique({ where: { id: caseId } });
      if (originalCase) {
        pearlLevel = 'L3';
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
        family = originalCase.family || null;
      }
    }

    if (!originalCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Delete the original case (this will cascade delete evaluations via Prisma)
    if (caseType === 'legacy') {
      await prisma.question.delete({ where: { id: caseId } });
    } else {
      // Try each T3 table
      try {
        await prisma.l1Case.delete({ where: { id: caseId } });
      } catch {
        try {
          await prisma.l2Case.delete({ where: { id: caseId } });
        } catch {
          try {
            await prisma.l3Case.delete({ where: { id: caseId } });
          } catch {
            return NextResponse.json({ error: 'Failed to delete original case' }, { status: 500 });
          }
        }
      }
    }

    // Return parameters that can be used for regeneration
    // The frontend can use these to navigate to the generate page with pre-filled parameters
    return NextResponse.json({
      success: true,
      deleted: true,
      regenerationParams: {
        pearlLevel,
        domain,
        dataset,
        trapType,
        family,
      },
      message: 'Case deleted. Use the Generate page to create a new case with similar parameters.',
    });
  } catch (error) {
    console.error('Regenerate case error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate case' },
      { status: 500 }
    );
  }
}
