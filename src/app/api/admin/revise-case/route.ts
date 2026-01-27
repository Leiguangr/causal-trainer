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
        t3_case: true,
      },
    });

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    // Parse rubric score
    let rubricScore: any = null;
    if (evaluation.rubric_score) {
      try {
        rubricScore = JSON.parse(evaluation.rubric_score);
      } catch {
        // Ignore parse errors
      }
    }

    // Get the case data
    const caseData = evaluation.question || evaluation.t3_case;
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
      if (revised.wiseRefusal) updateData.wise_refusal = revised.wiseRefusal;
      if (revised.hiddenQuestion) updateData.hidden_timestamp = revised.hiddenQuestion;
      if (revised.answerIfA || revised.answerIfB) {
        updateData.conditional_answers = JSON.stringify({
          answer_if_condition_1: revised.answerIfA || '',
          answer_if_condition_2: revised.answerIfB || '',
        });
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.question.update({
          where: { id: caseId },
          data: updateData,
        });
      }
    } else {
      // T3Case unified schema
      if (revised.scenario) updateData.scenario = revised.scenario;
      if (revised.claim && caseType !== 'L3') updateData.claim = revised.claim;
      if (revised.counterfactualClaim && caseType === 'L3') updateData.counterfactual_claim = revised.counterfactualClaim;
      if (revised.goldRationale || revised.whyFlawedOrValid || revised.justification) {
        updateData.gold_rationale = revised.goldRationale || revised.whyFlawedOrValid || revised.justification;
      }
      if (revised.wiseRefusal || revised.wiseResponse) {
        updateData.wise_refusal = revised.wiseRefusal || revised.wiseResponse;
      }
      if (revised.hiddenQuestion || revised.hiddenTimestamp) {
        updateData.hidden_timestamp = revised.hiddenQuestion || revised.hiddenTimestamp;
      }
      if (revised.answerIfA || revised.answerIfB) {
        updateData.conditional_answers = JSON.stringify({
          answer_if_condition_1: revised.answerIfA || '',
          answer_if_condition_2: revised.answerIfB || '',
        });
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.t3Case.update({
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
OVERALL VERDICT: ${evaluation.overall_verdict}
PRIORITY: ${evaluation.priority_level === 1 ? 'Urgent' : evaluation.priority_level === 2 ? 'Normal' : 'Minor'}

RUBRIC FEEDBACK:
${rubricFeedback}

${evaluation.suggested_corrections ? `SUGGESTED CORRECTIONS:\n${evaluation.suggested_corrections}\n` : ''}
${evaluation.structural_notes ? `STRUCTURAL NOTES:\n${evaluation.structural_notes}\n` : ''}
${evaluation.has_ambiguity && evaluation.ambiguity_notes ? `AMBIGUITY ISSUES:\n${evaluation.ambiguity_notes}\n` : ''}
${evaluation.has_logical_issues && evaluation.logical_issue_notes ? `LOGICAL ISSUES:\n${evaluation.logical_issue_notes}\n` : ''}
${evaluation.has_domain_errors && evaluation.domain_error_notes ? `DOMAIN ERRORS:\n${evaluation.domain_error_notes}\n` : ''}

CURRENT CASE DATA:
`;

  if (caseType === 'legacy') {
    prompt += JSON.stringify({
      scenario: caseData.scenario,
      claim: caseData.claim,
      explanation: caseData.explanation,
      wiseRefusal: caseData.wise_refusal,
      hiddenQuestion: caseData.hidden_timestamp,
      answerIfA: caseData.conditional_answers ? (JSON.parse(caseData.conditional_answers)?.answer_if_condition_1 || '') : '',
      answerIfB: caseData.conditional_answers ? (JSON.parse(caseData.conditional_answers)?.answer_if_condition_2 || '') : '',
    }, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields: scenario, claim, explanation, wiseRefusal, hiddenQuestion, answerIfA, answerIfB. Only include fields that need revision.`;
  } else {
    // T3Case unified schema - parse conditional_answers and hidden_timestamp
    let hiddenQuestion = caseData.hidden_timestamp;
    let answerIfA = '';
    let answerIfB = '';
    if (caseData.conditional_answers) {
      try {
        const parsed = JSON.parse(caseData.conditional_answers);
        answerIfA = parsed.answer_if_condition_1 || parsed.answerIfA || '';
        answerIfB = parsed.answer_if_condition_2 || parsed.answerIfB || '';
      } catch {
        // ignore
      }
    }
    
    const t3Data: any = {
      scenario: caseData.scenario,
      wiseRefusal: caseData.wise_refusal,
      goldRationale: caseData.gold_rationale,
      hiddenQuestion,
    };
    
    if (caseData.pearl_level === 'L3') {
      t3Data.counterfactualClaim = caseData.counterfactual_claim;
      t3Data.justification = caseData.gold_rationale;
      t3Data.wiseResponse = caseData.wise_refusal;
    } else {
      t3Data.claim = caseData.claim;
      t3Data.whyFlawedOrValid = caseData.gold_rationale;
    }
    
    if (answerIfA || answerIfB) {
      t3Data.answerIfA = answerIfA;
      t3Data.answerIfB = answerIfB;
    }
    
    prompt += JSON.stringify(t3Data, null, 2);
    prompt += `\n\nTASK: Revise the case content to address the rubric feedback and improve the score. Return a JSON object with revised fields. For L3 cases, use counterfactualClaim, justification, wiseResponse. For L1/L2 cases, use claim, whyFlawedOrValid, wiseRefusal. Include hiddenQuestion and answerIfA/answerIfB if applicable. Only include fields that need revision.`;
  }

  return prompt;
}
