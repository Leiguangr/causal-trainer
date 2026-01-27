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
        pearlLevel = originalCase.pearl_level;
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
        trapType = originalCase.trap_type || null;
      }
    } else {
      // T3Case unified schema
      originalCase = await prisma.t3Case.findUnique({ where: { id: caseId } });
      if (originalCase) {
        pearlLevel = originalCase.pearl_level;
        domain = originalCase.domain || null;
        dataset = originalCase.dataset || 'default';
        trapType = originalCase.trap_type || null;
        if (originalCase.pearl_level === 'L3') {
          family = originalCase.trap_type; // L3 uses trap_type to store family
        }
      }
    }

    if (!originalCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Delete the original case (this will cascade delete evaluations via Prisma)
    if (caseType === 'legacy') {
      await prisma.question.delete({ where: { id: caseId } });
    } else {
      // T3Case unified schema
      await prisma.t3Case.delete({ where: { id: caseId } });
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
