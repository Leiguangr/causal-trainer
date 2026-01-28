/**
 * L3 CONDITIONAL Prompt: F4 - Structural vs Contingent
 * Answer: CONDITIONAL - Depends on whether cause is structural or contingent
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

export const F4_STRUCTURAL_CONDITIONAL: PromptDefinition = {
  id: 'L3-F4-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F4',
  trapName: 'Structural vs Contingent',
  family: 'Structural vs Contingent',

  description:
    'Whether a cause is structural (necessary) or merely contingent (circumstantial) is unclear.',

  coreChallenge:
    'Recognizing that the structural/contingent distinction is not resolved by the information given.',

  keyQuestion: 'Was this the trigger or the root cause?',

  validationChecklist: [
    'A cause is identified in the scenario',
    'Whether it is structural or contingent is unclear',
    'The answer depends on this classification',
    'Specifying the type would resolve the issue',
  ],

  examples: [
    {
      scenario:
        'A hedge fund\'s risk management system flagged a position as too large, but the portfolio manager ignored the warning and increased the position further. The position later lost 40%. It is unclear whether the risk system warning was a formal limit (structural) or an advisory guideline (contingent).',
      claim: 'If the risk system warning had not been ignored, the 40% loss would not have occurred.',
      variables: {
        X: 'Ignoring the risk system warning',
        Y: '40% position loss',
        Z: 'Status of warning (formal limit vs advisory)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'If the warning was a formal limit (structural), ignoring it was the proximate cause and the counterfactual is VALID. If it was only advisory (contingent), the manager had discretion and the warning was not the structural cause. The answer depends on the warning\'s status.',
      wiseRefusal:
        'CONDITIONAL. The answer depends on whether the risk warning was structural or contingent. If the warning was a hard limit (structural): ignoring it directly caused the oversized loss, counterfactual VALID. If the warning was advisory (contingent): the manager had legitimate discretion, and the loss may have occurred anyway. Missing invariant: the formal status of the risk warning.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F4 - Structural vs Contingent Causes
DESCRIPTION: ${F4_STRUCTURAL_CONDITIONAL.description}

CORE CHALLENGE: ${F4_STRUCTURAL_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F4_STRUCTURAL_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F4_SUBTYPES)}

VALIDATION CHECKLIST:
${F4_STRUCTURAL_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F4_STRUCTURAL_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F4_STRUCTURAL_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F4_STRUCTURAL_CONDITIONAL.examples[0].variables.X}
- Y: ${F4_STRUCTURAL_CONDITIONAL.examples[0].variables.Y}
- Z: ${F4_STRUCTURAL_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F4_STRUCTURAL_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F4_STRUCTURAL_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F4_STRUCTURAL_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A potential cause must be identified
2. Its structural/contingent status must be unclear
3. Different statuses lead to different answers
4. State explicitly what information is missing

IMPORTANT: Include two completions showing structural vs contingent interpretations

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F4: Structural vs Contingent with CONDITIONAL answer.`,
};

export default F4_STRUCTURAL_CONDITIONAL;

