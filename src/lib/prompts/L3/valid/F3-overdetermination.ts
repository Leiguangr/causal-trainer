/**
 * L3 VALID Prompt: F3 - Overdetermination (edge case where VALID)
 * Answer: VALID - The counterfactual claim is supported despite overdetermination context
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F3 (from T3-L3 Guidelines)
const F3_SUBTYPES = [
  'Symmetric Overdetermination - multiple sufficient causes occur together (neither is necessary)',
  'Preemption - early cause brings about Y and blocks a backup cause',
  'Simultaneous Lethal Actions - "double-assassin" style structures',
  'Threshold Effects - several factors jointly push the system past a threshold',
];

export const F3_OVERDETERMINATION_VALID: PromptDefinition = {
  id: 'L3-F3-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F3',
  trapName: 'Overdetermination - Preemption',
  family: 'Overdetermination',

  description:
    'Cases where more than one cause is sufficient for the outcome, but preemption allows identifying the actual cause.',

  coreChallenge:
    'Recognizing that preemption cases can yield VALID counterfactuals when the first cause blocks the backup cause.',

  keyQuestion: 'Would another cause have sufficed?',

  validationChecklist: [
    'Multiple potential causes existed',
    'One cause acted first (preemption)',
    'The backup cause was blocked or rendered inoperative',
    'But-for reasoning applies to the preempting cause',
  ],

  examples: [
    {
      scenario:
        'Two hedge funds independently identified the same arbitrage opportunity. Fund A executed at 9:01 AM, closing the spread. Fund B had orders queued for 9:02 AM but their orders failed because the spread no longer existed. Fund A captured $2M in profits.',
      claim: 'If Fund A had not executed at 9:01 AM, they would not have captured the $2M profit.',
      variables: {
        X: 'Fund A executing at 9:01 AM',
        Y: 'Fund A capturing $2M profit',
        Z: 'Fund B as potential backup executor',
      },
      groundTruth: 'VALID',
      explanation:
        'Although Fund B was a potential backup, Fund A preempted them by executing first. The but-for test applies to Fund A: if they had not executed, Fund B would have captured the profit (not Fund A). The counterfactual about Fund A is VALID.',
      wiseRefusal:
        'VALID. This is a preemption case. Fund A preempted Fund B by executing first. The counterfactual "If Fund A had not executed, Fund A would not have the profit" is valid because: (1) Fund A\'s execution was the actual cause, (2) Fund B would have captured the profit instead. Fund A\'s action was necessary for Fund A\'s profit.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported (preemption case)

FAMILY: F3 - Overdetermination (Preemption subtype)
DESCRIPTION: ${F3_OVERDETERMINATION_VALID.description}

CORE CHALLENGE: ${F3_OVERDETERMINATION_VALID.coreChallenge}

KEY QUESTION: "${F3_OVERDETERMINATION_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F3_SUBTYPES)}

VALIDATION CHECKLIST:
${F3_OVERDETERMINATION_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F3_OVERDETERMINATION_VALID.examples[0].scenario}

Counterfactual Claim: ${F3_OVERDETERMINATION_VALID.examples[0].claim}

Variables:
- X: ${F3_OVERDETERMINATION_VALID.examples[0].variables.X}
- Y: ${F3_OVERDETERMINATION_VALID.examples[0].variables.Y}
- Z: ${F3_OVERDETERMINATION_VALID.examples[0].variables.Z}

Ground Truth: ${F3_OVERDETERMINATION_VALID.examples[0].groundTruth}

Explanation: ${F3_OVERDETERMINATION_VALID.examples[0].explanation}

Wise Refusal: ${F3_OVERDETERMINATION_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple potential causes must exist
2. One cause must preempt the others (act first)
3. The counterfactual must be about the preempting cause
4. The backup cause must have been blocked by the first

IMPORTANT: Frame as "If [X had been different], then [Y would not have occurred to this agent]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F3: Overdetermination (Preemption) with VALID answer.`,
};

export default F3_OVERDETERMINATION_VALID;

