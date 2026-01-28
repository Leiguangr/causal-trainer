/**
 * L2 NO Prompt: T12 - Time-Varying Confounding
 * Family: Direction Errors (F4)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T12_TEMPORAL: PromptDefinition = {
  id: 'L2-T12',
  level: 'L2',
  validity: 'NO',
  trapType: 'T12',
  trapName: 'Time-Varying Confounding',
  family: 'Direction Errors',

  description:
    'The causal structure changes over time. Treatment affects time-varying covariates, which in turn affect future treatment and outcomes, creating complex temporal dependencies.',

  coreChallenge:
    'Recognizing that when treatment affects variables that influence future treatment, standard adjustment methods fail.',

  keyQuestion: 'Does the causal structure change over time?',

  validationChecklist: [
    'Multiple time points involved',
    'Treatment affects time-varying covariate',
    'Time-varying covariate affects future treatment and outcome',
    'Standard adjustment would introduce bias',
  ],

  examples: [
    {
      scenario:
        'A bank studied the effect of credit limit increases on default rates. They found that customers who received increases had 20% lower default rates after adjusting for credit score. However, credit limit increases IMPROVE credit scores, which then affect future increases and default risk.',
      claim: 'Increasing credit limits for all eligible customers causes default rates to decrease by 20%.',
      variables: {
        X: 'Credit limit increase',
        Y: 'Default rate',
        Z: 'Credit score (time-varying confounder affected by treatment)',
      },
      groundTruth: 'NO',
      explanation:
        'Credit score is a time-varying confounder: limit increases improve credit scores, which then affect both future limit decisions and default risk. Adjusting for credit score blocks part of the causal effect and introduces new bias.',
      wiseRefusal:
        'NO. This involves time-varying confounding. Credit limit increases improve credit scores, which then affect both future increases and default risk. Adjusting for current credit score blocks part of the true causal effect (the pathway through improved scores) while failing to fully control for confounding. The 20% estimate is biased.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Time-Varying Confounding

TRAP: T12 - Time-Varying Confounding
FAMILY: Direction Errors (F4)
DESCRIPTION: ${T12_TEMPORAL.description}

CORE CHALLENGE: ${T12_TEMPORAL.coreChallenge}

KEY QUESTION TO EMBED: "${T12_TEMPORAL.keyQuestion}"

VALIDATION CHECKLIST:
${T12_TEMPORAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T12_TEMPORAL.examples[0].scenario}

Claim: ${T12_TEMPORAL.examples[0].claim}

Variables:
- X: ${T12_TEMPORAL.examples[0].variables.X}
- Y: ${T12_TEMPORAL.examples[0].variables.Y}
- Z: ${T12_TEMPORAL.examples[0].variables.Z}

Ground Truth: ${T12_TEMPORAL.examples[0].groundTruth}

Explanation: ${T12_TEMPORAL.examples[0].explanation}

Wise Refusal: ${T12_TEMPORAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple time points must be involved
2. Treatment must affect a time-varying covariate
3. The covariate must affect future treatment and outcome
4. Standard adjustment must be inadequate

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T12: Time-Varying Confounding in intervention.`,
};

export default T12_TEMPORAL;

