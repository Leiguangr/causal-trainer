/**
 * L3 CONDITIONAL Prompt: F2 - Probabilistic Counterfactuals
 * Answer: CONDITIONAL - Depends on unspecified probability model
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

export const F2_PROBABILISTIC_CONDITIONAL: PromptDefinition = {
  id: 'L3-F2-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F2',
  trapName: 'Probabilistic Counterfactuals',
  family: 'Probabilistic',

  description:
    'The probability model is not specified. Different reasonable assumptions lead to different conclusions.',

  coreChallenge:
    'Recognizing that without specifying the probability model, the counterfactual is underdetermined.',

  keyQuestion: 'How does uncertainty change what can be concluded?',

  validationChecklist: [
    'Probability model is not specified',
    'Different models lead to different conclusions',
    'Both conclusions are reasonable given the information',
    'Specifying the model would resolve the ambiguity',
  ],

  examples: [
    {
      scenario:
        'A day trader made a risky options bet that paid off, returning 500% in one day. They claim that if they had not made this trade, they would have missed this opportunity. However, they make similar bets regularly, and the success rate is unknown.',
      claim: 'If the trader had not made this specific options bet, they would have missed out on exceptional returns.',
      variables: {
        X: 'Making this specific options bet',
        Y: 'Missing exceptional returns',
        Z: 'Base rate of success for similar bets (unspecified)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'If the trader\'s hit rate is high, this was a skilled play and the counterfactual is valid. If the hit rate is low, they got lucky and would have lost on a different bet. Without knowing the base rate, we cannot evaluate the counterfactual.',
      wiseRefusal:
        'CONDITIONAL. The counterfactual depends on the unspecified probability model. If the trader\'s success rate is high (~70%), then passing on this trade meant missing a high-probability opportunity. If the success rate is low (~10%), this was lucky and passing would likely have avoided a loss on an alternative bet. Missing invariant: the base rate of success for similar trades.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F2 - Probabilistic Counterfactuals
DESCRIPTION: ${F2_PROBABILISTIC_CONDITIONAL.description}

CORE CHALLENGE: ${F2_PROBABILISTIC_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F2_PROBABILISTIC_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F2_SUBTYPES)}

VALIDATION CHECKLIST:
${F2_PROBABILISTIC_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].variables.X}
- Y: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].variables.Y}
- Z: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F2_PROBABILISTIC_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The probability model must be unspecified
2. Different probability assumptions must lead to different answers
3. Both VALID and INVALID must be reasonable under different models
4. State explicitly what is missing

IMPORTANT: Include two completions showing how different probability assumptions lead to different answers

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F2: Probabilistic with CONDITIONAL answer.`,
};

export default F2_PROBABILISTIC_CONDITIONAL;

