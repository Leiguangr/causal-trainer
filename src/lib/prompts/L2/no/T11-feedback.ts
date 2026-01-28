/**
 * L2 NO Prompt: T11 - Feedback Loop
 * Family: Direction Errors (F4)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T11_FEEDBACK: PromptDefinition = {
  id: 'L2-T11',
  level: 'L2',
  validity: 'NO',
  trapType: 'T11',
  trapName: 'Feedback Loop',
  family: 'Direction Errors',

  description:
    'Bidirectional causation exists (X↔Y) where both directions are real. A unidirectional intervention claim ignores the feedback dynamics.',

  coreChallenge:
    'Recognizing that when X and Y mutually reinforce each other, intervening on X may trigger feedback effects that complicate the outcome.',

  keyQuestion: 'Do X and Y reinforce each other?',

  validationChecklist: [
    'Plausible mechanism for X→Y',
    'Plausible mechanism for Y→X',
    'Unidirectional claim ignores feedback',
    'Intervention effect is complicated by feedback dynamics',
  ],

  examples: [
    {
      scenario:
        'A study found that companies with high stock prices tend to spend more on marketing. A small-cap company concluded that increasing marketing spending would raise their stock price similarly to large-cap peers.',
      claim: 'Increasing marketing spending causes the small-cap company stock price to increase proportionally.',
      variables: {
        X: 'Marketing spending',
        Y: 'Stock price',
        Z: 'Bidirectional feedback between X and Y',
      },
      groundTruth: 'NO',
      explanation:
        'There is a feedback loop: high stock prices provide capital for marketing (Y→X), AND marketing may boost stock prices (X→Y). Large-cap companies benefit from both directions. The small-cap company cannot assume the same effect without the Y→X feedback that comes from already having resources.',
      wiseRefusal:
        'NO. This ignores feedback loop dynamics. Large-cap companies have high stock prices that fund marketing (Y→X), and marketing supports stock prices (X→Y). The bidirectional relationship means the observed correlation reflects both pathways. A small-cap company increasing marketing without the initial high valuation cannot expect the same proportional effect.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Feedback Loop

TRAP: T11 - Feedback Loop
FAMILY: Direction Errors (F4)
DESCRIPTION: ${T11_FEEDBACK.description}

CORE CHALLENGE: ${T11_FEEDBACK.coreChallenge}

KEY QUESTION TO EMBED: "${T11_FEEDBACK.keyQuestion}"

VALIDATION CHECKLIST:
${T11_FEEDBACK.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T11_FEEDBACK.examples[0].scenario}

Claim: ${T11_FEEDBACK.examples[0].claim}

Variables:
- X: ${T11_FEEDBACK.examples[0].variables.X}
- Y: ${T11_FEEDBACK.examples[0].variables.Y}
- Z: ${T11_FEEDBACK.examples[0].variables.Z}

Ground Truth: ${T11_FEEDBACK.examples[0].groundTruth}

Explanation: ${T11_FEEDBACK.examples[0].explanation}

Wise Refusal: ${T11_FEEDBACK.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Both X→Y and Y→X must be plausible
2. The claim must assume only one direction
3. Feedback dynamics must complicate the intervention effect
4. The feedback loop must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T11: Feedback Loop in intervention.`,
};

export default T11_FEEDBACK;

