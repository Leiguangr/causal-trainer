/**
 * L2 NO Prompt: T9 - Confounder-Mediator Confusion
 * Family: Confounding (F3)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T9_CONF_MED: PromptDefinition = {
  id: 'L2-T9',
  level: 'L2',
  validity: 'NO',
  trapType: 'T9',
  trapName: 'Confounder-Mediator Confusion',
  family: 'Confounding',

  description:
    'A variable Z could be either a confounder or a mediator - the temporal order is unclear. Adjusting for Z could remove a real effect or fail to remove a spurious one.',

  coreChallenge:
    'Recognizing that when temporal order is ambiguous, adjusting for Z may either underestimate (if mediator) or overestimate (if confounder) the true effect.',

  keyQuestion: 'Does Z occur before or after the intervention?',

  validationChecklist: [
    'Variable Z is associated with both X and Y',
    'Temporal order of Z relative to X is unclear',
    'Adjusting for Z could remove real effect or spurious effect',
    'The analysis makes unwarranted assumptions about Z',
  ],

  examples: [
    {
      scenario:
        'An insurance company found that clients who use their financial planning app have 30% lower claims. Analysts adjusted for "financial stress levels" and the effect dropped to 5%. They concluded the app has minimal direct effect. However, reduced financial stress may be a RESULT of using the app.',
      claim: 'Using the financial planning app causes claims to decrease minimally (only 5%).',
      variables: {
        X: 'Using the financial planning app',
        Y: 'Insurance claim reduction',
        Z: 'Financial stress levels (could be mediator or confounder)',
      },
      groundTruth: 'NO',
      explanation:
        'Financial stress could be a mediator (app → less stress → fewer claims) or a confounder (stressed people both avoid app AND file more claims). If it\'s a mediator, adjusting for it removes a real causal pathway. The 5% estimate may understate the true effect.',
      wiseRefusal:
        'NO. This analysis confuses mediators and confounders. If financial stress is a MEDIATOR (app reduces stress, which reduces claims), adjusting for it removes part of the real causal effect. The 30% reduction may be the true effect operating through stress reduction. Without knowing the temporal order, we cannot conclude the app has "minimal" effect.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Confounder-Mediator Confusion

TRAP: T9 - Confounder-Mediator Confusion
FAMILY: Confounding (F3)
DESCRIPTION: ${T9_CONF_MED.description}

CORE CHALLENGE: ${T9_CONF_MED.coreChallenge}

KEY QUESTION TO EMBED: "${T9_CONF_MED.keyQuestion}"

VALIDATION CHECKLIST:
${T9_CONF_MED.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T9_CONF_MED.examples[0].scenario}

Claim: ${T9_CONF_MED.examples[0].claim}

Variables:
- X: ${T9_CONF_MED.examples[0].variables.X}
- Y: ${T9_CONF_MED.examples[0].variables.Y}
- Z: ${T9_CONF_MED.examples[0].variables.Z}

Ground Truth: ${T9_CONF_MED.examples[0].groundTruth}

Explanation: ${T9_CONF_MED.examples[0].explanation}

Wise Refusal: ${T9_CONF_MED.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Variable Z must be ambiguous - could be confounder or mediator
2. Temporal order of Z relative to X must be unclear
3. The analysis must make unwarranted assumptions about Z
4. The confusion must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T9: Confounder-Mediator Confusion in intervention.`,
};

export default T9_CONF_MED;

