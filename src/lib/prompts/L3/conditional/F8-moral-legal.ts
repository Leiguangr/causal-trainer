/**
 * L3 CONDITIONAL Prompt: F8 - Moral and Legal Causation
 * Answer: CONDITIONAL - Depends on unspecified legal/moral standard
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

export const F8_MORAL_LEGAL_CONDITIONAL: PromptDefinition = {
  id: 'L3-F8-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F8',
  trapName: 'Moral/Legal Causation',
  family: 'Moral/Legal Causation',

  description:
    'The legal or moral standard to apply is not specified. Different reasonable standards yield different responsibility conclusions.',

  coreChallenge:
    'Recognizing that legal/moral causation depends on the standard chosen.',

  keyQuestion: 'Who is responsible under a standard?',

  validationChecklist: [
    'The applicable standard is not specified',
    'Multiple standards are reasonable',
    'Different standards yield different conclusions',
    'Specifying the standard would resolve the issue',
  ],

  examples: [
    {
      scenario:
        'A broker recommended speculative investments to a client, who lost 60% of their portfolio. The broker disclosed the risks in writing, but used verbal reassurances ("This is a sure thing") that contradicted the written disclosures. The client is considering a complaint.',
      claim: 'If the broker had not made the verbal reassurances, the client would not have invested and lost money.',
      variables: {
        X: 'Broker\'s verbal reassurances',
        Y: 'Client\'s investment losses',
        Z: 'Legal standard (parol evidence rule vs fraud)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'Under the parol evidence rule, written disclosures control and verbal statements may be inadmissible - INVALID. Under fraud standards, verbal misrepresentation can override written disclaimers - VALID. The answer depends on which legal standard applies.',
      wiseRefusal:
        'CONDITIONAL. The answer depends on the legal standard applied. Parol evidence rule: written risk disclosures control; verbal statements are inadmissible. Broker not liable - INVALID. Fraud exception: verbal misrepresentation ("sure thing") contradicts written disclosure, potentially fraudulent inducement - VALID. Missing invariant: which legal framework governs this dispute.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F8 - Moral and Legal Causation
DESCRIPTION: ${F8_MORAL_LEGAL_CONDITIONAL.description}

CORE CHALLENGE: ${F8_MORAL_LEGAL_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F8_MORAL_LEGAL_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F8_SUBTYPES)}

VALIDATION CHECKLIST:
${F8_MORAL_LEGAL_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].variables.X}
- Y: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].variables.Y}
- Z: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F8_MORAL_LEGAL_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple legal/moral standards must be applicable
2. Different standards must yield different conclusions
3. No single standard is clearly correct
4. State explicitly which standard is missing

IMPORTANT: Include two completions showing different legal/moral standards

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F8: Moral/Legal Causation with CONDITIONAL answer.`,
};

export default F8_MORAL_LEGAL_CONDITIONAL;

