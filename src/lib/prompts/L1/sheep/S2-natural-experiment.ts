/**
 * L1 SHEEP Prompt: S2 - Natural Experiment
 * Tier: Core
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S2_NATURAL_EXPERIMENT: PromptDefinition = {
  id: 'L1-S2',
  level: 'L1',
  validity: 'YES',
  trapType: 'S2',
  trapName: 'Natural Experiment',
  family: 'Core',

  description:
    'An external event or policy creates as-if random variation in treatment, allowing causal inference without deliberate randomization.',

  coreChallenge:
    'Recognizing that natural variation (policy changes, geographic boundaries, timing cutoffs) can create quasi-random treatment assignment.',

  keyQuestion: 'Does the natural variation create as-if random assignment?',

  validationChecklist: [
    'An external event creates variation in treatment',
    'The variation is plausibly unrelated to potential outcomes',
    'Affected and unaffected groups are compared',
    'The natural experiment approximates random assignment',
  ],

  examples: [
    {
      scenario:
        'When a new tax on high-frequency trading was implemented in France but not Germany in 2012, researchers compared trading volumes in similar stocks listed on both exchanges. French-listed stocks saw a 20% decline in trading volume compared to German-listed stocks.',
      claim: 'The high-frequency trading tax causes reduced trading volume.',
      variables: {
        X: 'High-frequency trading tax',
        Y: 'Trading volume decline',
        Z: 'Country of listing (natural variation)',
      },
      groundTruth: 'YES',
      explanation:
        'The tax was imposed by government policy, not by trader choice. Comparing similar stocks across the border creates a natural experiment where the tax is the only systematic difference.',
      wiseRefusal:
        'YES. The causal claim is justified. The French tax created a natural experiment: similar stocks listed in France vs Germany experienced different regulatory treatment due to government policy, not self-selection. The 20% volume decline in French stocks can be causally attributed to the tax because the cross-border comparison controls for market-wide factors.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to natural experiment

EVIDENCE TYPE: S2 - Natural Experiment
TIER: Core
DESCRIPTION: ${S2_NATURAL_EXPERIMENT.description}

CORE STRENGTH: ${S2_NATURAL_EXPERIMENT.coreChallenge}

KEY QUESTION: "${S2_NATURAL_EXPERIMENT.keyQuestion}"

VALIDATION CHECKLIST:
${S2_NATURAL_EXPERIMENT.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S2_NATURAL_EXPERIMENT.examples[0].scenario}

Claim: ${S2_NATURAL_EXPERIMENT.examples[0].claim}

Variables:
- X: ${S2_NATURAL_EXPERIMENT.examples[0].variables.X}
- Y: ${S2_NATURAL_EXPERIMENT.examples[0].variables.Y}
- Z: ${S2_NATURAL_EXPERIMENT.examples[0].variables.Z}

Ground Truth: ${S2_NATURAL_EXPERIMENT.examples[0].groundTruth}

Explanation: ${S2_NATURAL_EXPERIMENT.examples[0].explanation}

Wise Refusal: ${S2_NATURAL_EXPERIMENT.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. An external event must create variation in treatment
2. The variation must be plausibly exogenous (not self-selected)
3. Affected and unaffected groups must be compared
4. The natural experiment should approximate random assignment

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S2: Natural Experiment.`,
};

export default S2_NATURAL_EXPERIMENT;

