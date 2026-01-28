/**
 * L2 NO Prompt: T5 - Regression to Mean
 * Family: Statistical Artifacts (F2)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T5_REGRESSION: PromptDefinition = {
  id: 'L2-T5',
  level: 'L2',
  validity: 'NO',
  trapType: 'T5',
  trapName: 'Regression to Mean',
  family: 'Statistical Artifacts',

  description:
    'Extreme values naturally regress toward the mean on subsequent measurement. Intervention appears effective but improvement would have occurred anyway.',

  coreChallenge:
    'Recognizing that selection based on extreme initial values guarantees improvement without any intervention effect.',

  keyQuestion: 'Were subjects selected for extreme values before intervention?',

  validationChecklist: [
    'Selection based on extreme initial value',
    'Post-intervention improvement observed',
    'No control group to distinguish from regression',
    'Improvement would occur naturally without intervention',
  ],

  examples: [
    {
      scenario:
        'A trading desk implemented a new risk management system for traders whose monthly losses exceeded $500K in Q3. By Q4, the average loss for this group dropped to $200K. Management credited the new system for the improvement.',
      claim: 'Implementing the risk system for all high-loss traders causes their losses to decrease.',
      variables: {
        X: 'Implementing the new risk management system',
        Y: 'Decrease in trading losses',
        Z: 'Selection based on extreme losses (regression to mean)',
      },
      groundTruth: 'NO',
      explanation:
        'Traders were selected specifically because they had extreme losses. Extreme values naturally regress to the mean. Without a control group of equally extreme traders who didn\'t get the system, the improvement cannot be attributed to the intervention.',
      wiseRefusal:
        'NO. This is regression to the mean. Traders were selected for extremely poor performance ($500K+ losses). Extreme values naturally regress toward average on subsequent measurement - these traders would likely show improvement even without any intervention. Without a control group, the $300K improvement cannot be attributed to the risk system.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Regression to Mean

TRAP: T5 - Regression to Mean
FAMILY: Statistical Artifacts (F2)
DESCRIPTION: ${T5_REGRESSION.description}

CORE CHALLENGE: ${T5_REGRESSION.coreChallenge}

KEY QUESTION TO EMBED: "${T5_REGRESSION.keyQuestion}"

VALIDATION CHECKLIST:
${T5_REGRESSION.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T5_REGRESSION.examples[0].scenario}

Claim: ${T5_REGRESSION.examples[0].claim}

Variables:
- X: ${T5_REGRESSION.examples[0].variables.X}
- Y: ${T5_REGRESSION.examples[0].variables.Y}
- Z: ${T5_REGRESSION.examples[0].variables.Z}

Ground Truth: ${T5_REGRESSION.examples[0].groundTruth}

Explanation: ${T5_REGRESSION.examples[0].explanation}

Wise Refusal: ${T5_REGRESSION.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Subjects must be selected based on extreme initial values
2. Post-intervention improvement must be observed
3. No control group to distinguish real effect from regression
4. The regression to mean must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T5: Regression to Mean in intervention.`,
};

export default T5_REGRESSION;

