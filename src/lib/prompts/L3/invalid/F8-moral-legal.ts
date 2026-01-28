/**
 * L3 INVALID Prompt: F8 - Moral and Legal Causation
 * Answer: INVALID - The moral/legal causation claim fails
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F8 (from T3-L3 Guidelines)
const F8_SUBTYPES = [
  'But-for under Uncertainty - causal standards with probabilistic evidence',
  'Moral Luck - identical actions with divergent outcomes',
  'Action vs Omission - doing harm vs. allowing harm',
  'Process Effects - selection into legal outcomes altering observed histories',
];

export const F8_MORAL_LEGAL_INVALID: PromptDefinition = {
  id: 'L3-F8-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F8',
  trapName: 'Moral/Legal Causation',
  family: 'Moral/Legal Causation',

  description:
    'Counterfactuals embedded in normative standards where a superseding cause, lack of foreseeability, or broken causal chain defeats responsibility.',

  coreChallenge:
    'Recognizing when intervening causes break the chain of legal/moral responsibility.',

  keyQuestion: 'Who is responsible under a standard?',

  validationChecklist: [
    'Intervening cause is superseding (unforeseeable)',
    'Causal chain is broken by independent action',
    'The harm was not foreseeable',
    'Legal/moral responsibility does not attach',
  ],

  examples: [
    {
      scenario:
        'A bank approved a business loan after standard due diligence. The business owner used the funds as intended initially, but a year later embezzled the remaining funds for gambling. A lawsuit claims the bank caused the investors\' losses by approving the loan.',
      claim: 'If the bank had not approved the loan, the investors would not have lost their money.',
      variables: {
        X: 'Bank approving the loan',
        Y: 'Investor losses from embezzlement',
        Z: 'Owner\'s unforeseeable embezzlement (superseding cause)',
      },
      groundTruth: 'INVALID',
      explanation:
        'The owner\'s embezzlement is a superseding cause. The bank performed standard due diligence; they could not foresee embezzlement a year later. The criminal act breaks the causal chain. Legal responsibility does not attach to the bank.',
      wiseRefusal:
        'INVALID. The embezzlement is a superseding intervening cause. Elements: (1) Bank performed standard due diligence - no breach, (2) Owner\'s embezzlement was unforeseeable criminal act, (3) The embezzlement breaks the causal chain. The criminal act of a third party is a superseding cause that relieves the bank of responsibility. The but-for test is insufficient for legal causation.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported (broken causal chain)

FAMILY: F8 - Moral and Legal Causation
DESCRIPTION: ${F8_MORAL_LEGAL_INVALID.description}

CORE CHALLENGE: ${F8_MORAL_LEGAL_INVALID.coreChallenge}

KEY QUESTION: "${F8_MORAL_LEGAL_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F8_SUBTYPES)}

VALIDATION CHECKLIST:
${F8_MORAL_LEGAL_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F8_MORAL_LEGAL_INVALID.examples[0].scenario}

Counterfactual Claim: ${F8_MORAL_LEGAL_INVALID.examples[0].claim}

Variables:
- X: ${F8_MORAL_LEGAL_INVALID.examples[0].variables.X}
- Y: ${F8_MORAL_LEGAL_INVALID.examples[0].variables.Y}
- Z: ${F8_MORAL_LEGAL_INVALID.examples[0].variables.Z}

Ground Truth: ${F8_MORAL_LEGAL_INVALID.examples[0].groundTruth}

Explanation: ${F8_MORAL_LEGAL_INVALID.examples[0].explanation}

Wise Refusal: ${F8_MORAL_LEGAL_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. An intervening/superseding cause must break the chain
2. The harm must be unforeseeable or too remote
3. The initial actor must not be legally/morally responsible
4. But-for causation must be insufficient for responsibility

IMPORTANT: Frame as "If [actor X had not acted], then [harm would not have occurred]" - but X is NOT responsible

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F8: Moral/Legal Causation with INVALID answer (broken chain).`,
};

export default F8_MORAL_LEGAL_INVALID;

