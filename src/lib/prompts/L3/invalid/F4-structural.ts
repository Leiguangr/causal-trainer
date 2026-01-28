/**
 * L3 INVALID Prompt: F4 - Structural vs Contingent
 * Answer: INVALID - The claimed cause was merely contingent/background
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

export const F4_STRUCTURAL_INVALID: PromptDefinition = {
  id: 'L3-F4-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F4',
  trapName: 'Contingent Cause',
  family: 'Structural vs Contingent',

  description:
    'The counterfactual wrongly attributes causation to a contingent/background factor when structural forces dominate.',

  coreChallenge:
    'Recognizing that background conditions are not structural causes even when necessary.',

  keyQuestion: 'Was this the trigger or the root cause?',

  validationChecklist: [
    'The claimed cause is passive, not active',
    'The structural cause is something else',
    'The claimed factor is a background/enabling condition',
    'Counterfactual misattributes causation',
  ],

  examples: [
    {
      scenario:
        'A data breach at a bank exposed customer account numbers. The breach occurred because a software engineer left the database unencrypted. A lawsuit argues that if the bank had not stored customer data in a database, the breach would not have occurred.',
      claim: 'If the bank had not stored customer data in a database, the data breach would not have occurred.',
      variables: {
        X: 'Storing customer data in a database',
        Y: 'Data breach exposing account numbers',
        Z: 'Leaving database unencrypted (structural cause)',
      },
      groundTruth: 'INVALID',
      explanation:
        'Storing data in a database is a necessary background condition for any data-driven business, not the structural cause of the breach. The structural cause was the failure to encrypt. The counterfactual misattributes causation to a ubiquitous background condition.',
      wiseRefusal:
        'INVALID. The counterfactual misattributes causation. Storing customer data is a necessary background condition for banking operations - all banks store customer data. The structural cause of the breach was leaving the database unencrypted. The counterfactual suggests eliminating a ubiquitous enabling condition rather than addressing the actual causal failure.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported (misattributes to background condition)

FAMILY: F4 - Structural vs Contingent Causes
DESCRIPTION: ${F4_STRUCTURAL_INVALID.description}

CORE CHALLENGE: ${F4_STRUCTURAL_INVALID.coreChallenge}

KEY QUESTION: "${F4_STRUCTURAL_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F4_SUBTYPES)}

VALIDATION CHECKLIST:
${F4_STRUCTURAL_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F4_STRUCTURAL_INVALID.examples[0].scenario}

Counterfactual Claim: ${F4_STRUCTURAL_INVALID.examples[0].claim}

Variables:
- X: ${F4_STRUCTURAL_INVALID.examples[0].variables.X}
- Y: ${F4_STRUCTURAL_INVALID.examples[0].variables.Y}
- Z: ${F4_STRUCTURAL_INVALID.examples[0].variables.Z}

Ground Truth: ${F4_STRUCTURAL_INVALID.examples[0].groundTruth}

Explanation: ${F4_STRUCTURAL_INVALID.examples[0].explanation}

Wise Refusal: ${F4_STRUCTURAL_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The claimed cause must be a background/enabling condition
2. The structural cause must be clearly different
3. The background condition must be normal/ubiquitous
4. The counterfactual must misattribute causation

IMPORTANT: Frame as "If [background condition X had not existed], then [Y would not have occurred]" - but this is WRONG

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F4: Contingent Cause with INVALID answer.`,
};

export default F4_STRUCTURAL_INVALID;

