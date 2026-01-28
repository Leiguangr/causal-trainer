/**
 * L2 NO Prompt: T2 - Survivorship
 * Family: Selection Effects (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T2_SURVIVORSHIP: PromptDefinition = {
  id: 'L2-T2',
  level: 'L2',
  validity: 'NO',
  trapType: 'T2',
  trapName: 'Survivorship',
  family: 'Selection Effects',

  description:
    'Only survivors/successes of an intervention are observed. Those who failed or dropped out are excluded from analysis.',

  coreChallenge:
    'Recognizing that measuring outcomes only on those who completed the intervention overstates its effectiveness.',

  keyQuestion: 'What happened to those who dropped out or failed?',

  validationChecklist: [
    'Outcome measured only on survivors/completers',
    'Dropouts/failures would show different pattern',
    'Causal claim ignores attrition',
    'True intervention effect is overstated',
  ],

  examples: [
    {
      scenario:
        'A venture capital firm analyzed the returns of startups that completed their 3-year accelerator program. The average exit valuation was $50M. The firm claimed their program causes startups to achieve high valuations.',
      claim: 'Joining the accelerator causes startups to achieve high exit valuations.',
      variables: {
        X: 'Joining the accelerator program',
        Y: 'Achieving high exit valuation',
        Z: 'Companies that failed during the program (excluded from analysis)',
      },
      groundTruth: 'NO',
      explanation:
        'The analysis only includes companies that survived to exit. The 60% of startups that failed during the program are excluded. Survivorship bias inflates the apparent effectiveness of the accelerator.',
      wiseRefusal:
        'NO. The intervention effect is overstated due to survivorship bias. The $50M average only includes startups that survived to exit - it excludes the failures. If 60% of startups failed during the program, the true expected value is much lower. A new startup cannot assume it will be among the survivors.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Survivorship Bias

TRAP: T2 - Survivorship
FAMILY: Selection Effects (F1)
DESCRIPTION: ${T2_SURVIVORSHIP.description}

CORE CHALLENGE: ${T2_SURVIVORSHIP.coreChallenge}

KEY QUESTION TO EMBED: "${T2_SURVIVORSHIP.keyQuestion}"

VALIDATION CHECKLIST:
${T2_SURVIVORSHIP.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T2_SURVIVORSHIP.examples[0].scenario}

Claim: ${T2_SURVIVORSHIP.examples[0].claim}

Variables:
- X: ${T2_SURVIVORSHIP.examples[0].variables.X}
- Y: ${T2_SURVIVORSHIP.examples[0].variables.Y}
- Z: ${T2_SURVIVORSHIP.examples[0].variables.Z}

Ground Truth: ${T2_SURVIVORSHIP.examples[0].groundTruth}

Explanation: ${T2_SURVIVORSHIP.examples[0].explanation}

Wise Refusal: ${T2_SURVIVORSHIP.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must describe an intervention with observable attrition
2. Analysis must focus only on survivors/completers
3. Failures or dropouts must be ignored in the effect estimate
4. The survivorship bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T2: Survivorship Bias in intervention.`,
};

export default T2_SURVIVORSHIP;

