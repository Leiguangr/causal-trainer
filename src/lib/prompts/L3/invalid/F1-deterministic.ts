/**
 * L3 INVALID Prompt: F1 - Deterministic Counterfactuals
 * Answer: INVALID - The counterfactual claim is NOT supported
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F1 (from T3-L3 Guidelines)
const F1_SUBTYPES = [
  'Mechanistic Necessity - removing an essential component breaks the outcome',
  'Rule-based Determinism - outcomes fixed by explicit rules (contracts, protocols, algorithms)',
  'Necessary Condition - outcome cannot occur without X, given stated invariants',
  'Valid State Comparison - counterfactual resolved by comparing known states under same rules',
  'Spurious Linkage - scenario explicitly lacks a causal connection (superstition, coincidence)',
];

export const F1_DETERMINISTIC_INVALID: PromptDefinition = {
  id: 'L3-F1-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F1',
  trapName: 'Deterministic Counterfactuals',
  family: 'Deterministic',

  description:
    'Counterfactuals governed by physical, logical, or rule-based necessity - but the but-for test fails due to spurious linkage or other mechanisms.',

  coreChallenge:
    'Recognizing that deterministic mechanisms can make counterfactuals INVALID when the outcome was inevitable.',

  keyQuestion: 'Would the mechanism still operate?',

  validationChecklist: [
    'Mechanism is deterministic',
    'The proposed change does not affect the outcome',
    'But-for causation fails',
    'The outcome was determined by other factors',
  ],

  examples: [
    {
      scenario:
        'A trading algorithm had multiple stop-loss triggers: 5% drop triggers partial sell, 10% drop triggers full liquidation. During a flash crash, the price dropped 15%. A trader claims that if the 5% trigger had been disabled, they would not have suffered the full liquidation.',
      claim: 'If the 5% partial sell trigger had been disabled, the full liquidation would not have occurred.',
      variables: {
        X: '5% partial sell trigger',
        Y: 'Full liquidation',
        Z: '10% full liquidation trigger (independent)',
      },
      groundTruth: 'INVALID',
      explanation:
        'The 10% trigger would have caused full liquidation regardless of the 5% trigger. The 15% drop exceeded both thresholds. Disabling the 5% trigger would not have prevented the full liquidation caused by the independent 10% trigger.',
      wiseRefusal:
        'INVALID. The but-for test fails. The 10% full liquidation trigger is independent of the 5% partial trigger. Since the price dropped 15%, exceeding the 10% threshold, the full liquidation would have occurred regardless of whether the 5% trigger was active. The outcome was determined by the 10% rule, not the 5% rule.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported

FAMILY: F1 - Deterministic Counterfactuals
DESCRIPTION: ${F1_DETERMINISTIC_INVALID.description}

CORE CHALLENGE: ${F1_DETERMINISTIC_INVALID.coreChallenge}

KEY QUESTION: "${F1_DETERMINISTIC_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F1_SUBTYPES)}

VALIDATION CHECKLIST:
${F1_DETERMINISTIC_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F1_DETERMINISTIC_INVALID.examples[0].scenario}

Counterfactual Claim: ${F1_DETERMINISTIC_INVALID.examples[0].claim}

Variables:
- X: ${F1_DETERMINISTIC_INVALID.examples[0].variables.X}
- Y: ${F1_DETERMINISTIC_INVALID.examples[0].variables.Y}
- Z: ${F1_DETERMINISTIC_INVALID.examples[0].variables.Z}

Ground Truth: ${F1_DETERMINISTIC_INVALID.examples[0].groundTruth}

Explanation: ${F1_DETERMINISTIC_INVALID.examples[0].explanation}

Wise Refusal: ${F1_DETERMINISTIC_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The mechanism must be deterministic
2. The proposed change must NOT affect the outcome
3. But-for causation must fail
4. Another factor must have determined the outcome

IMPORTANT: Frame as "If [X had been different], then [Y would/would not have occurred]" - but the claim is FALSE

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F1: Deterministic Counterfactuals with INVALID answer.`,
};

export default F1_DETERMINISTIC_INVALID;

