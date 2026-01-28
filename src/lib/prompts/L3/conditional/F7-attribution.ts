/**
 * L3 CONDITIONAL Prompt: F7 - Causal Attribution
 * Answer: CONDITIONAL - Depends on unspecified attribution methodology
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F7 (from T3-L3 Guidelines)
const F7_SUBTYPES = [
  'Attributable Fraction - population-level contribution (e.g., % of cases caused by factor)',
  'Individual Attribution - contribution given an observed outcome (sufficiency-style)',
  'Path-specific Effects - distinguishing direct vs. mediated contribution',
  'Principal Strata - contribution defined for specific latent groups (complier logic)',
  'Additionality - "would it have happened anyway?" questions',
];

export const F7_ATTRIBUTION_CONDITIONAL: PromptDefinition = {
  id: 'L3-F7-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F7',
  trapName: 'Causal Attribution',
  family: 'Causal Attribution',

  description:
    'Attribution methodology not specified. Different reasonable methods yield different conclusions about credit assignment.',

  coreChallenge:
    'Recognizing that causal attribution depends on the methodology chosen.',

  keyQuestion: 'How much credit does X deserve?',

  validationChecklist: [
    'Attribution methodology is not specified',
    'Multiple methods are reasonable',
    'Different methods yield different attributions',
    'Specifying the method would resolve the issue',
  ],

  examples: [
    {
      scenario:
        'A startup failed after a series of events: poor product-market fit, running out of runway, and a key employee departure. Investors are trying to determine what percentage of the failure to attribute to each factor for lessons learned.',
      claim: 'If the key employee had not left, the startup would likely have survived.',
      variables: {
        X: 'Key employee departure',
        Y: 'Startup failure',
        Z: 'Attribution methodology (last straw vs root cause)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'If we use "last straw" attribution, the employee departure triggered the collapse - VALID. If we use "root cause" attribution, poor product-market fit was primary and the startup was doomed anyway - INVALID. The answer depends on the attribution methodology.',
      wiseRefusal:
        'CONDITIONAL. The attribution depends on methodology. "Last straw" analysis: the employee departure was the proximate cause that triggered failure - counterfactual VALID. "Root cause" analysis: poor product-market fit meant failure was inevitable; the departure was incidental - counterfactual INVALID. Missing invariant: the appropriate attribution methodology for this analysis.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F7 - Causal Attribution
DESCRIPTION: ${F7_ATTRIBUTION_CONDITIONAL.description}

CORE CHALLENGE: ${F7_ATTRIBUTION_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F7_ATTRIBUTION_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F7_SUBTYPES)}

VALIDATION CHECKLIST:
${F7_ATTRIBUTION_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].variables.X}
- Y: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].variables.Y}
- Z: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F7_ATTRIBUTION_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple attribution methods must be reasonable
2. Different methods must yield different answers
3. No single method is clearly correct
4. State explicitly what methodology is missing

IMPORTANT: Include two completions showing different attribution methodologies

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F7: Causal Attribution with CONDITIONAL answer.`,
};

export default F7_ATTRIBUTION_CONDITIONAL;

