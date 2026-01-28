/**
 * L3 INVALID Prompt: F5 - Temporal and Path-Dependent
 * Answer: INVALID - The timing change would not have affected the outcome
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F5 (from T3-L3 Guidelines)
const F5_SUBTYPES = [
  'Path Dependence - early choices constrain later options',
  'Timing Windows - same action can succeed or fail depending on when it occurs',
  'Chain Framing - proximate vs. distal links in a causal chain',
  'Downstream Propagation - separating warranted propagation from speculation',
];

export const F5_TEMPORAL_INVALID: PromptDefinition = {
  id: 'L3-F5-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F5',
  trapName: 'Temporal Non-Dependence',
  family: 'Temporal/Path-Dependent',

  description:
    'Counterfactual incorrectly assumes timing mattered when it did not - the trap is treating the world as path-dependent when it is not.',

  coreChallenge:
    'Recognizing when timing is NOT critical despite appearances.',

  keyQuestion: 'Does timing or path matter?',

  validationChecklist: [
    'The claimed timing dependence does not exist',
    'The outcome was determined by non-temporal factors',
    'Different timing would have led to the same result',
    'The counterfactual overestimates timing importance',
  ],

  examples: [
    {
      scenario:
        'An investor sold their entire position in a tech stock on Monday morning, before the company announced poor earnings on Monday afternoon. The stock fell 20%. The investor claims that if they had waited until Tuesday to sell, they would have sold at the lower price and lost more money.',
      claim: 'If the investor had sold on Tuesday instead of Monday, they would have received 20% less for their shares.',
      variables: {
        X: 'Selling on Monday vs Tuesday',
        Y: 'Sale proceeds',
        Z: 'Limit order already placed at specific price',
      },
      groundTruth: 'INVALID',
      explanation:
        'The investor had a limit order in place to sell at $100/share. This order would execute at $100 regardless of when it was placed, as long as the market price reached $100. Tuesday\'s opening price of $95 would not have triggered the $100 limit order.',
      wiseRefusal:
        'INVALID. The counterfactual incorrectly assumes market timing mattered. The investor\'s $100 limit order executed Monday when the stock was at $105. Tuesday\'s opening at $95 would not have triggered the limit order at all. Timing was not the relevant factor; the order type and price level were. The claim about timing is invalid.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported (timing was not critical)

FAMILY: F5 - Temporal and Path-Dependent
DESCRIPTION: ${F5_TEMPORAL_INVALID.description}

CORE CHALLENGE: ${F5_TEMPORAL_INVALID.coreChallenge}

KEY QUESTION: "${F5_TEMPORAL_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F5_SUBTYPES)}

VALIDATION CHECKLIST:
${F5_TEMPORAL_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F5_TEMPORAL_INVALID.examples[0].scenario}

Counterfactual Claim: ${F5_TEMPORAL_INVALID.examples[0].claim}

Variables:
- X: ${F5_TEMPORAL_INVALID.examples[0].variables.X}
- Y: ${F5_TEMPORAL_INVALID.examples[0].variables.Y}
- Z: ${F5_TEMPORAL_INVALID.examples[0].variables.Z}

Ground Truth: ${F5_TEMPORAL_INVALID.examples[0].groundTruth}

Explanation: ${F5_TEMPORAL_INVALID.examples[0].explanation}

Wise Refusal: ${F5_TEMPORAL_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The counterfactual must claim timing was critical
2. But timing was NOT actually the determining factor
3. Another factor determined the outcome
4. The same result would occur under different timing

IMPORTANT: Frame as "If [X had occurred at different time], then [Y would be different]" - but this is FALSE

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F5: Temporal with INVALID answer (timing was not critical).`,
};

export default F5_TEMPORAL_INVALID;

