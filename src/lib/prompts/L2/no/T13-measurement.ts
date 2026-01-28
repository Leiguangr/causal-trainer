/**
 * L2 NO Prompt: T13 - Measurement Bias
 * Family: Information Bias (F5)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T13_MEASUREMENT: PromptDefinition = {
  id: 'L2-T13',
  level: 'L2',
  validity: 'NO',
  trapType: 'T13',
  trapName: 'Measurement Bias',
  family: 'Information Bias',

  description:
    'The exposure or outcome is measured with systematic error that differs by treatment status. Differential measurement creates a spurious intervention effect.',

  coreChallenge:
    'Recognizing that when measurement accuracy differs between treated and untreated groups, the observed effect may be an artifact.',

  keyQuestion: 'Is the measurement differentially accurate across groups?',

  validationChecklist: [
    'Measurement error is systematic, not random',
    'Error differs by treatment/exposure status',
    'Bias direction can be determined',
    'The intervention effect is partially or fully artifactual',
  ],

  examples: [
    {
      scenario:
        'A trading platform added a performance analytics dashboard for premium users. Premium users showed 25% higher trading accuracy after the feature launch. The platform concluded the dashboard improves trading decisions.',
      claim: 'Rolling out the dashboard to all users causes trading accuracy to improve by 25%.',
      variables: {
        X: 'Using the performance analytics dashboard',
        Y: 'Trading accuracy',
        Z: 'Measurement of accuracy (more precise for dashboard users)',
      },
      groundTruth: 'NO',
      explanation:
        'The dashboard itself measures and reports trading accuracy more precisely. Premium users appear more accurate because their performance is better measured, not because it is actually better. The "improvement" is measurement bias.',
      wiseRefusal:
        'NO. This is measurement bias. The analytics dashboard measures and reports trading accuracy more precisely for premium users. Their trades are tracked in more detail, making accurate trades more visible. The 25% improvement may reflect better measurement, not better performance. Without standardized measurement, the effect cannot be attributed to the dashboard.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Measurement Bias

TRAP: T13 - Measurement Bias
FAMILY: Information Bias (F5)
DESCRIPTION: ${T13_MEASUREMENT.description}

CORE CHALLENGE: ${T13_MEASUREMENT.coreChallenge}

KEY QUESTION TO EMBED: "${T13_MEASUREMENT.keyQuestion}"

VALIDATION CHECKLIST:
${T13_MEASUREMENT.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T13_MEASUREMENT.examples[0].scenario}

Claim: ${T13_MEASUREMENT.examples[0].claim}

Variables:
- X: ${T13_MEASUREMENT.examples[0].variables.X}
- Y: ${T13_MEASUREMENT.examples[0].variables.Y}
- Z: ${T13_MEASUREMENT.examples[0].variables.Z}

Ground Truth: ${T13_MEASUREMENT.examples[0].groundTruth}

Explanation: ${T13_MEASUREMENT.examples[0].explanation}

Wise Refusal: ${T13_MEASUREMENT.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Measurement must be systematically different by treatment status
2. The measurement bias must create a spurious effect
3. The direction of bias should be determinable
4. The measurement bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T13: Measurement Bias in intervention.`,
};

export default T13_MEASUREMENT;

