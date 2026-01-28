/**
 * L3 INVALID Prompt: F7 - Causal Attribution
 * Answer: INVALID - The attribution claim is not supported
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F7 (from T3-L3 Guidelines)
const F7_SUBTYPES = [
  'Attributable Fraction - population-level contribution (e.g., % of cases caused by factor)',
  'Individual Attribution - contribution given an observed outcome (sufficiency-style)',
  'Path-specific Effects - distinguishing direct vs. mediated contribution',
  'Principal Strata - contribution defined for specific latent groups (complier logic)',
  'Additionality - "would it have happened anyway?" questions',
];

export const F7_ATTRIBUTION_INVALID: PromptDefinition = {
  id: 'L3-F7-INVALID',
  level: 'L3',
  validity: 'INVALID',
  trapType: 'F7',
  trapName: 'Causal Attribution',
  family: 'Causal Attribution',

  description:
    'The trap is collapsing contribution into necessity or misattributing credit to the wrong cause.',

  coreChallenge:
    'Recognizing when causal attribution claims are unfounded or misattributed.',

  keyQuestion: 'How much credit does X deserve?',

  validationChecklist: [
    'The claimed cause did not contribute meaningfully',
    'Attribution is misplaced to the wrong factor',
    'The actual cause is different from what is claimed',
    'Attribution methodology shows the claim is wrong',
  ],

  examples: [
    {
      scenario:
        'A portfolio manager changed their investment strategy from growth to value in 2022. Their portfolio outperformed the benchmark by 5%. They attribute the outperformance to their strategic pivot. However, factor analysis shows the outperformance came entirely from sector allocation (overweight energy +7%), while the value factor contributed -2%.',
      claim: 'If the manager had not pivoted to value investing, they would not have outperformed by 5%.',
      variables: {
        X: 'Pivoting to value investing',
        Y: '5% outperformance',
        Z: 'Sector allocation (actual source of outperformance)',
      },
      groundTruth: 'INVALID',
      explanation:
        'Factor analysis shows value contributed -2% to returns, not positive. The outperformance came from sector allocation (energy overweight). The value pivot actually hurt performance. Attribution to value is incorrect.',
      wiseRefusal:
        'INVALID. The attribution is misplaced. Factor analysis shows: sector allocation (energy) +7%, value factor -2%, resulting in net +5% outperformance. The value pivot actually detracted from performance. The outperformance came from sector allocation, not the value strategy. The counterfactual incorrectly attributes success to the wrong cause.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: INVALID - The counterfactual claim is NOT supported (wrong attribution)

FAMILY: F7 - Causal Attribution
DESCRIPTION: ${F7_ATTRIBUTION_INVALID.description}

CORE CHALLENGE: ${F7_ATTRIBUTION_INVALID.coreChallenge}

KEY QUESTION: "${F7_ATTRIBUTION_INVALID.keyQuestion}"

${buildL3SubtypeGuidance(F7_SUBTYPES)}

VALIDATION CHECKLIST:
${F7_ATTRIBUTION_INVALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F7_ATTRIBUTION_INVALID.examples[0].scenario}

Counterfactual Claim: ${F7_ATTRIBUTION_INVALID.examples[0].claim}

Variables:
- X: ${F7_ATTRIBUTION_INVALID.examples[0].variables.X}
- Y: ${F7_ATTRIBUTION_INVALID.examples[0].variables.Y}
- Z: ${F7_ATTRIBUTION_INVALID.examples[0].variables.Z}

Ground Truth: ${F7_ATTRIBUTION_INVALID.examples[0].groundTruth}

Explanation: ${F7_ATTRIBUTION_INVALID.examples[0].explanation}

Wise Refusal: ${F7_ATTRIBUTION_INVALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The claimed cause must not be the actual cause
2. Factor attribution must show the claim is wrong
3. The real cause must be clearly different
4. The misattribution must be embedded, not obvious

IMPORTANT: Frame as "If [X had not occurred], then [Y would not have occurred]" - but X was NOT the cause

${getWiseRefusalFormat('INVALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F7: Causal Attribution with INVALID answer (wrong attribution).`,
};

export default F7_ATTRIBUTION_INVALID;

