/**
 * L1 SHEEP Prompt: S6 - Instrumental Variable
 * Tier: Supporting
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S6_INSTRUMENTAL_VARIABLE: PromptDefinition = {
  id: 'L1-S6',
  level: 'L1',
  validity: 'YES',
  trapType: 'S6',
  trapName: 'Instrumental Variable',
  family: 'Supporting',

  description:
    'An instrument (Z) affects Y only through X, allowing identification of the causal effect of X on Y even with confounding.',

  coreChallenge:
    'Recognizing that a valid instrument creates exogenous variation in X that is unrelated to confounders.',

  keyQuestion: 'Is there an instrument that affects Y only through X?',

  validationChecklist: [
    'An instrument Z is identified',
    'Z affects X (relevance)',
    'Z affects Y only through X (exclusion restriction)',
    'Z is unrelated to confounders (exogeneity)',
  ],

  examples: [
    {
      scenario:
        'Researchers studied whether 401(k) participation increases retirement savings. They used employer match rates as an instrument: higher match rates strongly predict participation, but match rates are set by HR policies unrelated to individual saving preferences. Using this instrument, they found that 401(k) participation increases total retirement savings by $15,000.',
      claim: '401(k) participation causes increased retirement savings.',
      variables: {
        X: '401(k) participation',
        Y: 'Total retirement savings',
        Z: 'Employer match rate (instrument)',
      },
      groundTruth: 'YES',
      explanation:
        'The employer match rate is a valid instrument: it strongly predicts participation (relevance), affects savings only through participation (exclusion), and is set by HR policy, not individual preferences (exogeneity).',
      wiseRefusal:
        'YES. The causal claim is justified using instrumental variables. The employer match rate is a valid instrument: (1) it strongly predicts 401(k) participation, (2) it affects retirement savings only through participation (not directly), and (3) it is set by company HR policy, not individual saving preferences. This allows causal identification of the $15,000 effect.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to instrumental variable

EVIDENCE TYPE: S6 - Instrumental Variable
TIER: Supporting
DESCRIPTION: ${S6_INSTRUMENTAL_VARIABLE.description}

CORE STRENGTH: ${S6_INSTRUMENTAL_VARIABLE.coreChallenge}

KEY QUESTION: "${S6_INSTRUMENTAL_VARIABLE.keyQuestion}"

VALIDATION CHECKLIST:
${S6_INSTRUMENTAL_VARIABLE.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S6_INSTRUMENTAL_VARIABLE.examples[0].scenario}

Claim: ${S6_INSTRUMENTAL_VARIABLE.examples[0].claim}

Variables:
- X: ${S6_INSTRUMENTAL_VARIABLE.examples[0].variables.X}
- Y: ${S6_INSTRUMENTAL_VARIABLE.examples[0].variables.Y}
- Z: ${S6_INSTRUMENTAL_VARIABLE.examples[0].variables.Z}

Ground Truth: ${S6_INSTRUMENTAL_VARIABLE.examples[0].groundTruth}

Explanation: ${S6_INSTRUMENTAL_VARIABLE.examples[0].explanation}

Wise Refusal: ${S6_INSTRUMENTAL_VARIABLE.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A valid instrument Z must be identified
2. Z must affect X (relevance)
3. Z must affect Y only through X (exclusion restriction)
4. Z must be unrelated to confounders (exogeneity)

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S6: Instrumental Variable.`,
};

export default S6_INSTRUMENTAL_VARIABLE;

