/**
 * L1 WOLF Prompt: W7 - Confounding
 * Family: Confounding (F3)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W7_CONFOUNDING: PromptDefinition = {
  id: 'L1-W7',
  level: 'L1',
  validity: 'NO',
  trapType: 'W7',
  trapName: 'Confounding',
  family: 'Confounding',

  description:
    'A third variable (confounder) causes both X and Y, creating a spurious correlation. The observed association is not causal but driven by the common cause.',

  coreChallenge:
    'Recognizing that a hidden common cause explains the correlation between X and Y, rather than X causing Y directly.',

  keyQuestion: 'Is there a third variable that causes both X and Y?',

  validationChecklist: [
    'A correlation between X and Y is observed',
    'A plausible confounder Z exists that causes both X and Y',
    'The causal claim attributes the correlation to X→Y',
    'Controlling for Z would eliminate or reduce the correlation',
  ],

  examples: [
    {
      scenario:
        'An analysis of S&P 500 companies found that firms with higher ESG scores had 12% higher stock returns over the past 5 years. The report concluded that ESG practices cause better stock performance.',
      claim: 'ESG practices cause better stock performance.',
      variables: {
        X: 'High ESG scores',
        Y: 'Higher stock returns',
        Z: 'Company size and profitability (confounders)',
      },
      groundTruth: 'NO',
      explanation:
        'Larger, more profitable companies can afford ESG investments AND tend to have better stock performance. Company quality confounds the ESG-returns relationship. The correlation may not be causal.',
      wiseRefusal:
        'NO. This is confounding. Large, profitable companies have more resources to invest in ESG initiatives AND tend to have better stock performance due to their fundamental strength. Company size and profitability are confounders that cause both high ESG scores and high returns. The 12% return difference may reflect company quality, not ESG practices.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Confounding

TRAP: W7 - Confounding
FAMILY: Confounding (F3)
DESCRIPTION: ${W7_CONFOUNDING.description}

CORE CHALLENGE: ${W7_CONFOUNDING.coreChallenge}

KEY QUESTION TO EMBED: "${W7_CONFOUNDING.keyQuestion}"

VALIDATION CHECKLIST:
${W7_CONFOUNDING.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W7_CONFOUNDING.examples[0].scenario}

Claim: ${W7_CONFOUNDING.examples[0].claim}

Variables:
- X: ${W7_CONFOUNDING.examples[0].variables.X}
- Y: ${W7_CONFOUNDING.examples[0].variables.Y}
- Z: ${W7_CONFOUNDING.examples[0].variables.Z}

Ground Truth: ${W7_CONFOUNDING.examples[0].groundTruth}

Explanation: ${W7_CONFOUNDING.examples[0].explanation}

Wise Refusal: ${W7_CONFOUNDING.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A correlation between X and Y must be observed
2. A plausible confounder Z must exist (causes both X and Y)
3. The causal claim must attribute the correlation to X→Y
4. The confounding must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W7: Confounding.`,
};

export default W7_CONFOUNDING;

