/**
 * L2 NO Prompt: T16 - Goodhart's Law
 * Family: Mechanism Failures (F6)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T16_GOODHART: PromptDefinition = {
  id: 'L2-T16',
  level: 'L2',
  validity: 'NO',
  trapType: 'T16',
  trapName: "Goodhart's Law",
  family: 'Mechanism Failures',

  description:
    'When a metric becomes a target, it ceases to be a good metric. The intervention optimizes the measure, but not the underlying phenomenon it was meant to capture.',

  coreChallenge:
    'Recognizing that targeting a metric directly causes gaming or manipulation that invalidates the metric.',

  keyQuestion: 'Has the metric been gamed or manipulated?',

  validationChecklist: [
    'Metric was valid indicator before intervention',
    'Intervention targets the metric directly',
    'Metric no longer measures what it used to measure',
    'Underlying phenomenon has not improved',
  ],

  examples: [
    {
      scenario:
        'A bank tied loan officer bonuses to loan approval speed. Average approval time dropped from 5 days to 1 day. Management claimed the intervention improved efficiency. However, loan officers began approving applications without proper due diligence to hit speed targets.',
      claim: 'Increasing approval speed incentives causes loan processing to become more efficient.',
      variables: {
        X: 'Tying bonuses to approval speed',
        Y: 'Processing efficiency',
        Z: 'Approval speed metric (now gamed)',
      },
      groundTruth: 'NO',
      explanation:
        'Approval speed was a proxy for efficiency, but when targeted directly, it became gamed. Officers skip due diligence to appear fast. The metric improved, but actual efficiency (quality decisions made quickly) has not. Goodhart\'s Law applies.',
      wiseRefusal:
        'NO. This is Goodhart\'s Law. Approval speed was a reasonable proxy for efficiency BEFORE it was incentivized. Once bonuses were tied to speed, officers began gaming the metric by skipping due diligence. The 1-day speed reflects gaming, not efficiency. Increasing incentives will worsen the gaming, not improve efficiency.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Goodhart's Law

TRAP: T16 - Goodhart's Law
FAMILY: Mechanism Failures (F6)
DESCRIPTION: ${T16_GOODHART.description}

CORE CHALLENGE: ${T16_GOODHART.coreChallenge}

KEY QUESTION TO EMBED: "${T16_GOODHART.keyQuestion}"

VALIDATION CHECKLIST:
${T16_GOODHART.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T16_GOODHART.examples[0].scenario}

Claim: ${T16_GOODHART.examples[0].claim}

Variables:
- X: ${T16_GOODHART.examples[0].variables.X}
- Y: ${T16_GOODHART.examples[0].variables.Y}
- Z: ${T16_GOODHART.examples[0].variables.Z}

Ground Truth: ${T16_GOODHART.examples[0].groundTruth}

Explanation: ${T16_GOODHART.examples[0].explanation}

Wise Refusal: ${T16_GOODHART.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A metric must be targeted by the intervention
2. The metric must be gamed or manipulated as a result
3. The underlying phenomenon must not improve
4. Goodhart's Law must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T16: Goodhart's Law in intervention.`,
};

export default T16_GOODHART;

