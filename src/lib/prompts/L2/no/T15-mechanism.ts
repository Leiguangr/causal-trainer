/**
 * L2 NO Prompt: T15 - Mechanism Failure
 * Family: Mechanism Failures (F6)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T15_MECHANISM: PromptDefinition = {
  id: 'L2-T15',
  level: 'L2',
  validity: 'NO',
  trapType: 'T15',
  trapName: 'Mechanism Failure',
  family: 'Mechanism Failures',

  description:
    'The intervention targets the wrong causal pathway. The theory of change is incorrect, so the intervention fails to achieve its intended effect.',

  coreChallenge:
    'Recognizing that when the assumed mechanism is wrong, the intervention cannot produce the expected effect.',

  keyQuestion: 'Is the intervention targeting the right causal pathway?',

  validationChecklist: [
    'Intervention has a theory of change',
    'Theory of change is incorrect',
    'Intervention fails because of wrong mechanism',
    'The true causal pathway is different',
  ],

  examples: [
    {
      scenario:
        'A trading firm required all analysts to complete a "behavioral bias" training to reduce overtrading. After training, overtrading did not decrease. The firm was puzzled, but overtrading in this firm was actually driven by compensation structure (commissions per trade), not psychological biases.',
      claim: 'Providing more intensive bias training causes overtrading to decrease.',
      variables: {
        X: 'Behavioral bias training',
        Y: 'Reduction in overtrading',
        Z: 'True cause of overtrading (commission structure)',
      },
      groundTruth: 'NO',
      explanation:
        'The intervention assumes overtrading is caused by psychological biases. But in this firm, overtrading is driven by the compensation structure. Training cannot fix a structural incentive problem. The mechanism is wrong.',
      wiseRefusal:
        'NO. The intervention targets the wrong mechanism. Overtrading in this firm is caused by the commission-based compensation structure, not psychological biases. Even intensive bias training cannot change the fundamental incentive to trade more for higher commissions. The theory of change is incorrect.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Mechanism Failure

TRAP: T15 - Mechanism Failure
FAMILY: Mechanism Failures (F6)
DESCRIPTION: ${T15_MECHANISM.description}

CORE CHALLENGE: ${T15_MECHANISM.coreChallenge}

KEY QUESTION TO EMBED: "${T15_MECHANISM.keyQuestion}"

VALIDATION CHECKLIST:
${T15_MECHANISM.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T15_MECHANISM.examples[0].scenario}

Claim: ${T15_MECHANISM.examples[0].claim}

Variables:
- X: ${T15_MECHANISM.examples[0].variables.X}
- Y: ${T15_MECHANISM.examples[0].variables.Y}
- Z: ${T15_MECHANISM.examples[0].variables.Z}

Ground Truth: ${T15_MECHANISM.examples[0].groundTruth}

Explanation: ${T15_MECHANISM.examples[0].explanation}

Wise Refusal: ${T15_MECHANISM.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The intervention must have a clear theory of change
2. The theory of change must be incorrect
3. The true causal pathway must be different
4. The mechanism failure must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T15: Mechanism Failure in intervention.`,
};

export default T15_MECHANISM;

