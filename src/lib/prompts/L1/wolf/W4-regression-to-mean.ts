/**
 * L1 WOLF Prompt: W4 - Regression to the Mean
 * Family: Selection (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W4_REGRESSION_TO_MEAN: PromptDefinition = {
  id: 'L1-W4',
  level: 'L1',
  validity: 'NO',
  trapType: 'W4',
  trapName: 'Regression to the Mean',
  family: 'Selection',

  description:
    'Extreme observations tend to be followed by less extreme ones due to random variation. Selecting based on extreme performance and then observing "improvement" or "decline" is often just regression to the mean.',

  coreChallenge:
    'Recognizing that extreme values naturally regress toward the average, and this statistical phenomenon—not any intervention—explains the change.',

  keyQuestion: 'Was the selection based on extreme performance? Would regression explain the change?',

  validationChecklist: [
    'Selection is based on extreme performance (best or worst)',
    'A subsequent change toward average is observed',
    'An intervention or factor is credited for the change',
    'The change could be explained by natural regression',
  ],

  examples: [
    {
      scenario:
        'After the 10 worst-performing mutual funds of 2022 hired new portfolio managers in early 2023, 8 of them showed improved returns by year-end. Industry analysts concluded that the management changes caused the performance turnaround.',
      claim: 'The management changes caused the performance improvement.',
      variables: {
        X: 'Hiring new portfolio managers',
        Y: 'Improved fund returns',
        Z: 'Selection based on worst performance (regression to mean)',
      },
      groundTruth: 'NO',
      explanation:
        'The funds were selected because they were the worst performers. Extreme underperformance often includes bad luck that naturally reverses. The improvement likely reflects regression to the mean, not management skill.',
      wiseRefusal:
        'NO. This is regression to the mean. The 10 funds were selected precisely because they had the worst performance in 2022. Extreme underperformance typically includes a component of bad luck, which naturally reverses over time. Even without any management changes, we would expect most of these funds to show improved performance simply by regressing toward average returns.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Regression to the Mean

TRAP: W4 - Regression to the Mean
FAMILY: Selection (F1)
DESCRIPTION: ${W4_REGRESSION_TO_MEAN.description}

CORE CHALLENGE: ${W4_REGRESSION_TO_MEAN.coreChallenge}

KEY QUESTION TO EMBED: "${W4_REGRESSION_TO_MEAN.keyQuestion}"

VALIDATION CHECKLIST:
${W4_REGRESSION_TO_MEAN.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W4_REGRESSION_TO_MEAN.examples[0].scenario}

Claim: ${W4_REGRESSION_TO_MEAN.examples[0].claim}

Variables:
- X: ${W4_REGRESSION_TO_MEAN.examples[0].variables.X}
- Y: ${W4_REGRESSION_TO_MEAN.examples[0].variables.Y}
- Z: ${W4_REGRESSION_TO_MEAN.examples[0].variables.Z}

Ground Truth: ${W4_REGRESSION_TO_MEAN.examples[0].groundTruth}

Explanation: ${W4_REGRESSION_TO_MEAN.examples[0].explanation}

Wise Refusal: ${W4_REGRESSION_TO_MEAN.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Selection must be based on extreme performance (best or worst)
2. A subsequent change toward average must be observed
3. An intervention must be credited for the change
4. The regression to mean must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W4: Regression to the Mean.`,
};

export default W4_REGRESSION_TO_MEAN;

