import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // Fetch the legacy question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const pearlLevel = question.pearlLevel;
    if (!pearlLevel || !['L1', 'L2', 'L3'].includes(pearlLevel)) {
      return NextResponse.json(
        { error: 'Invalid pearl level. Must be L1, L2, or L3.' },
        { status: 400 }
      );
    }

    // Parse variables
    let variables: Record<string, any> = {};
    try {
      if (question.variables) {
        variables = typeof question.variables === 'string'
          ? JSON.parse(question.variables)
          : question.variables;
      }
    } catch {
      // Use default structure
      variables = { X: '', Y: '' };
    }

    let newCase: any = null;

    if (pearlLevel === 'L1') {
      // Map legacy Question to L1Case
      // Determine evidence class from ground truth
      let evidenceClass: 'WOLF' | 'SHEEP' | 'NONE' = 'NONE';
      if (question.groundTruth === 'NO' || question.groundTruth === 'INVALID') {
        evidenceClass = 'WOLF';
      } else if (question.groundTruth === 'YES' || question.groundTruth === 'VALID') {
        evidenceClass = 'SHEEP';
      }

      newCase = await prisma.l1Case.create({
        data: {
          scenario: question.scenario,
          claim: question.claim,
          groundTruth: question.groundTruth === 'VALID' ? 'YES' : question.groundTruth === 'INVALID' ? 'NO' : 'AMBIGUOUS',
          evidenceClass,
          evidenceType: question.trapType || null, // Map trapType to evidenceType
          whyFlawedOrValid: question.explanation || '',
          domain: question.domain || null,
          subdomain: question.subdomain || null,
          difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          variables: question.variables ? JSON.stringify(variables) : null,
          causalStructure: question.causalStructure || null,
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          sourceCase: question.sourceCase || null,
          isVerified: question.isVerified || false,
        },
      });
    } else if (pearlLevel === 'L2') {
      // Map legacy Question to L2Case
      newCase = await prisma.l2Case.create({
        data: {
          scenario: question.scenario,
          variables: question.variables ? JSON.stringify(variables) : null,
          trapType: question.trapType || 'T1', // Default to T1 if missing
          difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          causalStructure: question.causalStructure || null,
          hiddenQuestion: question.hiddenQuestion || '',
          answerIfA: question.answerIfA || '',
          answerIfB: question.answerIfB || '',
          wiseRefusal: question.wiseRefusal || '',
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          sourceCase: question.sourceCase || null,
          isVerified: question.isVerified || false,
        },
      });
    } else if (pearlLevel === 'L3') {
      // Map legacy Question to L3Case
      // Parse invariants if available
      let invariants: string[] = [];
      try {
        if ((question as any).invariants) {
          invariants = typeof (question as any).invariants === 'string'
            ? JSON.parse((question as any).invariants)
            : (question as any).invariants;
        }
      } catch {
        invariants = [];
      }

      // Ensure variables have X, Y, Z
      if (!variables.X) variables.X = '';
      if (!variables.Y) variables.Y = '';
      if (!variables.Z) variables.Z = '';

      newCase = await prisma.l3Case.create({
        data: {
          caseId: question.sourceCase || null,
          domain: question.domain || null,
          family: (question as any).family || 'F1', // Default to F1 if missing
          difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          scenario: question.scenario,
          counterfactualClaim: question.claim,
          variables: JSON.stringify(variables),
          invariants: JSON.stringify(invariants),
          groundTruth: question.groundTruth === 'VALID' ? 'VALID' : question.groundTruth === 'INVALID' ? 'INVALID' : 'CONDITIONAL',
          justification: question.explanation || '',
          wiseResponse: question.wiseRefusal || '',
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          sourceCase: question.sourceCase || null,
          isVerified: question.isVerified || false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      newCaseId: newCase.id,
      caseType: pearlLevel,
      message: `Legacy case copied to ${pearlLevel}Case successfully`,
    });
  } catch (error) {
    console.error('Copy legacy case error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to copy legacy case' },
      { status: 500 }
    );
  }
}
