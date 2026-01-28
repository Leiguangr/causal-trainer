/**
 * L2 NO Prompt: T3 - Collider
 * Family: Selection Effects (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T3_COLLIDER: PromptDefinition = {
  id: 'L2-T3',
  level: 'L2',
  validity: 'NO',
  trapType: 'T3',
  trapName: 'Collider',
  family: 'Selection Effects',

  description:
    'Conditioning on a common effect Z (X→Z←Y) creates a spurious association between X and Y. The intervention analysis is distorted by collider bias.',

  coreChallenge:
    'Recognizing that controlling for or conditioning on a collider variable creates a spurious relationship that does not exist in the general population.',

  keyQuestion: 'Are we conditioning on an effect of both X and Y?',

  validationChecklist: [
    'Variable Z is affected by both X and Y',
    'Analysis conditions on or selects by Z',
    'X-Y association is spurious, created by conditioning',
    'Intervention effect disappears without conditioning on Z',
  ],

  examples: [
    {
      scenario:
        'A private equity firm analyzed portfolio companies that received both operational consulting (X) and capital infusion (Y) - i.e., their "full service" treatment. Among these companies, they found that more consulting hours were associated with lower returns. They concluded that consulting reduces returns.',
      claim: 'Reducing consulting for portfolio companies causes returns to increase.',
      variables: {
        X: 'Consulting hours',
        Y: 'Investment returns',
        Z: '"Full service" treatment (collider - selected for both)',
      },
      groundTruth: 'NO',
      explanation:
        'The "full service" designation is a collider: companies receive it if they need consulting OR if they have high return potential. By conditioning on this, the firm creates a spurious negative correlation. Companies that need less consulting to be "full service" are there because of higher return potential.',
      wiseRefusal:
        'NO. This is collider bias. "Full service" is a collider variable affected by both consulting needs and return potential. By analyzing only full-service companies, the firm conditions on the collider. This creates a spurious negative correlation: companies needing less consulting are in the sample because they have high return potential. Reducing consulting will not increase returns.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Collider Bias

TRAP: T3 - Collider
FAMILY: Selection Effects (F1)
DESCRIPTION: ${T3_COLLIDER.description}

CORE CHALLENGE: ${T3_COLLIDER.coreChallenge}

KEY QUESTION TO EMBED: "${T3_COLLIDER.keyQuestion}"

VALIDATION CHECKLIST:
${T3_COLLIDER.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T3_COLLIDER.examples[0].scenario}

Claim: ${T3_COLLIDER.examples[0].claim}

Variables:
- X: ${T3_COLLIDER.examples[0].variables.X}
- Y: ${T3_COLLIDER.examples[0].variables.Y}
- Z: ${T3_COLLIDER.examples[0].variables.Z}

Ground Truth: ${T3_COLLIDER.examples[0].groundTruth}

Explanation: ${T3_COLLIDER.examples[0].explanation}

Wise Refusal: ${T3_COLLIDER.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must have a collider variable Z affected by both X and Y
2. The analysis must condition on or select by Z
3. The spurious X-Y relationship must be created by conditioning
4. The collider bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T3: Collider Bias in intervention.`,
};

export default T3_COLLIDER;

