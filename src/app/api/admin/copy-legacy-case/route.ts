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

    const pearlLevel = question.pearl_level;
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

    // Ensure variables.Z is an array
    if (!Array.isArray(variables.Z)) {
      variables.Z = variables.Z ? [String(variables.Z)] : [];
    }

    if (pearlLevel === 'L1') {
      // Map legacy Question to unified T3Case (L1)
      // Determine evidence class and type from ground truth and trap_type
      let evidenceClass: 'WOLF' | 'SHEEP' | 'NONE' = 'NONE';
      let trapType = 'A'; // Default to Ambiguous
      
      if (question.ground_truth === 'NO' || question.ground_truth === 'INVALID') {
        evidenceClass = 'WOLF';
        trapType = question.trap_type || 'W1'; // Default to W1 if missing
      } else if (question.ground_truth === 'YES' || question.ground_truth === 'VALID') {
        evidenceClass = 'SHEEP';
        trapType = question.trap_type || 'S1'; // Default to S1 if missing
      } else {
        trapType = 'A'; // Ambiguous
      }

      const label = question.ground_truth === 'VALID' ? 'YES' : question.ground_truth === 'INVALID' ? 'NO' : 'AMBIGUOUS';

      newCase = await prisma.t3Case.create({
        data: {
          pearl_level: 'L1',
          scenario: question.scenario,
          claim: question.claim,
          label,
          is_ambiguous: label === 'AMBIGUOUS',
          variables: JSON.stringify(variables),
          trap_type: trapType,
          trap_type_name: evidenceClass !== 'NONE' ? evidenceClass : null,
          difficulty: (question.difficulty?.charAt(0).toUpperCase() + question.difficulty?.slice(1)) || 'Medium',
          causal_structure: question.causal_structure || null,
          gold_rationale: question.explanation || null,
          domain: question.domain || null,
          subdomain: question.subdomain || null,
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          source_case: question.source_case || null,
          is_verified: question.is_verified || false,
        },
      });
    } else if (pearlLevel === 'L2') {
      // Map legacy Question to unified T3Case (L2)
      // Parse conditional answers from legacy fields
      let conditionalAnswers: string | null = null;
      if ((question as any).answerIfA || (question as any).answerIfB) {
        conditionalAnswers = JSON.stringify({
          answer_if_condition_1: (question as any).answerIfA || '',
          answer_if_condition_2: (question as any).answerIfB || '',
        });
      }

      newCase = await prisma.t3Case.create({
        data: {
          pearl_level: 'L2',
          scenario: question.scenario,
          claim: question.claim || null,
          label: 'NO', // All L2 cases are NO
          is_ambiguous: true, // L2 cases are ambiguous by nature
          variables: JSON.stringify(variables),
          trap_type: question.trap_type || 'T1', // Default to T1 if missing
          difficulty: (question.difficulty?.charAt(0).toUpperCase() + question.difficulty?.slice(1)) || 'Medium',
          causal_structure: question.causal_structure || null,
          hidden_timestamp: (question as any).hiddenQuestion || question.hidden_timestamp || null,
          conditional_answers: conditionalAnswers,
          wise_refusal: question.wise_refusal || null,
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          source_case: question.source_case || null,
          is_verified: question.is_verified || false,
        },
      });
    } else if (pearlLevel === 'L3') {
      // Map legacy Question to unified T3Case (L3)
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

      const label = question.ground_truth === 'VALID' ? 'VALID' : question.ground_truth === 'INVALID' ? 'INVALID' : 'CONDITIONAL';

      newCase = await prisma.t3Case.create({
        data: {
          pearl_level: 'L3',
          case_id: question.source_case || null,
          scenario: question.scenario,
          counterfactual_claim: question.claim,
          label,
          is_ambiguous: label === 'CONDITIONAL',
          variables: JSON.stringify(variables),
          trap_type: (question as any).family || question.trap_type || 'F1', // Family stored in trap_type
          invariants: JSON.stringify(invariants),
          difficulty: (question.difficulty?.charAt(0).toUpperCase() + question.difficulty?.slice(1)) || 'Medium',
          gold_rationale: question.explanation || null,
          wise_refusal: question.wise_refusal || null,
          domain: question.domain || null,
          dataset: question.dataset || 'default',
          author: question.author || 'Legacy Migration',
          source_case: question.source_case || null,
          is_verified: question.is_verified || false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      newCaseId: newCase.id,
      caseType: pearlLevel,
      message: `Legacy case copied to T3Case (${pearlLevel}) successfully`,
    });
  } catch (error) {
    console.error('Copy legacy case error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to copy legacy case' },
      { status: 500 }
    );
  }
}
