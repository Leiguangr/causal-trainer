/**
 * L2 NO Prompt: T4 - Immortal Time
 * Family: Selection Effects (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T4_IMMORTAL_TIME: PromptDefinition = {
  id: 'L2-T4',
  level: 'L2',
  validity: 'NO',
  trapType: 'T4',
  trapName: 'Immortal Time',
  family: 'Selection Effects',

  description:
    'Person-time is misclassified due to study design. Subjects must survive a certain period to receive treatment, creating guaranteed survival time that inflates treatment benefits.',

  coreChallenge:
    'Recognizing that requiring survival to receive treatment creates a period of "immortal time" that biases comparisons.',

  keyQuestion: 'Did subjects have to survive a certain period to be classified as treated?',

  validationChecklist: [
    'Treatment requires survival to a certain point',
    'Time before treatment counted as "treated" time',
    'Survival advantage is artifact of classification',
    'Control group does not have the same requirement',
  ],

  examples: [
    {
      scenario:
        'A study found that investors who joined a premium investment club had 40% higher portfolio survival rates over 10 years. The club requires $500K minimum portfolio and 3 years of membership history. Researchers concluded the club\'s strategies improve portfolio longevity.',
      claim: 'Joining the premium club causes investor portfolios to survive longer.',
      variables: {
        X: 'Joining the premium investment club',
        Y: 'Portfolio survival',
        Z: 'Immortal time (3 years of survival required to join)',
      },
      groundTruth: 'NO',
      explanation:
        'Investors must have already survived 3 years with $500K to join the club. This creates immortal time: 3 years of guaranteed survival before classification as "treated." The survival advantage is an artifact of the joining requirement, not the club\'s strategies.',
      wiseRefusal:
        'NO. This is immortal time bias. The premium club requires 3 years of membership history and $500K portfolio - meaning members already demonstrated 3 years of portfolio survival before being classified as "treated." This guaranteed survival time inflates the apparent benefit. New investors cannot expect the same protection.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Immortal Time Bias

TRAP: T4 - Immortal Time
FAMILY: Selection Effects (F1)
DESCRIPTION: ${T4_IMMORTAL_TIME.description}

CORE CHALLENGE: ${T4_IMMORTAL_TIME.coreChallenge}

KEY QUESTION TO EMBED: "${T4_IMMORTAL_TIME.keyQuestion}"

VALIDATION CHECKLIST:
${T4_IMMORTAL_TIME.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T4_IMMORTAL_TIME.examples[0].scenario}

Claim: ${T4_IMMORTAL_TIME.examples[0].claim}

Variables:
- X: ${T4_IMMORTAL_TIME.examples[0].variables.X}
- Y: ${T4_IMMORTAL_TIME.examples[0].variables.Y}
- Z: ${T4_IMMORTAL_TIME.examples[0].variables.Z}

Ground Truth: ${T4_IMMORTAL_TIME.examples[0].groundTruth}

Explanation: ${T4_IMMORTAL_TIME.examples[0].explanation}

Wise Refusal: ${T4_IMMORTAL_TIME.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Treatment must require survival to a certain point in time
2. Pre-treatment time should be misclassified as treated time
3. The survival advantage must be an artifact
4. The immortal time bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T4: Immortal Time Bias in intervention.`,
};

export default T4_IMMORTAL_TIME;

