/**
 * L3 VALID Prompt: F1 - Deterministic Counterfactuals
 * Answer: VALID - The counterfactual claim is supported
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

export const F1_DETERMINISTIC_VALID: PromptDefinition = {
  id: 'L3-F1-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F1',
  trapName: 'Deterministic Counterfactuals',
  family: 'Deterministic',

  description:
    'Counterfactuals governed by physical, logical, or rule-based necessity, where a correct judgment hinges on identifying an invariant mechanism rather than extrapolating from surface association.',

  coreChallenge:
    'Recognizing that deterministic mechanisms allow precise counterfactual evaluation when invariants are stated.',

  keyQuestion: 'Would the mechanism still operate?',

  validationChecklist: [
    'Mechanism is deterministic (physical law, contract, rule)',
    'Invariants are clearly stated',
    'But-for causation is satisfied',
    'Counterfactual world is well-defined',
  ],

  examples: [
    {
      scenario:
        'A trading algorithm had a hard-coded stop-loss at 5%. During a flash crash, the algorithm sold all positions when the price dropped 5.1%. The trader lost $50,000 on the sale. Contract terms specified a 24-hour cooling period before re-entry, so the algorithm could not buy back when prices recovered within an hour.',
      claim: 'If the stop-loss had been set at 6%, the trader would not have lost $50,000 on that sale.',
      variables: {
        X: 'Stop-loss threshold (5% vs 6%)',
        Y: 'Loss from forced sale',
        Z: 'Algorithm rule execution (deterministic)',
      },
      groundTruth: 'VALID',
      explanation:
        'The algorithm operates deterministically: it sells if and only if the drop exceeds the threshold. The 5.1% drop exceeds 5% but not 6%. Under the counterfactual (6% threshold), no sale would occur. The loss directly resulted from the sale, so the counterfactual is VALID.',
      wiseRefusal:
        'VALID. The trading algorithm operates on deterministic rules. The 5.1% drop triggered the 5% stop-loss but would not have triggered a 6% stop-loss. Under invariants (price movement, cooling period rules unchanged), the sale would not have occurred, and the $50,000 loss would have been avoided.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported under stated invariants

FAMILY: F1 - Deterministic Counterfactuals
DESCRIPTION: ${F1_DETERMINISTIC_VALID.description}

CORE CHALLENGE: ${F1_DETERMINISTIC_VALID.coreChallenge}

KEY QUESTION: "${F1_DETERMINISTIC_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F1_SUBTYPES)}

VALIDATION CHECKLIST:
${F1_DETERMINISTIC_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F1_DETERMINISTIC_VALID.examples[0].scenario}

Counterfactual Claim: ${F1_DETERMINISTIC_VALID.examples[0].claim}

Variables:
- X: ${F1_DETERMINISTIC_VALID.examples[0].variables.X}
- Y: ${F1_DETERMINISTIC_VALID.examples[0].variables.Y}
- Z: ${F1_DETERMINISTIC_VALID.examples[0].variables.Z}

Ground Truth: ${F1_DETERMINISTIC_VALID.examples[0].groundTruth}

Explanation: ${F1_DETERMINISTIC_VALID.examples[0].explanation}

Wise Refusal: ${F1_DETERMINISTIC_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The mechanism must be deterministic (physical law, contract, algorithm rule)
2. Invariants must be clearly stated
3. The but-for test must be satisfied
4. The counterfactual world must be well-defined

IMPORTANT: Frame as "If [X had been different], then [Y would/would not have occurred]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F1: Deterministic Counterfactuals with VALID answer.`,
};

export default F1_DETERMINISTIC_VALID;

