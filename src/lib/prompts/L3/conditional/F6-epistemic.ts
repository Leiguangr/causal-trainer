/**
 * L3 CONDITIONAL Prompt: F6 - Epistemic Limits
 * Answer: CONDITIONAL - The counterfactual cannot be evaluated due to epistemic limits
 * Note: F6 ONLY supports CONDITIONAL - information limits prevent definitive answers
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F6 (from T3-L3 Guidelines)
const F6_SUBTYPES = [
  'Unverifiable Counterfactuals - no feasible test or identifying evidence',
  'Mechanism Dependence - answer hinges on an unstated mechanism',
  'Observer Effects - measuring or intervening changes the system',
  'Non-identity - alternative world implies a different individual or reference class',
];

export const F6_EPISTEMIC_CONDITIONAL: PromptDefinition = {
  id: 'L3-F6-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F6',
  trapName: 'Epistemic Limits',
  family: 'Epistemic Limits',

  description:
    'Cases where the scenario underdetermines the answer because key mechanisms are unknown, measurements are intrusive, or the counterfactual changes identity conditions.',

  coreChallenge:
    'Recognizing when epistemic limits make counterfactuals inherently conditional.',

  keyQuestion: 'Is the counterfactual resolvable from what is stated?',

  validationChecklist: [
    'Critical information is unknowable',
    'Hidden variables affect the outcome',
    'Model uncertainty is irreducible',
    'No additional data could resolve the ambiguity',
  ],

  examples: [
    {
      scenario:
        'A quant fund\'s algorithm made trading decisions based on proprietary signals that are not disclosed. The fund returned +25% last year. An investor wonders if they would have achieved similar returns if they had invested in a different quant fund with a different (also undisclosed) algorithm.',
      claim: 'If the investor had invested in the other quant fund, they would not have achieved 25% returns.',
      variables: {
        X: 'Investing in this quant fund vs the other',
        Y: '25% returns',
        Z: 'Undisclosed algorithmic strategies (hidden variables)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'Both funds\' strategies are hidden variables. Without knowing what the other fund\'s algorithm would have done in the same market conditions, we cannot evaluate the counterfactual. This is a fundamental epistemic limit, not merely missing data.',
      wiseRefusal:
        'CONDITIONAL. This counterfactual faces irreducible epistemic limits. Both algorithms are hidden variables - we cannot observe what the alternative fund would have returned. This is not missing data that could be obtained; the counterfactual world is fundamentally unobservable. Different reasonable assumptions about the alternative algorithm yield different conclusions.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The counterfactual cannot be definitively evaluated

FAMILY: F6 - Epistemic Limits
DESCRIPTION: ${F6_EPISTEMIC_CONDITIONAL.description}

CORE CHALLENGE: ${F6_EPISTEMIC_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F6_EPISTEMIC_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F6_SUBTYPES)}

NOTE: F6 (Epistemic Limits) ONLY supports CONDITIONAL answers. By definition, these are cases where the information needed to evaluate the counterfactual is fundamentally unknowable.

VALIDATION CHECKLIST:
${F6_EPISTEMIC_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F6_EPISTEMIC_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F6_EPISTEMIC_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F6_EPISTEMIC_CONDITIONAL.examples[0].variables.X}
- Y: ${F6_EPISTEMIC_CONDITIONAL.examples[0].variables.Y}
- Z: ${F6_EPISTEMIC_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F6_EPISTEMIC_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F6_EPISTEMIC_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F6_EPISTEMIC_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The missing information must be fundamentally unknowable
2. Not just missing data, but epistemically inaccessible
3. Model uncertainty or hidden variables must be irreducible
4. Explain why no amount of additional data could resolve it

IMPORTANT: Include two reasonable completions that show different conclusions

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F6: Epistemic Limits with CONDITIONAL answer.`,
};

export default F6_EPISTEMIC_CONDITIONAL;

