import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { question, challenge } = await req.json();

    if (!question || !challenge) {
      return NextResponse.json(
        { error: 'Question and challenge are required' },
        { status: 400 }
      );
    }

    const prompt = `You are an expert in causal inference and Pearl's Ladder of Causation. A human reviewer has challenged the AI-generated analysis of a causal reasoning question.

## Original Question Data:
${JSON.stringify(question, null, 2)}

## Human Reviewer's Challenge:
${challenge}

## Your Task:
Carefully consider the reviewer's critique. If they raise valid points, revise the question accordingly. The reviewer may have identified:
- Issues with the scenario or claim construction that need rewriting
- Incorrect groundTruth (YES/NO/AMBIGUOUS)
- Missing or misidentified causal traps
- Flawed reasoning in the explanation

## Ground Truth Label Rules (from CS372 course guidelines):
| Label     | Definition                                                                                      | Trap Type |
|-----------|------------------------------------------------------------------------------------------------|-----------|
| YES       | The claim is supported as stated by the given scenario under the appropriate Pearl level.       | NONE      |
| NO        | The claim is invalid as stated due to a violated causal or statistical assumption.              | Exactly 1 |
| AMBIGUOUS | The claim cannot be definitively evaluated given the available information.                     | NONE      |

CRITICAL DISTINCTIONS:
- Validity is determined ONLY from information in the scenario. Do NOT use external domain knowledge.
- NO: The scenario EXPLICITLY reveals a causal flaw. A reader can point to specific text showing the problem.
- AMBIGUOUS: The scenario does NOT provide enough information. We cannot identify a specific flaw because info is MISSING.
- If the scenario mentions a potential problem (confounder, selection issue, etc.), that's NO, not AMBIGUOUS.

CLAIM LANGUAGE MUST MATCH PEARL LEVEL:
- L1 (Association): "is associated with", "is correlated with", "predicts" - NO causal language
- L2 (Intervention): "causes", "leads to", "increases/decreases" - causal language OK
- L3 (Counterfactual): "would have", "had X not occurred" - counterfactual language

TRAP TYPE DECISION ORDER (for NO cases):
1. Is there a missing common cause? → CONFOUNDING
2. Does outcome (or its causes) influence exposure? → REVERSE
3. Are we conditioning on a selected or filtered sample? → SELECTION
4. Are we conditioning on a common effect? → COLLIDER
5. Does aggregation reverse subgroup trends? → SIMPSONS
6. Are extremes selected and naturally reverting? → REGRESSION
7. Is a proxy optimized instead of the target? → GOODHART
8. Is causation bidirectional or adaptive? → FEEDBACK
9. (L3 only) Is an alternative cause preempting? → PREEMPTION

DISAMBIGUATION RULES:
- Confounding vs Reverse: Z→X and Z→Y ⇒ Confounding; Y (or its causes) → X ⇒ Reverse
- Regression vs Confounding: No causal variable needed ⇒ Regression; Latent variable needed ⇒ Confounding
- Simpson's vs Selection: Aggregation reversal ⇒ Simpson's; Who enters dataset matters ⇒ Selection

Respond with a JSON object containing the revised fields. Only include fields that need to be changed. Possible fields:
- scenario: The detailed scenario text (rewrite if the scenario has logical issues or needs to better illustrate the trap)
- claim: The claim being evaluated (rewrite if unclear or doesn't match Pearl level)
- groundTruth: "YES" | "NO" | "AMBIGUOUS"
- trapType: The main causal trap category (or "NONE" for YES/AMBIGUOUS)
- trapSubtype: The specific subtype of the trap (or "NONE" for YES/AMBIGUOUS)
- explanation: Why the claim is YES/NO/AMBIGUOUS
- keyInsight: The key causal insight
- wiseRefusal: The ideal response starting with "YES/NO/AMBIGUOUS - ..."
- causalStructure: Causal diagram edges ONLY (e.g., "X -> Y, Z -> X, Z -> Y"). No descriptions or explanations.
- variables: JSON string with X, Y, Z variables

Important: Be rigorous. If the reviewer is correct, make the necessary changes. If the reviewer is mistaken, explain why in the explanation but keep the original assessment.

Respond ONLY with valid JSON, no markdown or explanation outside the JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert in causal inference. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const revised = JSON.parse(content);

    return NextResponse.json({
      success: true,
      revised,
      originalChallenge: challenge,
    });

  } catch (error) {
    console.error('Revise error:', error);
    return NextResponse.json(
      { error: 'Failed to revise question' },
      { status: 500 }
    );
  }
}

