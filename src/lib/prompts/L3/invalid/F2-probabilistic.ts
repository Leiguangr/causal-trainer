/**
 * L3 INVALID Prompt: F2 - Probabilistic Counterfactuals
 * Answer: INVALID - The counterfactual claim is NOT supported
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F2 (from T3-L3 Guidelines)
const F2_SUBTYPES = [
  'Sufficiency under Uncertainty - individual-level dependence with stochasticity',
  'Probabilistic Exposure - causal links that are real but non-deterministic',
  'Background Risk - outcomes that can occur without X at non-trivial rates',
  'Sensitivity/Chaos - small changes can yield divergent trajectories',
  'Chance vs Necessity - separating "could have happened anyway" from mechanistic dependence',
];

export const F2_PROBABILISTIC_INVALID: PromptDefinition = {
  id: 'L3-F2-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F2',
  trapName: 'Probabilistic Counterfactuals',
  family: 'Probabilistic',

  description:
    'Counterfactuals with stochastic outcomes where the probability shift is minimal or background risk dominates.',

  coreChallenge:
    'Recognizing that weak probabilistic links do not support counterfactual claims.',

  keyQuestion: 'How does uncertainty change what can be concluded?',

  validationChecklist: [
    'The probability shift is minimal',
    'Other factors dominated the outcome',
    'The claimed cause contributed negligibly',
    'The counterfactual claim overstates the causal role',
  ],

  examples: [
    {
      scenario:
        'A fund\'s Q3 returns of +15% were analyzed. Factor attribution showed: market beta +12%, sector allocation +2.5%, individual stock selection +0.5%. The fund manager claims their stock-picking caused the strong returns.',
      claim: 'If the fund manager had not made their individual stock picks, the fund would not have achieved strong returns.',
      variables: {
        X: 'Individual stock selection',
        Y: 'Strong fund returns (+15%)',
        Z: 'Market beta and sector factors (+14.5%)',
      },
      groundTruth: 'INVALID',
      explanation:
        'Stock selection contributed only +0.5% of the +15% return. Market beta (+12%) and sector allocation (+2.5%) dominated. Without stock picking, returns would have been +14.5% - still "strong" by any reasonable standard.',
      wiseRefusal:
        'INVALID. The counterfactual overstates stock selection\'s role. Factor attribution shows stock selection contributed only +0.5% of the +15% return. Market beta (+12%) and sector allocation (+2.5%) were dominant. Removing stock selection would yield +14.5% returns - still strong. The claim that stock-picking caused the strong returns is invalid.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported

FAMILY: F2 - Probabilistic Counterfactuals
DESCRIPTION: ${F2_PROBABILISTIC_INVALID.description}

CORE CHALLENGE: ${F2_PROBABILISTIC_INVALID.coreChallenge}

KEY QUESTION: "${F2_PROBABILISTIC_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F2_SUBTYPES)}

VALIDATION CHECKLIST:
${F2_PROBABILISTIC_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F2_PROBABILISTIC_INVALID.examples[0].scenario}

Counterfactual Claim: ${F2_PROBABILISTIC_INVALID.examples[0].claim}

Variables:
- X: ${F2_PROBABILISTIC_INVALID.examples[0].variables.X}
- Y: ${F2_PROBABILISTIC_INVALID.examples[0].variables.Y}
- Z: ${F2_PROBABILISTIC_INVALID.examples[0].variables.Z}

Ground Truth: ${F2_PROBABILISTIC_INVALID.examples[0].groundTruth}

Explanation: ${F2_PROBABILISTIC_INVALID.examples[0].explanation}

Wise Refusal: ${F2_PROBABILISTIC_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The claimed cause should have minimal actual impact
2. Other factors should dominate the outcome
3. Factor attribution or similar should show weak contribution
4. The counterfactual should overstate causal importance

IMPORTANT: Frame as "If [X had been different], then [Y would/would not have occurred]" - but the claim is FALSE

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F2: Probabilistic Counterfactuals with INVALID answer.`,
};

export default F2_PROBABILISTIC_INVALID;

