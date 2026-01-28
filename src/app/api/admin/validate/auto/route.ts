import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per revised Assignment 2 Table 7 - 10 points total
interface RubricScores {
  scenarioClarityScore: number;      // 0-1 pt: X, Y, Z clearly defined
  hiddenQuestionScore: number;       // 0-1 pt: Identifies causal confusion
  conditionalAnswerAScore: number;   // 0-1.5 pts: First conditional answer quality
  conditionalAnswerBScore: number;   // 0-1.5 pts: Second conditional answer quality
  wiseRefusalScore: number;          // 0-2 pts: Complete answer with verdict
  difficultyCalibrationScore: number; // 0-1 pt: Appropriate difficulty level
  finalLabelScore: number;           // 0-1 pt: Correct label for Pearl level
  trapTypeScore: number;             // 0-1 pt: Correctly classified trap type
  finalScore: number;                // 0-10 total
  validatorNotes: string;
}

async function evaluateCase(question: {
  id: string;
  scenario: string;
  claim: string | null;
  pearlLevel: string;
  groundTruth: string;
  variables: string | null;
  trapType: string;
  explanation: string | null;
  wiseRefusal: string | null;
  hiddenTimestamp: string | null;
  conditionalAnswers: string | null;
  difficulty: string | null;
}): Promise<RubricScores> {
  // Determine if this is an ambiguous/conditional case
  const isAmbiguous = question.groundTruth === 'AMBIGUOUS' || question.groundTruth === 'CONDITIONAL';

  // Per revised spec Table 7: For non-AMBIGUOUS cases, hidden question and conditional answers get full scores
  const defaultHiddenScore = isAmbiguous ? 0 : 1;  // Changed from 2 to 1 per revised spec
  const defaultCondAScore = isAmbiguous ? 0 : 1.5;
  const defaultCondBScore = isAmbiguous ? 0 : 1.5;

  // Valid labels per Pearl level (per revised spec Table 10)
  const validLabels: Record<string, string[]> = {
    'L1': ['YES', 'NO', 'AMBIGUOUS'],
    'L2': ['NO'],  // All L2 cases must be NO
    'L3': ['VALID', 'INVALID', 'CONDITIONAL'],
  };

  // Build the evaluation prompt with revised rubric (Table 7)
  const rubricPrompt = `You are evaluating a causal reasoning case for the T³ (Trap, Trick, and Trace) benchmark dataset.

ABOUT THIS DATASET:
T³ is a benchmark designed to test LLM causal reasoning abilities across Pearl's Ladder of Causation:
- L1 (Association): Can the model correctly identify correlational vs causal claims from observational data?
- L2 (Intervention): Can the model recognize when interventional conclusions cannot be drawn without experiments?
- L3 (Counterfactual): Can the model evaluate counterfactual claims requiring structural causal knowledge?

Each case contains a "trap" — a plausible-sounding scenario where naive causal reasoning leads to wrong conclusions.
A good case should be realistic enough that a model without careful causal reasoning would answer incorrectly.

Use the REVISED Assignment 2 rubric (Table 7) for scoring.

CASE TO EVALUATE:
- Pearl Level: ${question.pearlLevel}
- Ground Truth Label: ${question.groundTruth}
- Trap Type: ${question.trapType}

SCENARIO:
${question.scenario}

CLAIM:
${question.claim || 'N/A'}

VARIABLES:
${question.variables || 'N/A'}

EXPLANATION:
${question.explanation || 'N/A'}

WISE REFUSAL (Model's expected answer):
${question.wiseRefusal || 'N/A'}

${isAmbiguous ? `HIDDEN TIMESTAMP QUESTION:
${question.hiddenTimestamp || 'N/A'}

CONDITIONAL ANSWERS:
${question.conditionalAnswers || 'N/A'}` : ''}

DIFFICULTY CLAIMED: ${question.difficulty || 'medium'}

---

SCORING RUBRIC (Table 7 - Revised Assignment 2) - 10 points total:

1. SCENARIO CLARITY (0-1 point):
   - Are X, Y, Z variables clearly defined and distinguishable?
   - Is the scenario concise (2-5 sentences, 40-80 words)?
   - Is the causal setup clear without being overly verbose?
   Score 1: Excellent clarity, Score 0.5: Minor issues, Score 0: Confusing/unclear

2. HIDDEN QUESTION QUALITY (0-1 point):
   ${isAmbiguous ? `- Does the hidden question reveal the key missing information?
   - Would answering it disambiguate the case?
   Score 1: Excellent disambiguating question, Score 0.5: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case (not AMBIGUOUS/CONDITIONAL), so this gets full score (1.0)`}

3. CONDITIONAL ANSWER A (0-1.5 points):
   ${isAmbiguous ? `- Is the first conditional answer logically sound?
   - Does it properly address one resolution of the ambiguity?
   Score 1.5: Complete and correct, Score 0.75: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case, so this gets full score (1.5)`}

4. CONDITIONAL ANSWER B (0-1.5 points):
   ${isAmbiguous ? `- Is the second conditional answer logically sound?
   - Does it properly address the alternative resolution?
   Score 1.5: Complete and correct, Score 0.75: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case, so this gets full score (1.5)`}

5. WISE REFUSAL QUALITY (0-2 points):
   - Does it correctly state the verdict?
   - Does it explain WHY with clear causal reasoning?
   - Does it identify the specific trap (for NO/INVALID cases) or missing info (for AMBIGUOUS/CONDITIONAL)?
   Score 2: Complete and insightful, Score 1: Correct but incomplete, Score 0: Wrong or missing

6. DIFFICULTY CALIBRATION (0-1 point):
   - Does the claimed difficulty match the actual complexity?
   - Easy: Obvious trap, common scenario
   - Medium: Requires careful reading, subtle trap
   - Hard: Multiple interacting factors, expert knowledge needed
   Score 1: Well calibrated, Score 0.5: Slightly off, Score 0: Miscalibrated

7. FINAL LABEL (0-1 point):
   - Is the label correct for this Pearl level?
   - L1: Valid labels are YES, NO, AMBIGUOUS
   - L2: MUST be NO (all L2 cases are traps)
   - L3: Valid labels are VALID, INVALID, CONDITIONAL
   Current: Pearl Level = ${question.pearlLevel}, Label = ${question.groundTruth}
   Valid labels for ${question.pearlLevel}: ${validLabels[question.pearlLevel]?.join(', ') || 'unknown'}
   Score 1: Correct label, Score 0: Incorrect label

8. TRAP TYPE / FAMILY (0-1 point):
   - Is the trap type (L1/L2) or family (L3) correctly classified for the scenario?

   For L1 (Association):
   - Common trap types: CONFOUNDING, REVERSE, SELECTION, NONE (for valid/ambiguous)
   - NONE is valid for YES (valid association) or AMBIGUOUS cases

   For L2 (Intervention):
   - Common trap types: CONFOUNDING, REVERSE, SELECTION, COLLIDER, SIMPSONS, GOODHART, FEEDBACK, MEDIATOR, CONFOUNDER_MEDIATOR, etc.
   - All L2 cases are traps, so trap type should NOT be NONE

   For L3 (Counterfactual) - uses FAMILY instead of trap type:
   - F1: Deterministic Counterfactuals
   - F2: Probabilistic Counterfactuals
   - F3: Overdetermination / Preemption
   - F4: Structural vs Contingent Causes
   - F5: Temporal Counterfactuals
   - F6: Epistemic Limits (CONDITIONAL only)
   - F7: Attribution
   - F8: Moral and Legal Causation
   - NONE is also valid for L3 if no specific family applies

   Current trap type/family: ${question.trapType}
   Score 1: Correctly matches the scenario's causal pattern, Score 0.5: Partially correct, Score 0: Incorrect

---

Return your evaluation as JSON:
{
  "scenarioClarityScore": <0-1>,
  "wiseRefusalScore": <0-2>,
  "difficultyCalibrationScore": <0-1>,
  "finalLabelScore": <0-1>,
  "trapTypeScore": <0-1>,
  ${isAmbiguous ? `"hiddenQuestionScore": <0-1>,
  "conditionalAnswerAScore": <0-1.5>,
  "conditionalAnswerBScore": <0-1.5>,` : ''}
  "notes": "<Brief explanation of scores, max 100 words>"
}

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: rubricPrompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from LLM');

    const evaluation = JSON.parse(content);

    // Calculate scores per revised spec Table 7 (10 points total)
    const scenarioClarity = Math.min(1, Math.max(0, evaluation.scenarioClarityScore || 0));  // 0-1 pt
    const wiseRefusal = Math.min(2, Math.max(0, evaluation.wiseRefusalScore || 0));          // 0-2 pts
    const difficultyCalibration = Math.min(1, Math.max(0, evaluation.difficultyCalibrationScore || 0));  // 0-1 pt
    const finalLabel = Math.min(1, Math.max(0, evaluation.finalLabelScore || 0));            // 0-1 pt
    const trapType = Math.min(1, Math.max(0, evaluation.trapTypeScore || 0));                // 0-1 pt

    // Hidden question and conditional answers: defaults for non-ambiguous cases
    const hiddenQuestion = isAmbiguous
      ? Math.min(1, Math.max(0, evaluation.hiddenQuestionScore || 0))   // 0-1 pt
      : defaultHiddenScore;
    const condA = isAmbiguous
      ? Math.min(1.5, Math.max(0, evaluation.conditionalAnswerAScore || 0))  // 0-1.5 pts
      : defaultCondAScore;
    const condB = isAmbiguous
      ? Math.min(1.5, Math.max(0, evaluation.conditionalAnswerBScore || 0))  // 0-1.5 pts
      : defaultCondBScore;

    // Total: 1 + 1 + 1.5 + 1.5 + 2 + 1 + 1 + 1 = 10 points
    const total = scenarioClarity + hiddenQuestion + condA + condB + wiseRefusal +
                  difficultyCalibration + finalLabel + trapType;

    return {
      scenarioClarityScore: scenarioClarity,
      hiddenQuestionScore: hiddenQuestion,
      conditionalAnswerAScore: condA,
      conditionalAnswerBScore: condB,
      wiseRefusalScore: wiseRefusal,
      difficultyCalibrationScore: difficultyCalibration,
      finalLabelScore: finalLabel,
      trapTypeScore: trapType,
      finalScore: Math.round(total * 10) / 10,
      validatorNotes: `[Auto-scored] ${evaluation.notes || ''}`,
    };
  } catch (error) {
    console.error('LLM evaluation error:', error);
    // Return conservative scores on error
    return {
      scenarioClarityScore: 0.5,
      hiddenQuestionScore: defaultHiddenScore,
      conditionalAnswerAScore: defaultCondAScore,
      conditionalAnswerBScore: defaultCondBScore,
      wiseRefusalScore: 1,
      difficultyCalibrationScore: 0.5,
      finalLabelScore: 0.5,
      trapTypeScore: 0.5,
      finalScore: 0.5 + defaultHiddenScore + defaultCondAScore + defaultCondBScore + 1 + 0.5 + 0.5 + 0.5,
      validatorNotes: `[Auto-score failed] Error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// POST: Start auto-validation for pending cases
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const limit = body.limit || 10; // Process in batches
    const dryRun = body.dryRun || false;

    // Fetch pending cases
    const pendingCases = await prisma.question.findMany({
      where: { 
        dataset: 'cs372-assignment2',
        validationStatus: 'pending',
      },
      take: limit,
      select: {
        id: true, scenario: true, claim: true, pearlLevel: true,
        groundTruth: true, variables: true, trapType: true,
        explanation: true, wiseRefusal: true, hiddenTimestamp: true,
        conditionalAnswers: true, difficulty: true,
      },
    });

    if (pendingCases.length === 0) {
      return NextResponse.json({ message: 'No pending cases to validate', processed: 0 });
    }

    const results: Array<{ id: string; finalScore: number; status: string }> = [];

    for (const q of pendingCases) {
      console.log(`Auto-validating case ${q.id}...`);
      const scores = await evaluateCase(q);
      
      if (!dryRun) {
        await prisma.question.update({
          where: { id: q.id },
          data: {
            validator: 'auto-validator',
            validationStatus: 'scored',
            ...scores,
          },
        });
      }

      results.push({
        id: q.id,
        finalScore: scores.finalScore,
        status: dryRun ? 'dry-run' : 'scored',
      });
    }

    return NextResponse.json({
      message: `Processed ${results.length} cases`,
      processed: results.length,
      remaining: await prisma.question.count({
        where: { dataset: 'cs372-assignment2', validationStatus: 'pending' }
      }) - (dryRun ? 0 : results.length),
      results,
    });
  } catch (error) {
    console.error('Auto-validation error:', error);
    return NextResponse.json({ error: 'Auto-validation failed' }, { status: 500 });
  }
}

// GET: Check auto-validation status
export async function GET() {
  const stats = await prisma.question.groupBy({
    by: ['validationStatus'],
    where: { dataset: 'cs372-assignment2' },
    _count: true,
  });
  
  return NextResponse.json({
    stats: stats.reduce((acc, s) => ({ ...acc, [s.validationStatus]: s._count }), {}),
  });
}

