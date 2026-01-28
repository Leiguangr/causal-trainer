/**
 * L1 SHEEP Prompt: S8 - Regression Discontinuity
 * Tier: Advanced
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S8_REGRESSION_DISCONTINUITY: PromptDefinition = {
  id: 'L1-S8',
  level: 'L1',
  validity: 'YES',
  trapType: 'S8',
  trapName: 'Regression Discontinuity',
  family: 'Supporting',

  description:
    'Treatment is assigned based on whether a running variable crosses a threshold. Units just above and below the threshold are nearly identical, creating a local randomized experiment.',

  coreChallenge:
    'Recognizing that arbitrary cutoffs create quasi-random assignment for units near the threshold.',

  keyQuestion: 'Is there a threshold-based assignment where units near the cutoff are comparable?',

  validationChecklist: [
    'Treatment is assigned based on a threshold/cutoff',
    'A running variable determines treatment assignment',
    'Units just above and below the threshold are compared',
    'There is no manipulation of the running variable at the cutoff',
  ],

  examples: [
    {
      scenario:
        'Companies with market cap just above $10 billion are included in a major stock index, while those just below are excluded. Researchers compared stock returns of companies within $500 million of the cutoff and found that index inclusion led to 3% higher returns in the following year.',
      claim: 'Index inclusion causes higher stock returns.',
      variables: {
        X: 'Index inclusion',
        Y: 'Stock returns',
        Z: 'Market cap threshold ($10B cutoff)',
      },
      groundTruth: 'YES',
      explanation:
        'Companies at $10.2B and $9.8B are nearly identical except for index membership. The threshold creates a local randomized experiment where the only difference is index inclusion.',
      wiseRefusal:
        'YES. The causal claim is justified using regression discontinuity. Companies just above and below the $10B threshold are nearly identical in all characteristics except index membership. The arbitrary cutoff creates quasi-random assignment: a company at $10.2B vs $9.8B differs only in index inclusion. The 3% return difference can be causally attributed to index membership.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to regression discontinuity

EVIDENCE TYPE: S8 - Regression Discontinuity
TIER: Advanced
DESCRIPTION: ${S8_REGRESSION_DISCONTINUITY.description}

CORE STRENGTH: ${S8_REGRESSION_DISCONTINUITY.coreChallenge}

KEY QUESTION: "${S8_REGRESSION_DISCONTINUITY.keyQuestion}"

VALIDATION CHECKLIST:
${S8_REGRESSION_DISCONTINUITY.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S8_REGRESSION_DISCONTINUITY.examples[0].scenario}

Claim: ${S8_REGRESSION_DISCONTINUITY.examples[0].claim}

Variables:
- X: ${S8_REGRESSION_DISCONTINUITY.examples[0].variables.X}
- Y: ${S8_REGRESSION_DISCONTINUITY.examples[0].variables.Y}
- Z: ${S8_REGRESSION_DISCONTINUITY.examples[0].variables.Z}

Ground Truth: ${S8_REGRESSION_DISCONTINUITY.examples[0].groundTruth}

Explanation: ${S8_REGRESSION_DISCONTINUITY.examples[0].explanation}

Wise Refusal: ${S8_REGRESSION_DISCONTINUITY.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Treatment must be assigned based on a threshold
2. Units near the cutoff must be compared
3. The running variable must be clearly specified
4. No manipulation of the running variable should be evident

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S8: Regression Discontinuity.`,
};

export default S8_REGRESSION_DISCONTINUITY;
