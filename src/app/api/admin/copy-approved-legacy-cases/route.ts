import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataset } = body;

    // Find all legacy Question cases that have APPROVED evaluations
    const whereClause: any = {
      question_id: { not: null },
      overall_verdict: 'APPROVED',
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

    // Track source_case collisions within the same batch
    const sourceCaseTracker = new Map<string, { pearlLevel: string; questionId: string }>();

    // Copy each question to the appropriate case table
    for (const question of questions) {
      const pearlLevel = question.pearl_level;
      if (!pearlLevel || !['L1', 'L2', 'L3'].includes(pearlLevel)) {
        continue;
      }

      // Check for collisions within this batch (same source_case + dataset + pearlLevel)
      if (question.source_case) {
        const collisionKey = `${question.source_case}|${question.dataset}|${pearlLevel}`;
        const existing = sourceCaseTracker.get(collisionKey);
        if (existing) {
          console.warn(
            `Skipping duplicate source_case collision: ${question.source_case} (${pearlLevel}) in dataset ${question.dataset}. ` +
            `Already processing question ${existing.questionId}`
          );
          continue; // Skip duplicate within batch
        }
        sourceCaseTracker.set(collisionKey, { pearlLevel, questionId: question.id });
      }

      // Check if already copied to target table (by checking if a case with same source_case exists in that table)
      const existingCheck = await checkIfAlreadyCopied(pearlLevel, question.source_case, question.dataset);
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

      // Map legacy Question to unified T3Case
      const label = pearlLevel === 'L1'
        ? (question.ground_truth === 'VALID' ? 'YES' : question.ground_truth === 'INVALID' ? 'NO' : 'AMBIGUOUS')
        : pearlLevel === 'L2'
        ? 'NO' // All L2 cases are NO
        : (question.ground_truth === 'VALID' ? 'VALID' : question.ground_truth === 'INVALID' ? 'INVALID' : 'CONDITIONAL');

      const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';

      // Prepare conditional answers for L2/L3 ambiguous cases
      let conditionalAnswers: string | null = null;
      if (isAmbiguous && ((question as any).answerIfA || (question as any).answerIfB)) {
        conditionalAnswers = JSON.stringify({
          answer_if_condition_1: (question as any).answerIfA || '',
          answer_if_condition_2: (question as any).answerIfB || '',
        });
      }

      // Prepare invariants for L3
      let invariants: string | null = null;
      if (pearlLevel === 'L3') {
        try {
          if ((question as any).invariants) {
            const invArray = typeof (question as any).invariants === 'string'
              ? JSON.parse((question as any).invariants)
              : (question as any).invariants;
            invariants = JSON.stringify(Array.isArray(invArray) ? invArray : []);
          }
        } catch {
          invariants = JSON.stringify([]);
        }
      }

      // Ensure variables.Z is an array
      if (!Array.isArray(variables.Z)) {
        variables.Z = variables.Z ? [variables.Z] : [];
      }

      newCase = await prisma.t3Case.create({
        data: {
          pearl_level: pearlLevel,
          scenario: question.scenario,
          claim: pearlLevel === 'L3' ? null : question.claim || null,
          counterfactual_claim: pearlLevel === 'L3' ? question.claim || null : null,
          label,
          is_ambiguous: isAmbiguous,
          variables: JSON.stringify(variables),
          trap_type: question.trap_type || (pearlLevel === 'L3' ? ((question as any).family || 'F1') : 'T1'),
          trap_subtype: question.trap_subtype || null,
          difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          causal_structure: question.causal_structure || null,
          key_insight: (question as any).key_insight || null,
          hidden_timestamp: (question as any).hiddenQuestion || question.hidden_timestamp || null,
          conditional_answers: conditionalAnswers,
          wise_refusal: question.wise_refusal || null,
          gold_rationale: question.explanation || null,
          invariants,
          domain: question.domain || null,
          subdomain: question.subdomain || null,
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          source_case: question.source_case || null,
          is_verified: question.is_verified || false,
        },
      });

      if (pearlLevel === 'L1') byType.L1++;
      else if (pearlLevel === 'L2') byType.L2++;
      else if (pearlLevel === 'L3') byType.L3++;

      if (newCase) {
        newCaseIds.push(newCase.id);
      }
    }

    const skippedCount = questions.length - newCaseIds.length;

    return NextResponse.json({
      success: true,
      copiedCount: newCaseIds.length,
      skippedCount,
      byType,
      newCaseIds: newCaseIds.slice(0, 10), // Return first 10 IDs as sample
      message: `Successfully copied ${newCaseIds.length} approved legacy cases to new schema${skippedCount > 0 ? ` (${skippedCount} skipped due to duplicates or missing data)` : ''}`,
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

  const existing = await prisma.t3Case.findFirst({
    where: {
      source_case: sourceCase,
      dataset,
      pearl_level: pearlLevel,
    },
  });
  return !!existing;
}
