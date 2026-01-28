/**
 * L1 SHEEP Prompt: S3 - Lottery / Quasi-Random Assignment
 * Tier: Core
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S3_LOTTERY: PromptDefinition = {
  id: 'L1-S3',
  level: 'L1',
  validity: 'YES',
  trapType: 'S3',
  trapName: 'Lottery / Quasi-Random Assignment',
  family: 'Core',

  description:
    'Treatment is assigned through a lottery, random draw, or quasi-random process (e.g., alphabetical order, birth date cutoffs) that is unrelated to potential outcomes.',

  coreChallenge:
    'Recognizing that lottery-based or arbitrary assignment rules create exogenous variation similar to randomization.',

  keyQuestion: 'Is the assignment mechanism unrelated to potential outcomes?',

  validationChecklist: [
    'Treatment is assigned by lottery, random draw, or arbitrary rule',
    'The assignment mechanism is clearly described',
    'The mechanism is plausibly unrelated to outcomes',
    'Winners and losers of the lottery are compared',
  ],

  examples: [
    {
      scenario:
        'An IPO was oversubscribed, so shares were allocated by lottery among 50,000 applicants. Researchers compared the subsequent portfolio returns of lottery winners (who received shares) vs losers (who did not) over the next year.',
      claim: 'IPO allocation affects portfolio returns.',
      variables: {
        X: 'Receiving IPO shares (lottery winner)',
        Y: 'Portfolio returns',
        Z: 'Investor characteristics (balanced by lottery)',
      },
      groundTruth: 'YES',
      explanation:
        'The lottery randomly assigned IPO shares among applicants who all wanted them. Winners and losers are comparable on all characteristics, so return differences can be attributed to the IPO allocation.',
      wiseRefusal:
        'YES. The causal claim is justified. The IPO lottery randomly assigned shares among applicants, creating two comparable groups: winners who received shares and losers who did not. Since all applicants wanted the shares, the lottery eliminates selection bias. Any difference in portfolio returns can be causally attributed to the IPO allocation.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to lottery/quasi-random assignment

EVIDENCE TYPE: S3 - Lottery / Quasi-Random Assignment
TIER: Core
DESCRIPTION: ${S3_LOTTERY.description}

CORE STRENGTH: ${S3_LOTTERY.coreChallenge}

KEY QUESTION: "${S3_LOTTERY.keyQuestion}"

VALIDATION CHECKLIST:
${S3_LOTTERY.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S3_LOTTERY.examples[0].scenario}

Claim: ${S3_LOTTERY.examples[0].claim}

Variables:
- X: ${S3_LOTTERY.examples[0].variables.X}
- Y: ${S3_LOTTERY.examples[0].variables.Y}
- Z: ${S3_LOTTERY.examples[0].variables.Z}

Ground Truth: ${S3_LOTTERY.examples[0].groundTruth}

Explanation: ${S3_LOTTERY.examples[0].explanation}

Wise Refusal: ${S3_LOTTERY.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Treatment must be assigned by lottery or quasi-random mechanism
2. The assignment mechanism must be clearly described
3. The mechanism must be plausibly unrelated to outcomes
4. Winners and losers must be compared

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S3: Lottery / Quasi-Random Assignment.`,
};

export default S3_LOTTERY;

