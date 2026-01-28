/**
 * L1 SHEEP Prompt: S1 - Randomized Controlled Trial
 * Tier: Core
 * Answer: YES
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const S1_RCT: PromptDefinition = {
  id: 'L1-S1',
  level: 'L1',
  validity: 'YES',
  trapType: 'S1',
  trapName: 'Randomized Controlled Trial',
  family: 'Core',

  description:
    'A properly randomized experiment where subjects are randomly assigned to treatment and control groups, eliminating confounding and establishing causation.',

  coreChallenge:
    'Recognizing that randomization breaks the link between treatment assignment and confounders, allowing causal inference.',

  keyQuestion: 'Was there proper randomization that eliminates confounding?',

  validationChecklist: [
    'Subjects are randomly assigned to treatment and control groups',
    'The randomization process is clearly described',
    'The outcome is compared between groups',
    'No obvious violations of randomization (e.g., self-selection)',
  ],

  examples: [
    {
      scenario:
        'A fintech company randomly assigned 10,000 users to receive either a new savings nudge feature or the standard interface. After 6 months, users with the nudge saved an average of $450 more than the control group.',
      claim: 'The savings nudge feature causes increased savings.',
      variables: {
        X: 'Receiving the savings nudge feature',
        Y: 'Increased savings ($450 more)',
        Z: 'User characteristics (balanced by randomization)',
      },
      groundTruth: 'YES',
      explanation:
        'Random assignment ensures that treatment and control groups are comparable on all characteristics. The $450 difference can be attributed to the nudge feature, not user differences.',
      wiseRefusal:
        'YES. The causal claim is justified. Random assignment of 10,000 users ensures that the treatment and control groups are statistically equivalent on all observable and unobservable characteristics. The $450 savings difference can be causally attributed to the nudge feature because randomization eliminates confounding.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified due to proper experimental design

EVIDENCE TYPE: S1 - Randomized Controlled Trial
TIER: Core
DESCRIPTION: ${S1_RCT.description}

CORE STRENGTH: ${S1_RCT.coreChallenge}

KEY QUESTION: "${S1_RCT.keyQuestion}"

VALIDATION CHECKLIST:
${S1_RCT.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${S1_RCT.examples[0].scenario}

Claim: ${S1_RCT.examples[0].claim}

Variables:
- X: ${S1_RCT.examples[0].variables.X}
- Y: ${S1_RCT.examples[0].variables.Y}
- Z: ${S1_RCT.examples[0].variables.Z}

Ground Truth: ${S1_RCT.examples[0].groundTruth}

Explanation: ${S1_RCT.examples[0].explanation}

Wise Refusal: ${S1_RCT.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must describe a randomized experiment
2. Random assignment must be clearly stated
3. Treatment and control groups must be compared
4. The causal claim should be supported by the experimental design

${getWiseRefusalFormat('YES')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies S1: Randomized Controlled Trial.`,
};

export default S1_RCT;

