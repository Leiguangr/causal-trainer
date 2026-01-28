/**
 * L2 NO Prompt: T1 - Selection
 * Family: Selection Effects (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T1_SELECTION: PromptDefinition = {
  id: 'L2-T1',
  level: 'L2',
  validity: 'NO',
  trapType: 'T1',
  trapName: 'Selection',
  family: 'Selection Effects',

  description:
    'Non-random sampling creates bias in intervention effect estimates. The treated population differs systematically from the target population.',

  coreChallenge:
    'Recognizing that intervention effects estimated on a selected sample may not generalize to the broader population.',

  keyQuestion: 'Who is excluded from the intervention study?',

  validationChecklist: [
    'Intervention applied to non-representative sample',
    'Selection mechanism correlates with outcome',
    'Effect would differ in general population',
    'The selection bias invalidates the causal claim',
  ],

  examples: [
    {
      scenario:
        'A hedge fund tested a new algorithmic trading strategy on their most experienced traders. After 6 months, the strategy showed 15% excess returns. The fund concluded the strategy would work for all their traders.',
      claim: 'Implementing this strategy for all traders causes them to achieve 15% excess returns.',
      variables: {
        X: 'Implementing the algorithmic trading strategy',
        Y: 'Achieving 15% excess returns',
        Z: 'Trader experience level (selection variable)',
      },
      groundTruth: 'NO',
      explanation:
        'The strategy was tested only on experienced traders who may be better at adapting to new systems. Less experienced traders might not achieve the same results. The selection of top performers biases the estimated effect.',
      wiseRefusal:
        'NO. The intervention effect is biased by selection. Testing only on experienced traders creates selection bias: they may be better at learning new systems, more disciplined in execution, and more adept at handling edge cases. The 15% return achieved by this selected group would likely not generalize to all traders.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Selection Bias

TRAP: T1 - Selection
FAMILY: Selection Effects (F1)
DESCRIPTION: ${T1_SELECTION.description}

CORE CHALLENGE: ${T1_SELECTION.coreChallenge}

KEY QUESTION TO EMBED: "${T1_SELECTION.keyQuestion}"

VALIDATION CHECKLIST:
${T1_SELECTION.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T1_SELECTION.examples[0].scenario}

Claim: ${T1_SELECTION.examples[0].claim}

Variables:
- X: ${T1_SELECTION.examples[0].variables.X}
- Y: ${T1_SELECTION.examples[0].variables.Y}
- Z: ${T1_SELECTION.examples[0].variables.Z}

Ground Truth: ${T1_SELECTION.examples[0].groundTruth}

Explanation: ${T1_SELECTION.examples[0].explanation}

Wise Refusal: ${T1_SELECTION.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must describe an intervention tested on a selected sample
2. The selection mechanism must correlate with the outcome
3. The claim must ask about effects in the general population
4. The selection bias must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T1: Selection Bias in intervention.`,
};

export default T1_SELECTION;

