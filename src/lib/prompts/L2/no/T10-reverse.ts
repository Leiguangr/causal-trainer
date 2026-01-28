/**
 * L2 NO Prompt: T10 - Reverse Causation
 * Family: Direction Errors (F4)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T10_REVERSE: PromptDefinition = {
  id: 'L2-T10',
  level: 'L2',
  validity: 'NO',
  trapType: 'T10',
  trapName: 'Reverse Causation',
  family: 'Direction Errors',

  description:
    'The claimed causal direction is backwards. X does not cause Y; rather, Y causes X. The intervention target is wrong.',

  coreChallenge:
    'Recognizing that intervening on X will not affect Y because Y is actually the cause, not the effect.',

  keyQuestion: 'Could the outcome be causing the treatment?',

  validationChecklist: [
    'Temporal order not clearly established',
    'Plausible mechanism for Y→X',
    'Claimed intervention effect may be reversed',
    'Intervening on X will not change Y',
  ],

  examples: [
    {
      scenario:
        'A fintech company found that users who set up automatic savings transfers have 40% higher savings rates. They concluded that implementing automatic transfers for all users would increase savings rates by 40%.',
      claim: 'Setting up automatic savings transfers for all users causes savings rates to increase by 40%.',
      variables: {
        X: 'Setting up automatic savings transfers',
        Y: 'Higher savings rates',
        Z: 'User intention to save (true cause)',
      },
      groundTruth: 'NO',
      explanation:
        'Users who intend to save are more likely to set up automatic transfers. The intention causes both behaviors. Automatically enrolling unmotivated users in transfers will not create the intention to save - they may simply cancel or withdraw.',
      wiseRefusal:
        'NO. This is reverse causation. Users who already intend to save are more likely to set up automatic transfers. The intention to save (Y) causes the behavior of setting up transfers (X), not vice versa. Auto-enrolling unmotivated users will not create the intention to save - they will likely cancel or immediately withdraw the transferred funds.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Reverse Causation

TRAP: T10 - Reverse Causation
FAMILY: Direction Errors (F4)
DESCRIPTION: ${T10_REVERSE.description}

CORE CHALLENGE: ${T10_REVERSE.coreChallenge}

KEY QUESTION TO EMBED: "${T10_REVERSE.keyQuestion}"

VALIDATION CHECKLIST:
${T10_REVERSE.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T10_REVERSE.examples[0].scenario}

Claim: ${T10_REVERSE.examples[0].claim}

Variables:
- X: ${T10_REVERSE.examples[0].variables.X}
- Y: ${T10_REVERSE.examples[0].variables.Y}
- Z: ${T10_REVERSE.examples[0].variables.Z}

Ground Truth: ${T10_REVERSE.examples[0].groundTruth}

Explanation: ${T10_REVERSE.examples[0].explanation}

Wise Refusal: ${T10_REVERSE.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The causal direction must be reversed (Y→X not X→Y)
2. Intervening on X will not change Y
3. A plausible mechanism for Y→X must exist
4. The reverse causation must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T10: Reverse Causation in intervention.`,
};

export default T10_REVERSE;

