/**
 * L2 NO Prompt: T6 - Ecological Fallacy
 * Family: Statistical Artifacts (F2)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const T6_ECOLOGICAL: PromptDefinition = {
  id: 'L2-T6',
  level: 'L2',
  validity: 'NO',
  trapType: 'T6',
  trapName: 'Ecological Fallacy',
  family: 'Statistical Artifacts',

  description:
    'Group-level intervention effects do not translate to individual effects. Aggregate data suggests an effect that does not hold at the individual level.',

  coreChallenge:
    'Recognizing that intervention effects measured at aggregate level may not apply to individuals.',

  keyQuestion: 'Does the group-level effect reflect individual-level causation?',

  validationChecklist: [
    'Intervention measured at group/aggregate level',
    'Causal claim about individuals',
    'Individual-level effect may differ from aggregate',
    'Composition effects explain aggregate pattern',
  ],

  examples: [
    {
      scenario:
        'Cities that implemented financial literacy programs in schools saw a 15% increase in average household savings rates. A personal finance company concluded that enrolling individuals in similar programs would increase their savings by 15%.',
      claim: 'Enrolling an individual in a financial literacy program causes their savings rate to increase by 15%.',
      variables: {
        X: 'Enrolling in financial literacy program',
        Y: '15% increase in personal savings rate',
        Z: 'City-level aggregate effect (ecological level)',
      },
      groundTruth: 'NO',
      explanation:
        'The 15% increase was measured at the city level. The cities that adopted programs may have other characteristics (wealthier, more educated populations) that drive savings. Individual-level effects may be much smaller or nonexistent.',
      wiseRefusal:
        'NO. This is the ecological fallacy. The 15% increase was observed at the city level, not the individual level. Cities that implemented programs may differ systematically from those that did not - in wealth, education, or economic conditions. An individual in any city cannot expect a 15% increase from enrollment.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L2 (Intervention) causal reasoning.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize flawed intervention reasoning
ANSWER: NO - The causal claim about intervention effect is NOT justified due to Ecological Fallacy

TRAP: T6 - Ecological Fallacy
FAMILY: Statistical Artifacts (F2)
DESCRIPTION: ${T6_ECOLOGICAL.description}

CORE CHALLENGE: ${T6_ECOLOGICAL.coreChallenge}

KEY QUESTION TO EMBED: "${T6_ECOLOGICAL.keyQuestion}"

VALIDATION CHECKLIST:
${T6_ECOLOGICAL.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${T6_ECOLOGICAL.examples[0].scenario}

Claim: ${T6_ECOLOGICAL.examples[0].claim}

Variables:
- X: ${T6_ECOLOGICAL.examples[0].variables.X}
- Y: ${T6_ECOLOGICAL.examples[0].variables.Y}
- Z: ${T6_ECOLOGICAL.examples[0].variables.Z}

Ground Truth: ${T6_ECOLOGICAL.examples[0].groundTruth}

Explanation: ${T6_ECOLOGICAL.examples[0].explanation}

Wise Refusal: ${T6_ECOLOGICAL.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Intervention effect must be measured at aggregate/group level
2. Claim must be about individual-level effects
3. The ecological fallacy must be the core error
4. The fallacy must be embedded, not explicitly labeled

IMPORTANT: Frame the claim as an INTERVENTION question using "If X is done, will Y occur?"

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L2}

Generate exactly ONE case that exemplifies T6: Ecological Fallacy in intervention.`,
};

export default T6_ECOLOGICAL;

