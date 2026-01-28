/**
 * L1 WOLF Prompt: W9 - Reverse Causation
 * Family: Direction (F4)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W9_REVERSE_CAUSATION: PromptDefinition = {
  id: 'L1-W9',
  level: 'L1',
  validity: 'NO',
  trapType: 'W9',
  trapName: 'Reverse Causation',
  family: 'Direction',

  description:
    'The causal direction is backwards. Y actually causes X, not X causes Y. The correlation is real, but the causal arrow points the wrong way.',

  coreChallenge:
    'Recognizing that the observed correlation exists because Y→X, not X→Y. The cause and effect are reversed.',

  keyQuestion: 'Could Y be causing X instead of X causing Y?',

  validationChecklist: [
    'A correlation between X and Y is observed',
    'The claim asserts X causes Y',
    'The reverse direction (Y causes X) is more plausible',
    'The reverse causation is embedded, not explicitly labeled',
  ],

  examples: [
    {
      scenario:
        'A study found that companies with higher analyst coverage tend to have higher stock valuations. The researchers concluded that analyst coverage causes higher valuations by increasing investor awareness.',
      claim: 'Analyst coverage causes higher stock valuations.',
      variables: {
        X: 'Analyst coverage',
        Y: 'Stock valuation',
        Z: 'Company size and prominence (drives both)',
      },
      groundTruth: 'NO',
      explanation:
        'The causation likely runs in reverse: highly valued, prominent companies attract more analyst coverage because they are more interesting to investors. High valuation causes coverage, not vice versa.',
      wiseRefusal:
        'NO. This is reverse causation. While analyst coverage and valuations are correlated, the causal direction is likely reversed. Large, highly-valued companies attract analyst attention because they are more relevant to investors and generate more trading commissions. The high valuation causes the coverage, not the other way around.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Reverse Causation

TRAP: W9 - Reverse Causation
FAMILY: Direction (F4)
DESCRIPTION: ${W9_REVERSE_CAUSATION.description}

CORE CHALLENGE: ${W9_REVERSE_CAUSATION.coreChallenge}

KEY QUESTION TO EMBED: "${W9_REVERSE_CAUSATION.keyQuestion}"

VALIDATION CHECKLIST:
${W9_REVERSE_CAUSATION.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W9_REVERSE_CAUSATION.examples[0].scenario}

Claim: ${W9_REVERSE_CAUSATION.examples[0].claim}

Variables:
- X: ${W9_REVERSE_CAUSATION.examples[0].variables.X}
- Y: ${W9_REVERSE_CAUSATION.examples[0].variables.Y}
- Z: ${W9_REVERSE_CAUSATION.examples[0].variables.Z}

Ground Truth: ${W9_REVERSE_CAUSATION.examples[0].groundTruth}

Explanation: ${W9_REVERSE_CAUSATION.examples[0].explanation}

Wise Refusal: ${W9_REVERSE_CAUSATION.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A correlation between X and Y must be observed
2. The claim must assert X causes Y
3. The reverse direction (Y causes X) must be more plausible
4. The reverse causation must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W9: Reverse Causation.`,
};

export default W9_REVERSE_CAUSATION;

