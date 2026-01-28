/**
 * L1 SHEEP Prompt: S4 - Controlled Ablation
 * Tier: Core
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S4_CONTROLLED_ABLATION: PromptDefinition = {
  id: 'L1-S4',
  level: 'L1',
  validity: 'YES',
  trapType: 'S4',
  trapName: 'Controlled Ablation',
  family: 'Core',

  description:
    'A component is systematically removed or disabled while holding everything else constant, isolating its causal effect.',

  coreChallenge:
    'Recognizing that removing a single component while controlling for all else allows causal attribution to that component.',

  keyQuestion: 'Was only one component changed while everything else was held constant?',

  validationChecklist: [
    'A specific component is removed or disabled',
    'All other factors are held constant',
    'The outcome is compared with and without the component',
    'The ablation isolates the causal effect of the component',
  ],

  examples: [
    {
      scenario:
        'A quantitative trading firm tested their algorithm by disabling only the sentiment analysis module while keeping all other components identical. Without sentiment analysis, the strategy\'s Sharpe ratio dropped from 1.8 to 1.2 over a 6-month backtest on the same historical data.',
      claim: 'The sentiment analysis module improves strategy performance.',
      variables: {
        X: 'Sentiment analysis module',
        Y: 'Strategy Sharpe ratio',
        Z: 'All other algorithm components (held constant)',
      },
      groundTruth: 'YES',
      explanation:
        'The ablation study isolated the sentiment module by removing only that component. The Sharpe ratio drop can be attributed to the missing module since everything else was identical.',
      wiseRefusal:
        'YES. The causal claim is justified. The controlled ablation removed only the sentiment analysis module while keeping all other algorithm components, data, and testing conditions identical. The 0.6 drop in Sharpe ratio can be causally attributed to the sentiment module because it was the only variable changed.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to controlled ablation

EVIDENCE TYPE: S4 - Controlled Ablation
TIER: Core
DESCRIPTION: ${S4_CONTROLLED_ABLATION.description}

CORE STRENGTH: ${S4_CONTROLLED_ABLATION.coreChallenge}

KEY QUESTION: "${S4_CONTROLLED_ABLATION.keyQuestion}"

VALIDATION CHECKLIST:
${S4_CONTROLLED_ABLATION.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S4_CONTROLLED_ABLATION.examples[0].scenario}

Claim: ${S4_CONTROLLED_ABLATION.examples[0].claim}

Variables:
- X: ${S4_CONTROLLED_ABLATION.examples[0].variables.X}
- Y: ${S4_CONTROLLED_ABLATION.examples[0].variables.Y}
- Z: ${S4_CONTROLLED_ABLATION.examples[0].variables.Z}

Ground Truth: ${S4_CONTROLLED_ABLATION.examples[0].groundTruth}

Explanation: ${S4_CONTROLLED_ABLATION.examples[0].explanation}

Wise Refusal: ${S4_CONTROLLED_ABLATION.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. A specific component must be removed or disabled
2. All other factors must be held constant
3. Outcomes must be compared with and without the component
4. The ablation must isolate the causal effect

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S4: Controlled Ablation.`,
};

export default S4_CONTROLLED_ABLATION;

