/**
 * L3 VALID Prompt: F4 - Structural vs Contingent Causes
 * Answer: VALID - The structural cause supports the counterfactual
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F4 (from T3-L3 Guidelines)
const F4_SUBTYPES = [
  'Trigger vs Structure - spark vs. fuel; proximate event vs. underlying conditions',
  'Agent vs System - individual action vs. underlying constraints',
  'Technological/Institutional - invention/policy vs. structural necessity',
  'Strategy vs Resources - contingent tactics vs. structural capacity',
];

export const F4_STRUCTURAL_VALID: PromptDefinition = {
  id: 'L3-F4-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F4',
  trapName: 'Structural Cause',
  family: 'Structural vs Contingent',

  description:
    'Distinguishes proximate triggers from background enabling conditions. The trap is attributing outcome to most salient event when structural forces dominate.',

  coreChallenge:
    'Recognizing that structural causes (active, proximate) support valid counterfactuals while background conditions do not.',

  keyQuestion: 'Was this the trigger or the root cause?',

  validationChecklist: [
    'The cause is active, not merely present',
    'The cause is proximate to the outcome',
    'The but-for test applies to this cause',
    'Background conditions are held fixed in invariants',
  ],

  examples: [
    {
      scenario:
        'A quantitative trader submitted an erroneous order that was 100x the intended size. The order executed, moving the market and causing $500K in losses before correction. The exchange\'s order validation system was functioning normally but had no size limits configured for this account.',
      claim: 'If the trader had not submitted the erroneous order, the $500K loss would not have occurred.',
      variables: {
        X: 'Submitting the erroneous 100x order',
        Y: '$500K trading loss',
        Z: 'Exchange validation system (background condition)',
      },
      groundTruth: 'VALID',
      explanation:
        'The erroneous order is the structural cause - it is active and proximate to the loss. The exchange system is a background/enabling condition (absence of protection). The but-for test applies to the order: no erroneous order → no loss.',
      wiseRefusal:
        'VALID. The erroneous order is the structural cause of the loss. It is active (the trader submitted it), proximate (directly caused market movement), and satisfies but-for causation. The exchange validation system is a background condition, not the structural cause. Under invariants holding market conditions and exchange systems fixed, the counterfactual is valid.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported (structural cause identified)

FAMILY: F4 - Structural vs Contingent Causes
DESCRIPTION: ${F4_STRUCTURAL_VALID.description}

CORE CHALLENGE: ${F4_STRUCTURAL_VALID.coreChallenge}

KEY QUESTION: "${F4_STRUCTURAL_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F4_SUBTYPES)}

VALIDATION CHECKLIST:
${F4_STRUCTURAL_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F4_STRUCTURAL_VALID.examples[0].scenario}

Counterfactual Claim: ${F4_STRUCTURAL_VALID.examples[0].claim}

Variables:
- X: ${F4_STRUCTURAL_VALID.examples[0].variables.X}
- Y: ${F4_STRUCTURAL_VALID.examples[0].variables.Y}
- Z: ${F4_STRUCTURAL_VALID.examples[0].variables.Z}

Ground Truth: ${F4_STRUCTURAL_VALID.examples[0].groundTruth}

Explanation: ${F4_STRUCTURAL_VALID.examples[0].explanation}

Wise Refusal: ${F4_STRUCTURAL_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The cause must be structural (active, proximate)
2. Background conditions should be clearly distinguished
3. The but-for test must apply to the structural cause
4. Invariants should hold background conditions fixed

IMPORTANT: Frame as "If [structural cause X had not occurred], then [Y would not have occurred]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F4: Structural Cause with VALID answer.`,
};

export default F4_STRUCTURAL_VALID;

