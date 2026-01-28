/**
 * L2 NO Prompt: T7 - Confounder
 * Family: Confounding (F3)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T7_CONFOUNDER: PromptDefinition = {
  id: 'L2-T7',
  level: 'L2',
  validity: 'NO',
  trapType: 'T7',
  trapName: 'Confounder',
  family: 'Confounding',

  description:
    'Standard confounding where a third variable Z is uncontrolled in the intervention analysis. Z affects both treatment assignment and outcome.',

  coreChallenge:
    'Recognizing that an unmeasured common cause of treatment and outcome biases the intervention effect estimate.',

  keyQuestion: 'Is there an unmeasured common cause of treatment and outcome?',

  validationChecklist: [
    'Third variable Z affects both treatment and outcome',
    'Z is not controlled in analysis',
    'Effect would disappear if Z were controlled',
    'The intervention effect is spurious or overstated',
  ],

  examples: [
    {
      scenario:
        'A brokerage found that clients who use their premium research service have 25% higher returns. They concluded that subscribing to premium research causes higher returns and recommend all clients upgrade.',
      claim: 'Subscribing to the premium research service causes client returns to increase by 25%.',
      variables: {
        X: 'Subscribing to premium research',
        Y: 'Higher investment returns',
        Z: 'Investor sophistication and wealth (confounder)',
      },
      groundTruth: 'NO',
      explanation:
        'Sophisticated, wealthy investors are more likely to subscribe to premium research AND more likely to achieve high returns due to their knowledge and resources. Investor sophistication confounds the research-returns relationship.',
      wiseRefusal:
        'NO. The intervention effect is confounded. Wealthy, sophisticated investors are more likely to (1) subscribe to premium research and (2) achieve high returns due to better financial knowledge and resources. Without controlling for investor sophistication, the 25% return difference cannot be attributed to the research service.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Confounding

TRAP: T7 - Confounder
FAMILY: Confounding (F3)
DESCRIPTION: ${T7_CONFOUNDER.description}

CORE CHALLENGE: ${T7_CONFOUNDER.coreChallenge}

KEY QUESTION TO EMBED: "${T7_CONFOUNDER.keyQuestion}"

VALIDATION CHECKLIST:
${T7_CONFOUNDER.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T7_CONFOUNDER.examples[0].scenario}

Claim: ${T7_CONFOUNDER.examples[0].claim}

Variables:
- X: ${T7_CONFOUNDER.examples[0].variables.X}
- Y: ${T7_CONFOUNDER.examples[0].variables.Y}
- Z: ${T7_CONFOUNDER.examples[0].variables.Z}

Ground Truth: ${T7_CONFOUNDER.examples[0].groundTruth}

Explanation: ${T7_CONFOUNDER.examples[0].explanation}

Wise Refusal: ${T7_CONFOUNDER.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A confounder Z must affect both treatment and outcome
2. Z must not be controlled in the analysis
3. The intervention effect must be spurious or overstated
4. The confounding must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T7: Confounding in intervention.`,
};

export default T7_CONFOUNDER;

