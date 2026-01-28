/**
 * L3 VALID Prompt: F2 - Probabilistic Counterfactuals
 * Answer: VALID - The counterfactual claim is supported
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

export const F2_PROBABILISTIC_VALID: PromptDefinition = {
  id: 'L3-F2-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F2',
  trapName: 'Probabilistic Counterfactuals',
  family: 'Probabilistic',

  description:
    'Counterfactuals with stochastic outcomes, where the task is to distinguish changes in probability from deterministic claims, and to respect background risk.',

  coreChallenge:
    'Recognizing that probabilistic causation can support valid counterfactuals when the probability shift is substantial.',

  keyQuestion: 'How does uncertainty change what can be concluded?',

  validationChecklist: [
    'Mechanism is probabilistic but well-understood',
    'Probability shift is substantial (not marginal)',
    'The actual outcome is attributable to the cause',
    'Invariants specify the probability model',
  ],

  examples: [
    {
      scenario:
        'A portfolio manager implemented a momentum strategy that historically produced positive returns 75% of the time in similar market conditions. In Q2 2024, the strategy returned +12%. Analysis shows this was primarily driven by the momentum factor, with other factors contributing only +1%.',
      claim: 'If the momentum strategy had not been implemented, the portfolio would likely not have achieved +12% returns.',
      variables: {
        X: 'Implementing momentum strategy',
        Y: '+12% quarterly return',
        Z: 'Factor attribution (momentum = +11%)',
      },
      groundTruth: 'VALID',
      explanation:
        'Factor attribution shows momentum contributed +11% of the +12% return. Without the momentum strategy, the portfolio would have returned only ~+1%. The probabilistic link is strong enough to support the counterfactual.',
      wiseRefusal:
        'VALID. Factor attribution analysis shows momentum contributed +11% of the +12% return. Under the invariant that other factors (value, size, quality) remain unchanged, removing the momentum strategy would reduce returns to approximately +1%. The counterfactual is probabilistically valid.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported under stated invariants

FAMILY: F2 - Probabilistic Counterfactuals
DESCRIPTION: ${F2_PROBABILISTIC_VALID.description}

CORE CHALLENGE: ${F2_PROBABILISTIC_VALID.coreChallenge}

KEY QUESTION: "${F2_PROBABILISTIC_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F2_SUBTYPES)}

VALIDATION CHECKLIST:
${F2_PROBABILISTIC_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F2_PROBABILISTIC_VALID.examples[0].scenario}

Counterfactual Claim: ${F2_PROBABILISTIC_VALID.examples[0].claim}

Variables:
- X: ${F2_PROBABILISTIC_VALID.examples[0].variables.X}
- Y: ${F2_PROBABILISTIC_VALID.examples[0].variables.Y}
- Z: ${F2_PROBABILISTIC_VALID.examples[0].variables.Z}

Ground Truth: ${F2_PROBABILISTIC_VALID.examples[0].groundTruth}

Explanation: ${F2_PROBABILISTIC_VALID.examples[0].explanation}

Wise Refusal: ${F2_PROBABILISTIC_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The causal mechanism should be probabilistic, not deterministic
2. The probability shift must be substantial
3. Factor attribution or similar analysis should support the claim
4. Invariants should specify what is held fixed

IMPORTANT: Frame as "If [X had been different], then [Y would/would not have likely occurred]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F2: Probabilistic Counterfactuals with VALID answer.`,
};

export default F2_PROBABILISTIC_VALID;

