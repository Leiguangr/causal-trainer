/**
 * L3 VALID Prompt: F8 - Moral and Legal Causation
 * Answer: VALID - The moral/legal causation claim is supported
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

export const F8_MORAL_LEGAL_VALID: PromptDefinition = {
  id: 'L3-F8-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F8',
  trapName: 'Moral/Legal Causation',
  family: 'Moral/Legal Causation',

  description:
    'Counterfactuals embedded in normative standards (legal proof thresholds, omissions, intent), where correctness depends on matching the stated standard.',

  coreChallenge:
    'Recognizing when legal/moral causation is clear: proximate cause, no intervening causes, foreseeable harm.',

  keyQuestion: 'Who is responsible under a standard?',

  validationChecklist: [
    'Proximate cause is established',
    'No superseding intervening causes',
    'Harm was foreseeable',
    'Duty of care was owed and breached',
  ],

  examples: [
    {
      scenario:
        'A financial advisor recommended concentrated positions (80% in one stock) to elderly clients seeking safe retirement income, violating the firm\'s suitability guidelines. The stock dropped 60%, and clients lost most of their retirement savings. The advisor earned higher commissions on the concentrated positions.',
      claim: 'If the advisor had followed suitability guidelines, the clients would not have lost their retirement savings.',
      variables: {
        X: 'Advisor recommending unsuitable concentrated positions',
        Y: 'Clients losing retirement savings',
        Z: 'Suitability guidelines (duty of care)',
      },
      groundTruth: 'VALID',
      explanation:
        'The advisor had a duty of care (suitability requirements), breached it (80% concentration for retirement clients), and the harm (losing retirement savings) was foreseeable. No intervening cause breaks the chain. Legal/moral responsibility is clear.',
      wiseRefusal:
        'VALID. The advisor is legally and morally responsible. Elements satisfied: (1) Duty of care - fiduciary obligation to clients, (2) Breach - violated suitability guidelines with 80% concentration, (3) Causation - unsuitable recommendation directly led to losses, (4) Foreseeable harm - concentration risk is well-known. No superseding cause. The counterfactual is valid.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported (clear legal/moral causation)

FAMILY: F8 - Moral and Legal Causation
DESCRIPTION: ${F8_MORAL_LEGAL_VALID.description}

CORE CHALLENGE: ${F8_MORAL_LEGAL_VALID.coreChallenge}

KEY QUESTION: "${F8_MORAL_LEGAL_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F8_SUBTYPES)}

VALIDATION CHECKLIST:
${F8_MORAL_LEGAL_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F8_MORAL_LEGAL_VALID.examples[0].scenario}

Counterfactual Claim: ${F8_MORAL_LEGAL_VALID.examples[0].claim}

Variables:
- X: ${F8_MORAL_LEGAL_VALID.examples[0].variables.X}
- Y: ${F8_MORAL_LEGAL_VALID.examples[0].variables.Y}
- Z: ${F8_MORAL_LEGAL_VALID.examples[0].variables.Z}

Ground Truth: ${F8_MORAL_LEGAL_VALID.examples[0].groundTruth}

Explanation: ${F8_MORAL_LEGAL_VALID.examples[0].explanation}

Wise Refusal: ${F8_MORAL_LEGAL_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Establish duty of care or standard
2. Show breach of that duty
3. Establish proximate causation
4. Harm must be foreseeable
5. No superseding intervening causes

IMPORTANT: Frame as "If [actor had not breached duty], then [harm would not have occurred]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F8: Moral/Legal Causation with VALID answer.`,
};

export default F8_MORAL_LEGAL_VALID;

