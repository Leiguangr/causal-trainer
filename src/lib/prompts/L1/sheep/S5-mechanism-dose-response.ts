/**
 * L1 SHEEP Prompt: S5 - Mechanism + Dose-Response
 * Tier: Supporting
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S5_MECHANISM_DOSE_RESPONSE: PromptDefinition = {
  id: 'L1-S5',
  level: 'L1',
  validity: 'YES',
  trapType: 'S5',
  trapName: 'Mechanism + Dose-Response',
  family: 'Supporting',

  description:
    'A clear causal mechanism is identified AND a dose-response relationship is observed (more X leads to more/less Y in a consistent pattern).',

  coreChallenge:
    'Recognizing that mechanism + dose-response together provide strong evidence for causation, even without randomization.',

  keyQuestion: 'Is there both a plausible mechanism AND a dose-response relationship?',

  validationChecklist: [
    'A clear causal mechanism is described',
    'A dose-response relationship is observed',
    'Higher doses lead to stronger effects (or vice versa)',
    'The pattern is consistent and not easily explained by confounding',
  ],

  examples: [
    {
      scenario:
        'A study of margin trading found that investors with 2x leverage lost 15% more than unleveraged investors during the 2022 downturn, while those with 3x leverage lost 28% more, and 4x leverage lost 45% more. The mechanism is clear: leverage amplifies both gains and losses proportionally.',
      claim: 'Higher leverage causes greater losses during market downturns.',
      variables: {
        X: 'Leverage level (2x, 3x, 4x)',
        Y: 'Excess losses during downturn',
        Z: 'Market decline (affects all investors)',
      },
      groundTruth: 'YES',
      explanation:
        'The mechanism (leverage amplifies returns) is well-understood, and the dose-response is clear: 2x→15%, 3x→28%, 4x→45%. This consistent pattern strongly supports causation.',
      wiseRefusal:
        'YES. The causal claim is justified. There is a clear mechanism: leverage mathematically amplifies both gains and losses. The dose-response relationship is consistent: 2x leverage → 15% excess loss, 3x → 28%, 4x → 45%. This monotonic relationship, combined with the known mechanism, provides strong evidence that leverage causes greater losses during downturns.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to mechanism + dose-response

EVIDENCE TYPE: S5 - Mechanism + Dose-Response
TIER: Supporting
DESCRIPTION: ${S5_MECHANISM_DOSE_RESPONSE.description}

CORE STRENGTH: ${S5_MECHANISM_DOSE_RESPONSE.coreChallenge}

KEY QUESTION: "${S5_MECHANISM_DOSE_RESPONSE.keyQuestion}"

VALIDATION CHECKLIST:
${S5_MECHANISM_DOSE_RESPONSE.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].scenario}

Claim: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].claim}

Variables:
- X: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].variables.X}
- Y: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].variables.Y}
- Z: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].variables.Z}

Ground Truth: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].groundTruth}

Explanation: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].explanation}

Wise Refusal: ${S5_MECHANISM_DOSE_RESPONSE.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A clear causal mechanism must be described
2. A dose-response relationship must be observed
3. The pattern must be consistent (more X → more/less Y)
4. Both mechanism AND dose-response must be present

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S5: Mechanism + Dose-Response.`,
};

export default S5_MECHANISM_DOSE_RESPONSE;

