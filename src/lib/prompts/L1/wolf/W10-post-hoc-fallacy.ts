/**
 * L1 WOLF Prompt: W10 - Post Hoc Fallacy
 * Family: Direction (F4)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W10_POST_HOC_FALLACY: PromptDefinition = {
  id: 'L1-W10',
  level: 'L1',
  validity: 'NO',
  trapType: 'W10',
  trapName: 'Post Hoc Fallacy',
  family: 'Direction',

  description:
    'Assuming that because Y followed X in time, X must have caused Y. Temporal sequence alone does not establish causation.',

  coreChallenge:
    'Recognizing that "after this, therefore because of this" is a logical fallacy. Temporal precedence is necessary but not sufficient for causation.',

  keyQuestion: 'Is the causal claim based solely on temporal sequence?',

  validationChecklist: [
    'X occurred before Y in time',
    'The causal claim is based primarily on this temporal sequence',
    'No mechanism or controlled comparison is provided',
    'The events could be coincidental or caused by a third factor',
  ],

  examples: [
    {
      scenario:
        'A CEO implemented a new corporate culture initiative in January 2023. By December, the company\'s stock price had risen 25%. The board credited the culture initiative for the stock performance.',
      claim: 'The culture initiative caused the stock price increase.',
      variables: {
        X: 'Corporate culture initiative',
        Y: 'Stock price increase',
        Z: 'Market conditions, earnings, industry trends (alternative causes)',
      },
      groundTruth: 'NO',
      explanation:
        'The claim is based solely on temporal sequence: initiative came first, stock rose after. But 2023 saw broad market gains, and many factors affect stock prices. The timing alone does not establish causation.',
      wiseRefusal:
        'NO. This is the post hoc fallacy (post hoc ergo propter hoc). The claim that the culture initiative caused the stock increase is based solely on temporal sequence. However, 2023 saw significant market-wide gains, the company may have had strong earnings, and countless other factors affect stock prices. Without a controlled comparison or clear mechanism, the temporal sequence alone cannot establish causation.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Post Hoc Fallacy

TRAP: W10 - Post Hoc Fallacy
FAMILY: Direction (F4)
DESCRIPTION: ${W10_POST_HOC_FALLACY.description}

CORE CHALLENGE: ${W10_POST_HOC_FALLACY.coreChallenge}

KEY QUESTION TO EMBED: "${W10_POST_HOC_FALLACY.keyQuestion}"

VALIDATION CHECKLIST:
${W10_POST_HOC_FALLACY.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W10_POST_HOC_FALLACY.examples[0].scenario}

Claim: ${W10_POST_HOC_FALLACY.examples[0].claim}

Variables:
- X: ${W10_POST_HOC_FALLACY.examples[0].variables.X}
- Y: ${W10_POST_HOC_FALLACY.examples[0].variables.Y}
- Z: ${W10_POST_HOC_FALLACY.examples[0].variables.Z}

Ground Truth: ${W10_POST_HOC_FALLACY.examples[0].groundTruth}

Explanation: ${W10_POST_HOC_FALLACY.examples[0].explanation}

Wise Refusal: ${W10_POST_HOC_FALLACY.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. X must occur before Y in time
2. The causal claim must be based primarily on temporal sequence
3. No mechanism or controlled comparison should be provided
4. Alternative explanations should be plausible

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W10: Post Hoc Fallacy.`,
};

export default W10_POST_HOC_FALLACY;

