/**
 * L3 VALID Prompt: F5 - Temporal and Path-Dependent
 * Answer: VALID - The timing-based counterfactual is supported
 */

import { PromptDefinition, ScenarioSeed } from '../../types';
import { buildSeedContext, OUTPUT_FORMAT_L3, QUALITY_CHECKLIST, REALISTIC_SCENARIO_GUIDANCE, getWiseRefusalFormat, buildL3SubtypeGuidance } from '../../shared';

// Representative subtypes for F5 (from T3-L3 Guidelines)
const F5_SUBTYPES = [
  'Path Dependence - early choices constrain later options',
  'Timing Windows - same action can succeed or fail depending on when it occurs',
  'Chain Framing - proximate vs. distal links in a causal chain',
  'Downstream Propagation - separating warranted propagation from speculation',
];

export const F5_TEMPORAL_VALID: PromptDefinition = {
  id: 'L3-F5-VALID',
  level: 'L3',
  validity: 'VALID',
  trapType: 'F5',
  trapName: 'Temporal Path-Dependent',
  family: 'Temporal/Path-Dependent',

  description:
    'Counterfactuals where sequencing, delays, windows, or accumulated history changes what can be held fixed. The trap is treating the world as memoryless.',

  coreChallenge:
    'Recognizing that temporal order and path dependence can support valid counterfactuals when timing is the key factor.',

  keyQuestion: 'Does timing or path matter?',

  validationChecklist: [
    'Timing or sequence is critical to the outcome',
    'The counterfactual changes the timing',
    'The alternative timing would have led to a different outcome',
    'Path dependence is well-defined',
  ],

  examples: [
    {
      scenario:
        'A company filed for an IPO in March 2020, just before COVID crashed markets. The IPO was withdrawn. Had they filed in November 2019 (original plan), they would have completed the offering at $30/share before the crash. They eventually IPO\'d in 2021 at $20/share.',
      claim: 'If the company had filed for IPO in November 2019 as originally planned, they would have raised 50% more capital.',
      variables: {
        X: 'Filing for IPO in November 2019 vs March 2020',
        Y: 'Capital raised (50% difference)',
        Z: 'Market timing window (closed by COVID)',
      },
      groundTruth: 'VALID',
      explanation:
        'The IPO market window closed due to COVID. Filing in November would have allowed completion before the crash at $30/share. The 2021 IPO at $20/share is 33% lower. Timing was the critical factor, and the counterfactual is valid.',
      wiseRefusal:
        'VALID. This is a temporal path-dependent counterfactual. The IPO window closed due to COVID in March 2020. Under invariants (company fundamentals, investor demand unchanged), a November 2019 filing would have completed at $30/share before the crash. The actual 2021 IPO at $20/share represents a 50% reduction in capital raised. Timing was determinative.',
    },
  ],

  buildPrompt: (seed: ScenarioSeed): string => `You are generating a T³ benchmark case for L3 (Counterfactual) causal reasoning.

LEVEL: L3 (Counterfactual) - Tests "what if" reasoning about alternate worlds
ANSWER: VALID - The counterfactual claim IS supported (timing matters)

FAMILY: F5 - Temporal and Path-Dependent
DESCRIPTION: ${F5_TEMPORAL_VALID.description}

CORE CHALLENGE: ${F5_TEMPORAL_VALID.coreChallenge}

KEY QUESTION: "${F5_TEMPORAL_VALID.keyQuestion}"

${buildL3SubtypeGuidance(F5_SUBTYPES)}

VALIDATION CHECKLIST:
${F5_TEMPORAL_VALID.validationChecklist.map((c) => `- ${c}`).join('\n')}

================================================================================
EXAMPLE CASE:

Scenario: ${F5_TEMPORAL_VALID.examples[0].scenario}

Counterfactual Claim: ${F5_TEMPORAL_VALID.examples[0].claim}

Variables:
- X: ${F5_TEMPORAL_VALID.examples[0].variables.X}
- Y: ${F5_TEMPORAL_VALID.examples[0].variables.Y}
- Z: ${F5_TEMPORAL_VALID.examples[0].variables.Z}

Ground Truth: ${F5_TEMPORAL_VALID.examples[0].groundTruth}

Explanation: ${F5_TEMPORAL_VALID.examples[0].explanation}

Wise Refusal: ${F5_TEMPORAL_VALID.examples[0].wiseRefusal}

================================================================================
${buildSeedContext(seed)}

REQUIREMENTS:
1. Timing or sequence must be critical to the outcome
2. The counterfactual must propose different timing
3. The outcome under different timing must be determinable
4. Path dependence should be clear

IMPORTANT: Frame as "If [X had occurred at a different time], then [Y would have been different]"

${getWiseRefusalFormat('VALID')}

${REALISTIC_SCENARIO_GUIDANCE}

${QUALITY_CHECKLIST}

${OUTPUT_FORMAT_L3}

Generate exactly ONE case that exemplifies F5: Temporal Path-Dependent with VALID answer.`,
};

export default F5_TEMPORAL_VALID;

