/**
 * L3 CONDITIONAL Prompt: F5 - Temporal and Path-Dependent
 * Answer: CONDITIONAL - Depends on unspecified temporal dynamics
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

export const F5_TEMPORAL_CONDITIONAL: PromptDefinition = {
  id: 'L3-F5-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F5',
  trapName: 'Temporal Path-Dependent',
  family: 'Temporal/Path-Dependent',

  description:
    'Temporal dynamics are not fully specified. Whether timing was critical is unclear.',

  coreChallenge:
    'Recognizing that temporal counterfactuals depend on unspecified dynamics.',

  keyQuestion: 'Does timing or path matter?',

  validationChecklist: [
    'Timing or sequence is mentioned',
    'Whether timing was critical is unclear',
    'Different temporal assumptions lead to different answers',
    'Specifying the dynamics would resolve the issue',
  ],

  examples: [
    {
      scenario:
        'A trader bought a stock at $100 on Monday. By Friday, the stock was at $120. The trader claims that if they had waited until Wednesday to buy (when it was $105), they would have made less profit. However, it is unclear whether the Monday purchase influenced their Wednesday decision or if they would have bought the same amount regardless.',
      claim: 'If the trader had waited until Wednesday to buy, they would have made $15 less profit per share.',
      variables: {
        X: 'Buying on Monday vs Wednesday',
        Y: 'Profit per share ($20 vs $15)',
        Z: 'Whether purchase timing affects quantity purchased',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'If the trader would have bought the same quantity on Wednesday, the counterfactual is VALID (less profit). But if higher Wednesday prices would have caused them to buy more shares, the total profit might be similar or different. The answer depends on their purchase behavior.',
      wiseRefusal:
        'CONDITIONAL. The counterfactual depends on unspecified purchase dynamics. If quantity is fixed (invariant): waiting until $105 means $5 less profit per share vs $20 from Monday - VALID. If quantity is price-sensitive: lower profit per share might be offset by buying more shares. Missing invariant: how purchase quantity responds to entry price.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F5 - Temporal and Path-Dependent
DESCRIPTION: ${F5_TEMPORAL_CONDITIONAL.description}

CORE CHALLENGE: ${F5_TEMPORAL_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F5_TEMPORAL_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F5_SUBTYPES)}

VALIDATION CHECKLIST:
${F5_TEMPORAL_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F5_TEMPORAL_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F5_TEMPORAL_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F5_TEMPORAL_CONDITIONAL.examples[0].variables.X}
- Y: ${F5_TEMPORAL_CONDITIONAL.examples[0].variables.Y}
- Z: ${F5_TEMPORAL_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F5_TEMPORAL_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F5_TEMPORAL_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F5_TEMPORAL_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Timing must be mentioned in the scenario
2. Whether timing was critical must be unclear
3. Different temporal assumptions must lead to different answers
4. State explicitly what is missing

IMPORTANT: Include two completions showing different temporal dynamics

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F5: Temporal with CONDITIONAL answer.`,
};

export default F5_TEMPORAL_CONDITIONAL;

