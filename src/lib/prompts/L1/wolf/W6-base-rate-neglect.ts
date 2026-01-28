/**
 * L1 WOLF Prompt: W6 - Base Rate Neglect
 * Family: Ecological (F2)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W6_BASE_RATE_NEGLECT: PromptDefinition = {
  id: 'L1-W6',
  level: 'L1',
  validity: 'NO',
  trapType: 'W6',
  trapName: 'Base Rate Neglect',
  family: 'Ecological',

  description:
    'Ignoring the prior probability (base rate) of an event when evaluating evidence. A high hit rate can be misleading if the base rate is very low or very high.',

  coreChallenge:
    'Recognizing that conditional probabilities (P(evidence|event)) must be combined with base rates (P(event)) to draw valid conclusions.',

  keyQuestion: 'What is the base rate? Is the conclusion valid given the prior probability?',

  validationChecklist: [
    'A conditional probability or hit rate is presented',
    'The base rate of the event is very low or very high',
    'The conclusion ignores the base rate',
    'Proper Bayesian reasoning would yield a different conclusion',
  ],

  examples: [
    {
      scenario:
        'A quantitative trading firm developed an AI model that correctly identifies 90% of stocks that will double in value within a year. The firm concluded that stocks flagged by the model are likely to double.',
      claim: 'Stocks flagged by the model are likely to double in value.',
      variables: {
        X: 'Model flagging a stock',
        Y: 'Stock doubling in value',
        Z: 'Base rate of stocks doubling (very low, ~1%)',
      },
      groundTruth: 'NO',
      explanation:
        'Only about 1% of stocks double in a year. Even with 90% sensitivity, if the model has even 10% false positive rate, most flagged stocks will be false positives. The base rate makes the conclusion invalid.',
      wiseRefusal:
        'NO. This is base rate neglect. While the model has 90% sensitivity (catches 90% of doublers), the base rate of stocks doubling is extremely low (~1%). If the model flags 10% of non-doublers as false positives, then for every 1000 stocks: ~9 true doublers are caught, but ~99 non-doublers are falsely flagged. Most flagged stocks (>90%) will NOT double.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Base Rate Neglect

TRAP: W6 - Base Rate Neglect
FAMILY: Ecological (F2)
DESCRIPTION: ${W6_BASE_RATE_NEGLECT.description}

CORE CHALLENGE: ${W6_BASE_RATE_NEGLECT.coreChallenge}

KEY QUESTION TO EMBED: "${W6_BASE_RATE_NEGLECT.keyQuestion}"

VALIDATION CHECKLIST:
${W6_BASE_RATE_NEGLECT.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W6_BASE_RATE_NEGLECT.examples[0].scenario}

Claim: ${W6_BASE_RATE_NEGLECT.examples[0].claim}

Variables:
- X: ${W6_BASE_RATE_NEGLECT.examples[0].variables.X}
- Y: ${W6_BASE_RATE_NEGLECT.examples[0].variables.Y}
- Z: ${W6_BASE_RATE_NEGLECT.examples[0].variables.Z}

Ground Truth: ${W6_BASE_RATE_NEGLECT.examples[0].groundTruth}

Explanation: ${W6_BASE_RATE_NEGLECT.examples[0].explanation}

Wise Refusal: ${W6_BASE_RATE_NEGLECT.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A conditional probability or hit rate must be presented
2. The base rate must be extreme (very low or very high)
3. The conclusion must ignore the base rate
4. The base rate neglect must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W6: Base Rate Neglect.`,
};

export default W6_BASE_RATE_NEGLECT;

