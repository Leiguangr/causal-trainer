import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, caseType, evaluationId } = body;

    if (!caseId || !caseType || !evaluationId) {
      return NextResponse.json(
        { error: 'caseId, caseType, and evaluationId are required' },
        { status: 400 }
      );
    }

    // Fetch the case and evaluation
    const evaluation = await prisma.caseEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        question: true,
        l1Case: true,
        l2Case: true,
        l3Case: true,
      },
    });

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    // Parse rubric score
    let rubricScore: any = null;
    if (evaluation.rubricScore) {
      try {
        rubricScore = JSON.parse(evaluation.rubricScore);
      } catch {
        // Ignore parse errors
      }
    }

    // Get the case data
    const caseData = evaluation.question || evaluation.l1Case || evaluation.l2Case || evaluation.l3Case;
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Build revision prompt based on case type and rubric feedback
    const revisionPrompt = buildRevisionPrompt(caseType, caseData, rubricScore, evaluation);

    // Call LLM to revise
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at revising causal reasoning cases to improve their quality based on rubric feedback. Return only valid JSON matching the case structure.',
        },
        { role: 'user', content: revisionPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Empty response from LLM' }, { status: 500 });
    }

    const revised = JSON.parse(content);

    // Update the case with revised content (only update fields that were revised)
    const updateData: any = {};
    
    if (caseType === 'legacy') {
      if (revised.scenario) updateData.scenario = revised.scenario;
      if (revised.claim) updateData.claim = revised.claim;
      if (revised.explanation) updateData.explanation = revised.explanation;
      if (revised.wiseRefusal) updateData.wiseRefusal = revised.wiseRefusal;
      if (revised.hiddenQuestion) updateData.hiddenQuestion = revised.hiddenQuestion;
      if (revised.answerIfA) updateData.answerIfA = revised.answerIfA;
      if (revised.answerIfB) updateData.answerIfB = revised.answerIfB;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.question.update({
          where: { id: caseId },
          data: updateData,
        });
      }
    } else if (caseType === 'L1') {
      if (revised.scenario) updateData.scenario = revised.scenario;
      if (revised.claim) updateData.claim = revised.claim;
      if (revised.whyFlawedOrValid) updateData.whyFlawedOrValid = revised.whyFlawedOrValid;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.l1Case.update({
          where: { id: caseId },
          data: updateData,
        });
      }
    } else if (caseType === 'L2') {
      if (revised.scenario) updateData.scenario = revised.scenario;
      if (revised.hiddenQuestion) updateData.hiddenQuestion = revised.hiddenQuestion;
      if (revised.answerIfA) updateData.answerIfA = revised.answerIfA;
      if (revised.answerIfB) updateData.answerIfB = revised.answerIfB;
      if (revised.wiseRefusal) updateData.wiseRefusal = revised.wiseRefusal;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.l2Case.update({
          where: { id: caseId },
          data: updateData,
        });
      }
    } else if (caseType === 'L3') {
      if (revised.scenario) updateData.scenario = revised.scenario;
      if (revised.counterfactualClaim) updateData.counterfactualClaim = revised.counterfactualClaim;
      if (revised.justification) updateData.justification = revised.justification;
      if (revised.wiseResponse) updateData.wiseResponse = revised.wiseResponse;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.l3Case.update({
          where: { id: caseId },
          data: updateData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Case revised successfully',
    });
  } catch (error) {
    console.error('Revise case error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revise case' },
      { status: 500 }
    );
  }
}

function buildRevisionPrompt(
  caseType: string,
  caseData: any,
  rubricScore: any,
  evaluation: any
): string {
  const rubricFeedback = rubricScore
    ? Object.entries(rubricScore.categoryNotes || {})
        .map(([cat, note]) => `- ${cat}: ${note}`)
        .join('\n')
    : 'No rubric feedback available';

  const totalScore = rubricScore?.totalScore || 0;
  const acceptanceThreshold = rubricScore?.acceptanceThreshold || 'REVISE';

  let prompt = `You are revising a ${caseType} causal reasoning case to improve its quality based on rubric feedback.

CURRENT RUBRIC SCORE: ${totalScore}/10 (${acceptanceThreshold})
OVERALL VERDICT: ${evaluation.overallVerdict}
PRIORITY: ${evaluation.priorityLevel === 1 ? 'Urgent' : evaluation.priorityLevel === 2 ? 'Normal' : 'Minor'}

RUBRIC FEEDBACK:
${rubricFeedback}

${evaluation.suggestedCorrections ? `SUGGESTED CORRECTIONS:\n${evaluation.suggestedCorrections}\n` : ''}
${evaluation.structuralNotes ? `STRUCTURAL NOTES:\n${evaluation.structuralNotes}\n` : ''}
${evaluation.hasAmbiguity && evaluation.ambiguityNotes ? `AMBIGUITY ISSUES:\n${evaluation.ambiguityNotes}\n` : ''}
${evaluation.hasLogicalIssues && evaluation.logicalIssueNotes ? `LOGICAL ISSUES:\n${evaluation.logicalIssueNotes}\n` : ''}
${evaluation.hasDomainErrors && evaluation.domainErrorNotes ? `DOMAIN ERRORS:\n${evaluation.domainErrorNotes}\n` : ''}

CURRENT CASE DATA:
`;

  if (caseType === 'legacy') {
    prompt += JSON.stringify({
      scenario: caseData.scenario,
      claim: caseData.claim,
      explanation: caseData.explanation,
      wiseRefusal: caseData.wiseRefusal,
      hiddenQuestion: caseData.hiddenQuestion,
      answerIfA: caseData.answerIfA,
      answerIfB: caseData.answerIfB,
    }, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields: scenario, claim, explanation, wiseRefusal, hiddenQuestion, answerIfA, answerIfB. Only include fields that need revision.`;
  } else if (caseType === 'L1') {
    prompt += JSON.stringify({
      scenario: caseData.scenario,
      claim: caseData.claim,
      whyFlawedOrValid: caseData.whyFlawedOrValid,
    }, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields: scenario, claim, whyFlawedOrValid. Only include fields that need revision.`;
  } else if (caseType === 'L2') {
    prompt += JSON.stringify({
      scenario: caseData.scenario,
      hiddenQuestion: caseData.hiddenQuestion,
      answerIfA: caseData.answerIfA,
      answerIfB: caseData.answerIfB,
      wiseRefusal: caseData.wiseRefusal,
    }, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields: scenario, hiddenQuestion, answerIfA, answerIfB, wiseRefusal. Only include fields that need revision.`;
  } else if (caseType === 'L3') {
    prompt += JSON.stringify({
      scenario: caseData.scenario,
      counterfactualClaim: caseData.counterfactualClaim,
      justification: caseData.justification,
      wiseResponse: caseData.wiseResponse,
    }, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields: scenario, counterfactualClaim, justification, wiseResponse. Only include fields that need revision.`;
  }

  return prompt;
}
