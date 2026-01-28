/**
 * L1 WOLF Prompt: W1 - Selection Bias
 * Family: Selection (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W1_SELECTION_BIAS: PromptDefinition = {
  id: 'L1-W1',
  level: 'L1',
  validity: 'NO',
  trapType: 'W1',
  trapName: 'Selection Bias',
  family: 'Selection',

  description:
    'The sample is not representative of the population due to systematic inclusion/exclusion criteria that correlate with the outcome.',

  coreChallenge:
    'Recognizing that the observed correlation exists only because of how the sample was selected, not because of a true causal relationship.',

  keyQuestion: 'Is the sample representative, or does the selection process create a spurious correlation?',

  validationChecklist: [
    'The scenario describes a non-random sample selection process',
    'The selection criteria correlate with the outcome variable',
    'A naive reader might conclude causation from the observed correlation',
    'The selection bias is embedded in the scenario, not explicitly labeled',
  ],

  examples: [
    {
      scenario:
        'A financial advisor analyzed her client portfolio and found that 85% of clients who invested in tech stocks during 2020-2021 saw returns exceeding 30%. She concluded that investing in tech stocks causes high returns.',
      claim: 'Investing in tech stocks causes high returns.',
      variables: {
        X: 'Investing in tech stocks',
        Y: 'High returns (>30%)',
        Z: 'Client selection (only successful/retained clients analyzed)',
      },
      groundTruth: 'NO',
      explanation:
        'The advisor only analyzed current clients. Clients who lost money likely left, creating survivorship bias in the sample. The 85% success rate reflects client retention, not tech stock performance.',
      wiseRefusal:
        'NO. The causal claim fails due to selection bias. The advisor analyzed only her current client portfolio, but clients who experienced losses likely terminated their advisory relationship. This creates a biased sample where only successful outcomes are observed. The 85% success rate reflects client retention patterns, not the true causal effect of tech stock investment on returns.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Selection Bias

TRAP: W1 - Selection Bias
FAMILY: Selection (F1)
DESCRIPTION: ${W1_SELECTION_BIAS.description}

CORE CHALLENGE: ${W1_SELECTION_BIAS.coreChallenge}

KEY QUESTION TO EMBED: "${W1_SELECTION_BIAS.keyQuestion}"

VALIDATION CHECKLIST:
${W1_SELECTION_BIAS.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W1_SELECTION_BIAS.examples[0].scenario}

Claim: ${W1_SELECTION_BIAS.examples[0].claim}

Variables:
- X: ${W1_SELECTION_BIAS.examples[0].variables.X}
- Y: ${W1_SELECTION_BIAS.examples[0].variables.Y}
- Z: ${W1_SELECTION_BIAS.examples[0].variables.Z}

Ground Truth: ${W1_SELECTION_BIAS.examples[0].groundTruth}

Explanation: ${W1_SELECTION_BIAS.examples[0].explanation}

Wise Refusal: ${W1_SELECTION_BIAS.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must contain a clear X→Y causal claim
2. Selection bias must be present but NOT explicitly labeled
3. The selection process must systematically exclude certain outcomes
4. A careful reader should be able to identify why the claim fails

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W1: Selection Bias.`,
};

export default W1_SELECTION_BIAS;

