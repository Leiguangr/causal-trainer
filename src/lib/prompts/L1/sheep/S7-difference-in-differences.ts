/**
 * L1 SHEEP Prompt: S7 - Difference-in-Differences
 * Tier: Advanced
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S7_DIFFERENCE_IN_DIFFERENCES: PromptDefinition = {
  id: 'L1-S7',
  level: 'L1',
  validity: 'YES',
  trapType: 'S7',
  trapName: 'Difference-in-Differences',
  family: 'Supporting',

  description:
    'Comparing the change in outcomes over time between a treatment group and a control group, removing time-invariant confounders and common trends.',

  coreChallenge:
    'Recognizing that comparing changes (not levels) between groups controls for fixed differences and common time trends.',

  keyQuestion: 'Are changes over time compared between treatment and control groups?',

  validationChecklist: [
    'There are before and after measurements for both groups',
    'A treatment group receives the intervention',
    'A control group does not receive the intervention',
    'The difference in changes (DiD) is calculated',
    'Parallel trends assumption is plausible',
  ],

  examples: [
    {
      scenario:
        'When State A implemented a financial transaction tax in 2020 but State B did not, researchers compared trading volumes before and after. State A saw trading volume drop from 100M to 70M shares/day, while State B went from 95M to 90M. The difference-in-differences estimate was -25M shares/day attributable to the tax.',
      claim: 'The financial transaction tax causes reduced trading volume.',
      variables: {
        X: 'Financial transaction tax',
        Y: 'Trading volume change',
        Z: 'State-level comparison (treatment vs control)',
      },
      groundTruth: 'YES',
      explanation:
        'State A dropped 30M while State B dropped only 5M. The 25M difference-in-differences removes the common market trend and isolates the tax effect.',
      wiseRefusal:
        'YES. The causal claim is justified using difference-in-differences. State A (treatment) saw a 30M drop while State B (control) saw only a 5M drop. The DiD estimate of 25M (30M - 5M) removes common time trends affecting both states. Under the parallel trends assumption, the 25M excess drop in State A can be causally attributed to the transaction tax.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to difference-in-differences

EVIDENCE TYPE: S7 - Difference-in-Differences
TIER: Advanced
DESCRIPTION: ${S7_DIFFERENCE_IN_DIFFERENCES.description}

CORE STRENGTH: ${S7_DIFFERENCE_IN_DIFFERENCES.coreChallenge}

KEY QUESTION: "${S7_DIFFERENCE_IN_DIFFERENCES.keyQuestion}"

VALIDATION CHECKLIST:
${S7_DIFFERENCE_IN_DIFFERENCES.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].scenario}

Claim: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].claim}

Variables:
- X: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].variables.X}
- Y: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].variables.Y}
- Z: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].variables.Z}

Ground Truth: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].groundTruth}

Explanation: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].explanation}

Wise Refusal: ${S7_DIFFERENCE_IN_DIFFERENCES.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Before and after measurements must exist for both groups
2. Treatment and control groups must be clearly identified
3. The difference-in-differences must be calculated or implied
4. Parallel trends assumption should be plausible

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S7: Difference-in-Differences.`,
};

export default S7_DIFFERENCE_IN_DIFFERENCES;
