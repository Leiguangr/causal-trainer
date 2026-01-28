/**
 * L3 INVALID Prompt: F3 - Overdetermination
 * Answer: INVALID - The counterfactual claim fails due to overdetermination
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

export const F3_OVERDETERMINATION_INVALID: PromptDefinition = {
  id: 'L3-F3-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F3',
  trapName: 'Overdetermination',
  family: 'Overdetermination',

  description:
    'Cases where more than one cause is sufficient for the outcome. The central difficulty is distinguishing necessity, sufficiency, and preemption under a but-for style query.',

  coreChallenge:
    'Recognizing that overdetermination invalidates simple but-for counterfactuals.',

  keyQuestion: 'Would another cause have sufficed?',

  validationChecklist: [
    'Multiple independent causes existed',
    'Each cause was sufficient for the outcome',
    'Causes operated simultaneously',
    'But-for test fails for each individual cause',
  ],

  examples: [
    {
      scenario:
        'A company\'s stock price crashed 40% on the same day that: (1) the CEO was arrested for fraud, and (2) the FDA rejected their main drug. Either event alone historically causes 30-40% drops for similar companies. An investor claims their losses were caused by the FDA rejection.',
      claim: 'If the FDA had approved the drug, the investor would not have suffered the 40% loss.',
      variables: {
        X: 'FDA drug rejection',
        Y: '40% stock price loss',
        Z: 'CEO arrest (independently sufficient cause)',
      },
      groundTruth: 'INVALID',
      explanation:
        'Both events were independently sufficient to cause a 30-40% drop. Even if the FDA had approved the drug, the CEO arrest would have caused similar losses. The but-for test fails because the outcome would have occurred anyway.',
      wiseRefusal:
        'INVALID. This is symmetric overdetermination. Both the FDA rejection and CEO arrest were independently sufficient to cause a ~40% drop. Historical precedent shows either event alone causes 30-40% drops. Even if the FDA had approved the drug, the CEO arrest would have triggered the loss. But-for causation fails; neither event alone is necessary for the outcome.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported (overdetermination)

FAMILY: F3 - Overdetermination
DESCRIPTION: ${F3_OVERDETERMINATION_INVALID.description}

CORE CHALLENGE: ${F3_OVERDETERMINATION_INVALID.coreChallenge}

KEY QUESTION: "${F3_OVERDETERMINATION_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F3_SUBTYPES)}

VALIDATION CHECKLIST:
${F3_OVERDETERMINATION_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F3_OVERDETERMINATION_INVALID.examples[0].scenario}

Counterfactual Claim: ${F3_OVERDETERMINATION_INVALID.examples[0].claim}

Variables:
- X: ${F3_OVERDETERMINATION_INVALID.examples[0].variables.X}
- Y: ${F3_OVERDETERMINATION_INVALID.examples[0].variables.Y}
- Z: ${F3_OVERDETERMINATION_INVALID.examples[0].variables.Z}

Ground Truth: ${F3_OVERDETERMINATION_INVALID.examples[0].groundTruth}

Explanation: ${F3_OVERDETERMINATION_INVALID.examples[0].explanation}

Wise Refusal: ${F3_OVERDETERMINATION_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Multiple independent causes must exist
2. Each cause must be sufficient for the outcome
3. Causes must operate simultaneously (or nearly so)
4. But-for test must fail for each individual cause

IMPORTANT: Frame as "If [X had not occurred], then [Y would not have occurred]" - but the claim is FALSE due to Z

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F3: Overdetermination with INVALID answer.`,
};

export default F3_OVERDETERMINATION_INVALID;

