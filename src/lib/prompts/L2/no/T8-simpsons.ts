/**
 * L2 NO Prompt: T8 - Simpson's Paradox
 * Family: Confounding (F3)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T8_SIMPSONS: PromptDefinition = {
  id: 'L2-T8',
  level: 'L2',
  validity: 'NO',
  trapType: 'T8',
  trapName: "Simpson's Paradox",
  family: 'Confounding',

  description:
    'The aggregate intervention effect reverses when stratified by a confounding variable Z. The overall effect is misleading because it ignores subgroup differences.',

  coreChallenge:
    'Recognizing that aggregate intervention effects can completely reverse within subgroups, making the aggregate conclusion wrong.',

  keyQuestion: 'Does the intervention effect reverse in subgroups?',

  validationChecklist: [
    'Aggregate shows one direction of effect',
    'Stratified analysis shows opposite direction',
    'Confounding variable explains reversal',
    'The aggregate conclusion is misleading',
  ],

  examples: [
    {
      scenario:
        'A bank compared two loan approval algorithms. Algorithm A approved 60% of applications overall vs B\'s 50%. The bank concluded A is more approving and should be used to increase approvals. However, for prime applicants A approved 70% vs B\'s 80%, and for subprime A approved 40% vs B\'s 55%.',
      claim: 'Switching to Algorithm A causes loan approval rates to increase.',
      variables: {
        X: 'Using Algorithm A',
        Y: 'Higher approval rates',
        Z: 'Applicant credit quality (Simpson\'s variable)',
      },
      groundTruth: 'NO',
      explanation:
        'Algorithm A is actually LESS approving in both subgroups (prime and subprime). Its higher overall rate occurs because it received more subprime applications where approval rates are inherently lower. Switching to A would decrease approvals.',
      wiseRefusal:
        'NO. This is Simpson\'s Paradox. Algorithm A appears more approving overall (60% vs 50%), but it is actually LESS approving in every subgroup: 70% vs 80% for prime, 40% vs 55% for subprime. The reversal occurs because A processed more easy cases. Switching to A would decrease, not increase, approval rates.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Simpson's Paradox

TRAP: T8 - Simpson's Paradox
FAMILY: Confounding (F3)
DESCRIPTION: ${T8_SIMPSONS.description}

CORE CHALLENGE: ${T8_SIMPSONS.coreChallenge}

KEY QUESTION TO EMBED: "${T8_SIMPSONS.keyQuestion}"

VALIDATION CHECKLIST:
${T8_SIMPSONS.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T8_SIMPSONS.examples[0].scenario}

Claim: ${T8_SIMPSONS.examples[0].claim}

Variables:
- X: ${T8_SIMPSONS.examples[0].variables.X}
- Y: ${T8_SIMPSONS.examples[0].variables.Y}
- Z: ${T8_SIMPSONS.examples[0].variables.Z}

Ground Truth: ${T8_SIMPSONS.examples[0].groundTruth}

Explanation: ${T8_SIMPSONS.examples[0].explanation}

Wise Refusal: ${T8_SIMPSONS.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Aggregate must show one direction of intervention effect
2. Subgroups must show the OPPOSITE direction
3. A confounding variable must explain the reversal
4. The Simpson's Paradox must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T8: Simpson's Paradox in intervention.`,
};

export default T8_SIMPSONS;

