/**
 * L1 WOLF Prompt: W3 - Healthy User Bias
 * Family: Selection (F1)
 * Answer: NO
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L1_L2, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat } from '../../shared';

export const W3_HEALTHY_USER_BIAS: PromptDefinition = {
  id: 'L1-W3',
  level: 'L1',
  validity: 'NO',
  trapType: 'W3',
  trapName: 'Healthy User Bias',
  family: 'Selection',

  description:
    'People who adopt a behavior (e.g., using a product, following advice) differ systematically from those who do not. The adopters may be more sophisticated, risk-aware, or disciplined.',

  coreChallenge:
    'Recognizing that the type of person who chooses to do X is fundamentally different from those who do not, and this difference—not X itself—explains the outcome.',

  keyQuestion: 'Are the people who chose X different in ways that independently affect Y?',

  validationChecklist: [
    'The scenario involves voluntary adoption of a behavior or product',
    'Adopters likely differ systematically from non-adopters',
    'The difference in outcomes could be due to adopter characteristics',
    'The causal claim attributes the outcome to the behavior, not the person',
  ],

  examples: [
    {
      scenario:
        'A robo-advisor platform reported that clients who enabled automatic rebalancing had 15% higher risk-adjusted returns than those who managed portfolios manually. The platform concluded that automatic rebalancing causes better investment outcomes.',
      claim: 'Automatic rebalancing causes better investment outcomes.',
      variables: {
        X: 'Enabling automatic rebalancing',
        Y: 'Higher risk-adjusted returns',
        Z: 'Investor sophistication and discipline (self-selection)',
      },
      groundTruth: 'NO',
      explanation:
        'Investors who enable automatic rebalancing are likely more financially sophisticated and disciplined. These traits independently lead to better outcomes. The rebalancing feature may not be the cause.',
      wiseRefusal:
        'NO. This is healthy user bias. Investors who proactively enable automatic rebalancing are likely more financially literate, disciplined, and engaged with their investments. These characteristics independently predict better investment outcomes. The 15% improvement may reflect investor quality, not the rebalancing feature itself.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L1 (Association) causal reasoning.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical traps
ANSWER: NO - The causal claim is NOT justified due to Healthy User Bias

TRAP: W3 - Healthy User Bias
FAMILY: Selection (F1)
DESCRIPTION: ${W3_HEALTHY_USER_BIAS.description}

CORE CHALLENGE: ${W3_HEALTHY_USER_BIAS.coreChallenge}

KEY QUESTION TO EMBED: "${W3_HEALTHY_USER_BIAS.keyQuestion}"

VALIDATION CHECKLIST:
${W3_HEALTHY_USER_BIAS.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${W3_HEALTHY_USER_BIAS.examples[0].scenario}

Claim: ${W3_HEALTHY_USER_BIAS.examples[0].claim}

Variables:
- X: ${W3_HEALTHY_USER_BIAS.examples[0].variables.X}
- Y: ${W3_HEALTHY_USER_BIAS.examples[0].variables.Y}
- Z: ${W3_HEALTHY_USER_BIAS.examples[0].variables.Z}

Ground Truth: ${W3_HEALTHY_USER_BIAS.examples[0].groundTruth}

Explanation: ${W3_HEALTHY_USER_BIAS.examples[0].explanation}

Wise Refusal: ${W3_HEALTHY_USER_BIAS.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. The scenario must involve voluntary adoption of a behavior/product
2. Adopters must plausibly differ from non-adopters in relevant ways
3. The outcome difference could be explained by adopter characteristics
4. The healthy user bias must be embedded, not explicitly labeled

${getWiseRefusalFormat('NO')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L1_L2}

Generate exactly ONE case that exemplifies W3: Healthy User Bias.`,
};

export default W3_HEALTHY_USER_BIAS;

