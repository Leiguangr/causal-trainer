/**
 * L1 WOLF Prompt: W5 - Ecological Fallacy
 * Family: Ecological (F2)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W5_ECOLOGICAL_FALLACY: PromptDefinition = {
  id: 'L1-W5',
  level: 'L1',
  validity: 'NO',
  trapType: 'W5',
  trapName: 'Ecological Fallacy',
  family: 'Ecological',

  description:
    'Inferring individual-level relationships from group-level (aggregate) data. Correlations at the group level may not hold at the individual level.',

  coreChallenge:
    'Recognizing that patterns observed in aggregate data (countries, companies, sectors) may not apply to individuals within those groups.',

  keyQuestion: 'Is the conclusion about individuals drawn from group-level data?',

  validationChecklist: [
    'Data is presented at an aggregate level (countries, sectors, companies)',
    'A conclusion is drawn about individual-level behavior or outcomes',
    'The individual-level relationship may differ from the aggregate pattern',
    'The ecological fallacy is embedded, not explicitly labeled',
  ],

  examples: [
    {
      scenario:
        'A study found that countries with higher average stock market participation have higher GDP per capita. An economist concluded that individuals who invest in stocks become wealthier.',
      claim: 'Individual stock market participation causes individual wealth.',
      variables: {
        X: 'Individual stock market participation',
        Y: 'Individual wealth',
        Z: 'Country-level aggregation hiding within-country variation',
      },
      groundTruth: 'NO',
      explanation:
        'The data is at the country level, not individual level. Within wealthy countries, many non-investors are wealthy, and many investors are not. The country-level correlation does not imply individual causation.',
      wiseRefusal:
        'NO. This is an ecological fallacy. The study shows a correlation between country-level stock market participation and country-level GDP, but this does not mean individual investors become wealthier. Wealthy countries may have both higher participation AND higher wealth for unrelated reasons (financial infrastructure, education, institutions). The individual-level relationship cannot be inferred from aggregate data.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Ecological Fallacy

TRAP: W5 - Ecological Fallacy
FAMILY: Ecological (F2)
DESCRIPTION: ${W5_ECOLOGICAL_FALLACY.description}

CORE CHALLENGE: ${W5_ECOLOGICAL_FALLACY.coreChallenge}

KEY QUESTION TO EMBED: "${W5_ECOLOGICAL_FALLACY.keyQuestion}"

VALIDATION CHECKLIST:
${W5_ECOLOGICAL_FALLACY.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W5_ECOLOGICAL_FALLACY.examples[0].scenario}

Claim: ${W5_ECOLOGICAL_FALLACY.examples[0].claim}

Variables:
- X: ${W5_ECOLOGICAL_FALLACY.examples[0].variables.X}
- Y: ${W5_ECOLOGICAL_FALLACY.examples[0].variables.Y}
- Z: ${W5_ECOLOGICAL_FALLACY.examples[0].variables.Z}

Ground Truth: ${W5_ECOLOGICAL_FALLACY.examples[0].groundTruth}

Explanation: ${W5_ECOLOGICAL_FALLACY.examples[0].explanation}

Wise Refusal: ${W5_ECOLOGICAL_FALLACY.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Data must be presented at an aggregate level (countries, sectors, etc.)
2. A conclusion must be drawn about individual-level relationships
3. The individual pattern may plausibly differ from the aggregate
4. The ecological fallacy must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W5: Ecological Fallacy.`,
};

export default W5_ECOLOGICAL_FALLACY;

