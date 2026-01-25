import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataset } = body;

    // Find all legacy Question cases that have APPROVED evaluations
    const whereClause: any = {
      questionId: { not: null },
      overallVerdict: 'APPROVED',
    };

    if (dataset) {
      whereClause.question = {
        dataset,
      };
    }

    const approvedEvaluations = await prisma.caseEvaluation.findMany({
      where: whereClause,
      include: {
        question: true,
      },
    });

    if (approvedEvaluations.length === 0) {
      return NextResponse.json({
        success: true,
        copiedCount: 0,
        byType: { L1: 0, L2: 0, L3: 0 },
        message: 'No approved legacy cases found to copy',
      });
    }

    // Group by question ID to avoid duplicates
    const uniqueQuestions = new Map<string, typeof approvedEvaluations[0]['question']>();
    for (const eval_ of approvedEvaluations) {
      if (eval_.question && !uniqueQuestions.has(eval_.question.id)) {
        uniqueQuestions.set(eval_.question.id, eval_.question);
      }
    }

    const questions = Array.from(uniqueQuestions.values());
    const byType = { L1: 0, L2: 0, L3: 0 };
    const newCaseIds: string[] = [];

    // Copy each question to the appropriate case table
    for (const question of questions) {
      const pearlLevel = question.pearlLevel;
      if (!pearlLevel || !['L1', 'L2', 'L3'].includes(pearlLevel)) {
        continue;
      }

      // Check if already copied (by checking if a case with same sourceCase exists)
      const existingCheck = await checkIfAlreadyCopied(pearlLevel, question.sourceCase, question.dataset);
      if (existingCheck) {
        continue; // Skip if already copied
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
        variables = { X: '', Y: '' };
      }

      let newCase: any = null;

      if (pearlLevel === 'L1') {
        // Map legacy Question to L1Case
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
            evidenceType: question.trapType || null,
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
        byType.L1++;
      } else if (pearlLevel === 'L2') {
        // Map legacy Question to L2Case
        newCase = await prisma.l2Case.create({
          data: {
            scenario: question.scenario,
            variables: question.variables ? JSON.stringify(variables) : null,
            trapType: question.trapType || 'T1',
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
        byType.L2++;
      } else if (pearlLevel === 'L3') {
        // Map legacy Question to L3Case
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
            family: (question as any).family || 'F1',
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
        byType.L3++;
      }

      if (newCase) {
        newCaseIds.push(newCase.id);
      }
    }

    return NextResponse.json({
      success: true,
      copiedCount: newCaseIds.length,
      byType,
      newCaseIds: newCaseIds.slice(0, 10), // Return first 10 IDs as sample
      message: `Successfully copied ${newCaseIds.length} approved legacy cases to new schema`,
    });
  } catch (error) {
    console.error('Copy approved legacy cases error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to copy approved legacy cases' },
      { status: 500 }
    );
  }
}

async function checkIfAlreadyCopied(
  pearlLevel: string,
  sourceCase: string | null,
  dataset: string
): Promise<boolean> {
  if (!sourceCase) return false; // Can't check without sourceCase

  if (pearlLevel === 'L1') {
    const existing = await prisma.l1Case.findFirst({
      where: {
        sourceCase,
        dataset,
      },
    });
    return !!existing;
  } else if (pearlLevel === 'L2') {
    const existing = await prisma.l2Case.findFirst({
      where: {
        sourceCase,
        dataset,
      },
    });
    return !!existing;
  } else if (pearlLevel === 'L3') {
    const existing = await prisma.l3Case.findFirst({
      where: {
        sourceCase,
        dataset,
      },
    });
    return !!existing;
  }

  return false;
}
