/**
 * L2 NO Prompt: T14 - Recall Bias
 * Family: Information Bias (F5)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T14_RECALL: PromptDefinition = {
  id: 'L2-T14',
  level: 'L2',
  validity: 'NO',
  trapType: 'T14',
  trapName: 'Recall Bias',
  family: 'Information Bias',

  description:
    "Participants' memory of past exposures is biased by their current outcome. Those with negative outcomes remember exposures more thoroughly, creating spurious associations.",

  coreChallenge:
    'Recognizing that retrospective reporting of exposures is influenced by outcome knowledge, biasing intervention effect estimates.',

  keyQuestion: 'Does knowing the outcome affect memory of exposure?',

  validationChecklist: [
    'Exposure data collected retrospectively',
    'Outcome knowledge affects recall',
    'Differential recall creates spurious association',
    'The intervention effect is inflated by recall bias',
  ],

  examples: [
    {
      scenario:
        'Investors who lost money in crypto were surveyed about their research habits before investing. 70% reported not doing thorough research. Among profitable investors, only 30% reported inadequate research. The study concluded that thorough research prevents losses.',
      claim: 'Doing thorough research before crypto investments causes investors to avoid losses.',
      variables: {
        X: 'Doing thorough research',
        Y: 'Avoiding investment losses',
        Z: 'Recall of research behavior (biased by outcome)',
      },
      groundTruth: 'NO',
      explanation:
        'Investors who lost money are more likely to remember (or believe) they did inadequate research - they search for explanations for their losses. Profitable investors may overestimate their research. Recall bias inflates the apparent effect of research.',
      wiseRefusal:
        'NO. This is recall bias. Investors who lost money are motivated to explain their losses and may retrospectively underestimate their research effort ("I should have researched more"). Profitable investors may overestimate their research ("I did my due diligence"). The 70% vs 30% difference is inflated by differential recall.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Recall Bias

TRAP: T14 - Recall Bias
FAMILY: Information Bias (F5)
DESCRIPTION: ${T14_RECALL.description}

CORE CHALLENGE: ${T14_RECALL.coreChallenge}

KEY QUESTION TO EMBED: "${T14_RECALL.keyQuestion}"

VALIDATION CHECKLIST:
${T14_RECALL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T14_RECALL.examples[0].scenario}

Claim: ${T14_RECALL.examples[0].claim}

Variables:
- X: ${T14_RECALL.examples[0].variables.X}
- Y: ${T14_RECALL.examples[0].variables.Y}
- Z: ${T14_RECALL.examples[0].variables.Z}

Ground Truth: ${T14_RECALL.examples[0].groundTruth}

Explanation: ${T14_RECALL.examples[0].explanation}

Wise Refusal: ${T14_RECALL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Exposure must be measured retrospectively
2. Outcome knowledge must affect recall of exposure
3. Differential recall must inflate the apparent effect
4. The recall bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T14: Recall Bias in intervention.`,
};

export default T14_RECALL;

