/**
 * L3 CONDITIONAL Prompt: F3 - Overdetermination
 * Answer: CONDITIONAL - Depends on unspecified timing/priority
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

export const F3_OVERDETERMINATION_CONDITIONAL: PromptDefinition = {
  id: 'L3-F3-CONDITIONAL',
  level: 'L3',
  validity: 'CONDITIONAL',
  trapType: 'F3',
  trapName: 'Overdetermination',
  family: 'Overdetermination',

  description:
    'Multiple potential causes exist, but whether symmetric (both sufficient) or asymmetric (one preempts) is unclear.',

  coreChallenge:
    'Recognizing that the type of overdetermination is not specified, making the answer conditional.',

  keyQuestion: 'Would another cause have sufficed?',

  validationChecklist: [
    'Multiple potential causes exist',
    'The relationship between causes is ambiguous',
    'Preemption vs symmetric overdetermination is unclear',
    'Specifying the relationship would resolve the issue',
  ],

  examples: [
    {
      scenario:
        'A company\'s stock dropped 30% on a day when both (1) earnings were reported below expectations, and (2) a major competitor announced a breakthrough product. Both pieces of news were released within minutes of each other during trading hours.',
      claim: 'If earnings had met expectations, the stock would not have dropped 30%.',
      variables: {
        X: 'Earnings missing expectations',
        Y: '30% stock drop',
        Z: 'Competitor announcement (second cause)',
      },
      groundTruth: 'CONDITIONAL',
      explanation:
        'We cannot tell if this is preemption (one cause would have blocked the other) or symmetric overdetermination (both independently sufficient). If the competitor news would have caused the same drop regardless, the counterfactual is INVALID. If earnings preempted attention, it might be VALID.',
      wiseRefusal:
        'CONDITIONAL. We cannot determine whether this is symmetric overdetermination or preemption. If the competitor announcement alone would cause a 30% drop (symmetric), then the counterfactual is INVALID. If earnings news preempted and masked the competitor effect (asymmetric), the answer differs. Missing invariant: the independent causal sufficiency of each event.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: CONDITIONAL - The answer depends on unspecified invariants

FAMILY: F3 - Overdetermination
DESCRIPTION: ${F3_OVERDETERMINATION_CONDITIONAL.description}

CORE CHALLENGE: ${F3_OVERDETERMINATION_CONDITIONAL.coreChallenge}

KEY QUESTION: "${F3_OVERDETERMINATION_CONDITIONAL.keyQuestion}"

${buildL3SubtypeGuidance(F3_SUBTYPES)}

VALIDATION CHECKLIST:
${F3_OVERDETERMINATION_CONDITIONAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].scenario}

Counterfactual Claim: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].claim}

Variables:
- X: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].variables.X}
- Y: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].variables.Y}
- Z: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].variables.Z}

Ground Truth: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].groundTruth}

Explanation: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].explanation}

Wise Refusal: ${F3_OVERDETERMINATION_CONDITIONAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple causes must exist
2. The type of overdetermination must be unclear
3. Different types lead to different answers
4. State explicitly what information is missing

IMPORTANT: Include two completions showing how different overdetermination types lead to different answers

${getWiseRefusalFormat('CONDITIONAL')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F3: Overdetermination with CONDITIONAL answer.`,
};

export default F3_OVERDETERMINATION_CONDITIONAL;

