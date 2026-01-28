/**
 * L3 VALID Prompt: F7 - Causal Attribution
 * Answer: VALID - The attribution claim is supported
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

export const F7_ATTRIBUTION_VALID: PromptDefinition = {
  id: 'L3-F7-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F7',
  trapName: 'Causal Attribution',
  family: 'Causal Attribution',

  description:
    'Quantifying or comparing causal contribution rather than binary but-for judgment. The trap is collapsing contribution into necessity or into moral blame.',

  coreChallenge:
    'Recognizing that causal attribution can be valid when the contribution is clearly measurable.',

  keyQuestion: 'How much credit does X deserve?',

  validationChecklist: [
    'Multiple causes contribute to the outcome',
    'The contribution of X is measurable',
    'The attribution is substantial (not trivial)',
    'Methodology for attribution is valid',
  ],

  examples: [
    {
      scenario:
        'A hedge fund\'s Q3 returns of +15% were analyzed by strategy. The factor attribution showed: momentum strategy +10%, value strategy +3%, market beta +2%. The momentum strategy was newly implemented in Q3.',
      claim: 'If the momentum strategy had not been implemented, the fund would have returned approximately +5% instead of +15%.',
      variables: {
        X: 'Momentum strategy implementation',
        Y: 'Fund returns (+15% actual vs ~+5% counterfactual)',
        Z: 'Factor attribution methodology',
      },
      groundTruth: 'VALID',
      explanation:
        'Factor attribution clearly isolates the momentum contribution (+10%). Removing momentum would leave value (+3%) and beta (+2%) for ~+5% total. The attribution methodology is standard and the contribution is substantial.',
      wiseRefusal:
        'VALID. Factor attribution analysis shows momentum contributed +10% of the +15% return. Under invariants (value and beta strategies unchanged, market conditions fixed), removing the momentum strategy would yield returns of approximately +5% (+3% value + +2% beta). The attribution is substantial and methodology is sound.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported (clear attribution)

FAMILY: F7 - Causal Attribution
DESCRIPTION: ${F7_ATTRIBUTION_VALID.description}

CORE CHALLENGE: ${F7_ATTRIBUTION_VALID.coreChallenge}

KEY QUESTION: "${F7_ATTRIBUTION_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F7_SUBTYPES)}

VALIDATION CHECKLIST:
${F7_ATTRIBUTION_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F7_ATTRIBUTION_VALID.examples[0].scenario}

Counterfactual Claim: ${F7_ATTRIBUTION_VALID.examples[0].claim}

Variables:
- X: ${F7_ATTRIBUTION_VALID.examples[0].variables.X}
- Y: ${F7_ATTRIBUTION_VALID.examples[0].variables.Y}
- Z: ${F7_ATTRIBUTION_VALID.examples[0].variables.Z}

Ground Truth: ${F7_ATTRIBUTION_VALID.examples[0].groundTruth}

Explanation: ${F7_ATTRIBUTION_VALID.examples[0].explanation}

Wise Refusal: ${F7_ATTRIBUTION_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple causes should contribute to the outcome
2. The contribution of X must be clearly measurable
3. The attribution must be substantial
4. Methodology should be valid (factor attribution, regression, etc.)

IMPORTANT: Frame as "If [X had not occurred], [specific quantified portion of Y would not have occurred]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F7: Causal Attribution with VALID answer.`,
};

export default F7_ATTRIBUTION_VALID;

