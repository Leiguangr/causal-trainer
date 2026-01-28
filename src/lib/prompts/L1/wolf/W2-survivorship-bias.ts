/**
 * L1 WOLF Prompt: W2 - Survivorship Bias
 * Family: Selection (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W2_SURVIVORSHIP_BIAS: PromptDefinition = {
  id: 'L1-W2',
  level: 'L1',
  validity: 'NO',
  trapType: 'W2',
  trapName: 'Survivorship Bias',
  family: 'Selection',

  description:
    'Only successful/surviving cases are observed, while failures are invisible. This creates an illusion that success is more common or that certain strategies always work.',

  coreChallenge:
    'Recognizing that we only see the winners, not the losers. The failures have disappeared from the dataset.',

  keyQuestion: 'Are we only seeing the survivors? What happened to those who failed?',

  validationChecklist: [
    'The scenario only includes entities that "survived" or succeeded',
    'Failed/defunct entities are not mentioned or are invisible',
    'The conclusion is drawn from survivors only',
    'The survivorship bias creates a misleading success rate',
  ],

  examples: [
    {
      scenario:
        'A study of the top 50 hedge funds that have been operating for over 20 years found that 92% of them beat the S&P 500 over their lifetime. The researchers concluded that hedge fund strategies consistently outperform passive investing.',
      claim: 'Hedge fund strategies consistently outperform passive investing.',
      variables: {
        X: 'Hedge fund active management strategies',
        Y: 'Outperforming the S&P 500',
        Z: 'Fund survival (only 20+ year survivors studied)',
      },
      groundTruth: 'NO',
      explanation:
        'The study only examined funds that survived 20+ years. Thousands of hedge funds that underperformed and closed are excluded. The 92% success rate reflects survival, not strategy effectiveness.',
      wiseRefusal:
        'NO. This is survivorship bias. The study only examined hedge funds that survived for 20+ years, but the vast majority of hedge funds close within their first decade, often due to poor performance. By excluding all failed funds, the 92% outperformance rate dramatically overstates the true success rate of hedge fund strategies. The survivors are not representative of hedge funds as a whole.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Survivorship Bias

TRAP: W2 - Survivorship Bias
FAMILY: Selection (F1)
DESCRIPTION: ${W2_SURVIVORSHIP_BIAS.description}

CORE CHALLENGE: ${W2_SURVIVORSHIP_BIAS.coreChallenge}

KEY QUESTION TO EMBED: "${W2_SURVIVORSHIP_BIAS.keyQuestion}"

VALIDATION CHECKLIST:
${W2_SURVIVORSHIP_BIAS.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W2_SURVIVORSHIP_BIAS.examples[0].scenario}

Claim: ${W2_SURVIVORSHIP_BIAS.examples[0].claim}

Variables:
- X: ${W2_SURVIVORSHIP_BIAS.examples[0].variables.X}
- Y: ${W2_SURVIVORSHIP_BIAS.examples[0].variables.Y}
- Z: ${W2_SURVIVORSHIP_BIAS.examples[0].variables.Z}

Ground Truth: ${W2_SURVIVORSHIP_BIAS.examples[0].groundTruth}

Explanation: ${W2_SURVIVORSHIP_BIAS.examples[0].explanation}

Wise Refusal: ${W2_SURVIVORSHIP_BIAS.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must contain a clear X→Y causal claim
2. Survivorship bias must be present but NOT explicitly labeled
3. Failed/defunct entities must be invisible in the data
4. The conclusion must be drawn only from survivors

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W2: Survivorship Bias.`,
};

export default W2_SURVIVORSHIP_BIAS;

