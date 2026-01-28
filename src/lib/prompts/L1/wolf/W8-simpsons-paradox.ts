/**
 * L1 WOLF Prompt: W8 - Simpson's Paradox
 * Family: Confounding (F3)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W8_SIMPSONS_PARADOX: PromptDefinition = {
  id: 'L1-W8',
  level: 'L1',
  validity: 'NO',
  trapType: 'W8',
  trapName: "Simpson's Paradox",
  family: 'Confounding',

  description:
    'A trend that appears in aggregate data reverses or disappears when the data is split into subgroups. The aggregate correlation is misleading due to a lurking variable.',

  coreChallenge:
    'Recognizing that aggregate patterns can be completely reversed when examining subgroups, and the aggregate conclusion may be wrong.',

  keyQuestion: 'Does the pattern hold within subgroups, or does it reverse?',

  validationChecklist: [
    'An aggregate correlation is presented',
    'The data can be split by a relevant grouping variable',
    'The correlation reverses or disappears within subgroups',
    'The aggregate conclusion is misleading',
  ],

  examples: [
    {
      scenario:
        'A brokerage compared two trading strategies across all market conditions. Strategy A had 55% winning trades overall vs 50% for Strategy B. The firm recommended Strategy A as superior. However, in bull markets A won 60% vs B\'s 65%, and in bear markets A won 45% vs B\'s 48%.',
      claim: 'Strategy A is superior to Strategy B.',
      variables: {
        X: 'Using Strategy A vs Strategy B',
        Y: 'Trade win rate',
        Z: 'Market conditions (bull vs bear) - lurking variable',
      },
      groundTruth: 'NO',
      explanation:
        "Strategy B outperforms A in BOTH bull and bear markets. A's higher aggregate rate occurs because A was used more often in bull markets (where both strategies do better). This is Simpson's Paradox.",
      wiseRefusal:
        "NO. This is Simpson's Paradox. While Strategy A has a higher overall win rate (55% vs 50%), Strategy B actually outperforms in BOTH market conditions: 65% vs 60% in bull markets, and 48% vs 45% in bear markets. The aggregate reversal occurs because Strategy A was disproportionately used during bull markets. Strategy B is actually superior in every subgroup.",
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Simpson's Paradox

TRAP: W8 - Simpson's Paradox
FAMILY: Confounding (F3)
DESCRIPTION: ${W8_SIMPSONS_PARADOX.description}

CORE CHALLENGE: ${W8_SIMPSONS_PARADOX.coreChallenge}

KEY QUESTION TO EMBED: "${W8_SIMPSONS_PARADOX.keyQuestion}"

VALIDATION CHECKLIST:
${W8_SIMPSONS_PARADOX.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W8_SIMPSONS_PARADOX.examples[0].scenario}

Claim: ${W8_SIMPSONS_PARADOX.examples[0].claim}

Variables:
- X: ${W8_SIMPSONS_PARADOX.examples[0].variables.X}
- Y: ${W8_SIMPSONS_PARADOX.examples[0].variables.Y}
- Z: ${W8_SIMPSONS_PARADOX.examples[0].variables.Z}

Ground Truth: ${W8_SIMPSONS_PARADOX.examples[0].groundTruth}

Explanation: ${W8_SIMPSONS_PARADOX.examples[0].explanation}

Wise Refusal: ${W8_SIMPSONS_PARADOX.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. An aggregate correlation must be presented
2. Subgroup data must show the pattern reverses
3. The aggregate conclusion must be misleading
4. Simpson's Paradox must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W8: Simpson's Paradox.`,
};

export default W8_SIMPSONS_PARADOX;

