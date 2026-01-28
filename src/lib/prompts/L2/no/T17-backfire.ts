/**
 * L2 NO Prompt: T17 - Backfire Effect
 * Family: Mechanism Failures (F6)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T17_BACKFIRE: PromptDefinition = {
  id: 'L2-T17',
  level: 'L2',
  validity: 'NO',
  trapType: 'T17',
  trapName: 'Backfire Effect',
  family: 'Mechanism Failures',

  description:
    'The intervention produces the opposite of its intended effect. Compensatory or oppositional responses cause the intervention to backfire.',

  coreChallenge:
    'Recognizing that interventions can trigger reactions that overwhelm the intended effect, producing opposite outcomes.',

  keyQuestion: 'Does the intervention trigger compensatory or oppositional responses?',

  validationChecklist: [
    'Intervention has intended direction',
    'Actual effect is opposite',
    'Mechanism for backfire is plausible',
    'The backfire is not acknowledged in the claim',
  ],

  examples: [
    {
      scenario:
        'A brokerage sent warnings to clients who were day-trading frequently, informing them of the risks and low success rates. After receiving warnings, these clients increased their trading frequency by 30%. The brokerage was considering more aggressive warnings to reduce risky behavior.',
      claim: 'Sending stronger warnings causes risky trading behavior to decrease.',
      variables: {
        X: 'Sending risk warnings',
        Y: 'Reduction in risky trading',
        Z: 'Psychological reactance (causes backfire)',
      },
      groundTruth: 'NO',
      explanation:
        'The warnings triggered psychological reactance - when people feel their freedom is threatened, they often do the opposite. Stronger warnings are likely to increase, not decrease, risky trading. The intervention backfires.',
      wiseRefusal:
        'NO. The intervention backfires. Risk warnings triggered psychological reactance: traders felt their autonomy was threatened and responded by trading MORE frequently (30% increase). This is the opposite of the intended effect. Stronger warnings will likely intensify reactance, further increasing risky behavior rather than reducing it.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Backfire Effect

TRAP: T17 - Backfire Effect
FAMILY: Mechanism Failures (F6)
DESCRIPTION: ${T17_BACKFIRE.description}

CORE CHALLENGE: ${T17_BACKFIRE.coreChallenge}

KEY QUESTION TO EMBED: "${T17_BACKFIRE.keyQuestion}"

VALIDATION CHECKLIST:
${T17_BACKFIRE.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T17_BACKFIRE.examples[0].scenario}

Claim: ${T17_BACKFIRE.examples[0].claim}

Variables:
- X: ${T17_BACKFIRE.examples[0].variables.X}
- Y: ${T17_BACKFIRE.examples[0].variables.Y}
- Z: ${T17_BACKFIRE.examples[0].variables.Z}

Ground Truth: ${T17_BACKFIRE.examples[0].groundTruth}

Explanation: ${T17_BACKFIRE.examples[0].explanation}

Wise Refusal: ${T17_BACKFIRE.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The intervention must have an intended direction
2. The actual effect must be opposite to intended
3. A mechanism for backfire must be plausible
4. The backfire must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T17: Backfire Effect in intervention.`,
};

export default T17_BACKFIRE;

