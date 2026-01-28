/**
 * CS372 Assignment 2 - Focused Prompt Templates for Hierarchical Generation
 *
 * Each prompt is tailored to a specific bucket in the taxonomy:
 * - L1 WOLF (NO): 10 trap types
 * - L1 SHEEP (YES): 8 evidence types
 * - L2 NO: 17 trap types
 * - L2 YES: Valid intervention claims
 * - L3: 8 families × 3 answer types
 * - AMBIGUOUS: 4 disambiguation types
 */

import {
  TrapDefinition,
  SheepDefinition,
  L3FamilyDefinition,
  AmbiguityDefinition,
  SamplingResult,
} from './assignment2-taxonomy';

// ============================================================================
// COMMON PROMPT COMPONENTS
// ============================================================================

export const DOMAIN_MARKETS = {
  name: 'Markets',
  subdomains: [
    'Asset pricing and valuation',
    'Trading strategies and market microstructure',
    'Risk management and hedging',
    'Corporate finance and M&A',
    'Monetary policy and interest rates',
    'Cryptocurrency and digital assets',
    'Behavioral finance',
    'Market efficiency and anomalies',
    'Derivatives and options pricing',
    'Portfolio optimization',
  ],
};

export function getRandomSubdomain(): string {
  const idx = Math.floor(Math.random() * DOMAIN_MARKETS.subdomains.length);
  return DOMAIN_MARKETS.subdomains[idx];
}

const SCENARIO_STRUCTURE = `
SCENARIO STRUCTURE:
- 40-80 words, 2-4 sentences
- Define X (cause/exposure), Y (outcome), and Z (confounding/mediating variable if relevant)
- Use concrete, specific details (company names, percentages, time periods)
- The trap/evidence must be embedded in the scenario, not stated explicitly
`;

const WISE_REFUSAL_FORMAT = `
WISE REFUSAL FORMAT:
- Start with the verdict: YES, NO, or AMBIGUOUS (for L1/L2) or VALID, INVALID, CONDITIONAL (for L3)
- For NO/INVALID: Identify the specific trap type and quote scenario text that reveals it
- For YES/VALID: Explain why the causal identification is sound
- For AMBIGUOUS/CONDITIONAL: State what information is missing and provide conditional answers
`;

const OUTPUT_FORMAT = `
OUTPUT FORMAT (JSON):
{
  "scenario": "...",
  "variables": { "X": "...", "Y": "...", "Z": "..." },
  "causalClaim": "Does X cause Y?",
  "groundTruth": "YES|NO|AMBIGUOUS" or "VALID|INVALID|CONDITIONAL",
  "trapType": "W1-W10 or T1-T17 or F1-F8",
  "trapSubtype": "specific subtype name",
  "hiddenQuestion": "for AMBIGUOUS/CONDITIONAL only",
  "conditionalAnswers": ["If X, then YES because...", "If Y, then NO because..."],
  "wiseRefusal": "Complete explanation with verdict, reasoning, and key evidence",
  "difficulty": "Easy|Medium|Hard",
  "explanation": "Why this scenario exemplifies this trap type"
}
`;

// ============================================================================
// L1 WOLF PROMPTS (NO cases)
// ============================================================================

export function buildL1WolfPrompt(
  trap: TrapDefinition,
  subdomain: string,
  recentScenarios: string[]
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  return `You are generating a T³ benchmark case for causal reasoning evaluation.

LEVEL: L1 (Association) - Tests whether LLMs can recognize statistical association traps
ANSWER: NO - The causal claim is NOT justified due to a statistical trap

TRAP TYPE: ${trap.id} - ${trap.name}
FAMILY: ${trap.family}
DESCRIPTION: ${trap.description}

KEY QUESTION TO EMBED: "${trap.keyQuestion}"

EXAMPLE OF THIS TRAP:
${trap.example}

VALIDATION CHECKLIST (the scenario MUST satisfy ALL):
${trap.validationChecklist.map((c) => `- ${c}`).join('\n')}

DOMAIN: Markets - ${subdomain}
${SCENARIO_STRUCTURE}

REQUIREMENTS:
1. The scenario must contain a clear X→Y causal claim
2. The trap (${trap.name}) must be present but not explicitly labeled
3. A careful reader should be able to identify why the claim fails
4. Use realistic market/finance terminology and data
${avoidList}

${WISE_REFUSAL_FORMAT}

${OUTPUT_FORMAT}

Generate exactly ONE case that exemplifies ${trap.id}: ${trap.name}.`;
}

// ============================================================================
// L1 SHEEP PROMPTS (YES cases)
// ============================================================================

export function buildL1SheepPrompt(
  sheep: SheepDefinition,
  subdomain: string,
  recentScenarios: string[]
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  return `You are generating a T³ benchmark case for causal reasoning evaluation.

LEVEL: L1 (Association) - Tests whether LLMs can recognize valid causal evidence
ANSWER: YES - The causal claim IS justified by proper evidence

EVIDENCE TYPE: ${sheep.id} - ${sheep.name}
TIER: ${sheep.tier}
DESCRIPTION: ${sheep.description}

REQUIRED ELEMENTS (scenario MUST include ALL):
${sheep.requiredElements.map((e) => `- ${e}`).join('\n')}

EXAMPLE:
${sheep.example}

DOMAIN: Markets - ${subdomain}
${SCENARIO_STRUCTURE}

REQUIREMENTS:
1. The scenario must contain a clear X→Y causal claim
2. The evidence type (${sheep.name}) must be clearly present
3. All required elements must be in the scenario
4. Use realistic market/finance terminology and data
${avoidList}

${WISE_REFUSAL_FORMAT}

${OUTPUT_FORMAT}

Generate exactly ONE case that exemplifies ${sheep.id}: ${sheep.name}.`;
}

// ============================================================================
// L2 TRAP PROMPTS (NO cases)
// ============================================================================

export function buildL2TrapPrompt(
  trap: TrapDefinition,
  subdomain: string,
  recentScenarios: string[]
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  return `You are generating a T³ benchmark case for causal reasoning evaluation.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize intervention/policy traps
ANSWER: NO - The intervention claim is NOT valid due to a causal trap

TRAP TYPE: ${trap.id} - ${trap.name}
FAMILY: ${trap.family} (${trap.familyId})
DESCRIPTION: ${trap.description}

KEY QUESTION TO EMBED: "${trap.keyQuestion}"

EXAMPLE OF THIS TRAP:
${trap.example}

VALIDATION CHECKLIST (the scenario MUST satisfy ALL):
${trap.validationChecklist.map((c) => `- ${c}`).join('\n')}

DOMAIN: Markets - ${subdomain}
${SCENARIO_STRUCTURE}

L2-SPECIFIC REQUIREMENTS:
1. The scenario must involve an INTERVENTION or POLICY (not just observation)
2. Someone is claiming "doing X will cause Y" or "X intervention caused Y"
3. The trap (${trap.name}) invalidates this intervention claim
4. Include concrete intervention details (who, what, when, how much)
${avoidList}

${WISE_REFUSAL_FORMAT}

${OUTPUT_FORMAT}

Generate exactly ONE case that exemplifies ${trap.id}: ${trap.name}.`;
}

// ============================================================================
// L2 YES PROMPTS (Valid intervention claims)
// ============================================================================

export function buildL2YesPrompt(
  subdomain: string,
  recentScenarios: string[]
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  return `You are generating a T³ benchmark case for causal reasoning evaluation.

LEVEL: L2 (Intervention) - Tests whether LLMs can recognize valid intervention evidence
ANSWER: YES - The intervention claim IS valid

VALID INTERVENTION EVIDENCE INCLUDES:
1. Randomized experiment with proper control group
2. Well-designed A/B test with random assignment
3. Natural experiment with exogenous variation
4. Regression discontinuity at policy threshold
5. Difference-in-differences with parallel trends

DOMAIN: Markets - ${subdomain}
${SCENARIO_STRUCTURE}

L2-SPECIFIC REQUIREMENTS:
1. The scenario must involve an INTERVENTION or POLICY
2. The intervention is properly randomized or quasi-experimentally identified
3. Confounders are controlled or blocked by design
4. The causal claim is supported by the evidence structure
5. Use realistic market/finance terminology
${avoidList}

${WISE_REFUSAL_FORMAT}

${OUTPUT_FORMAT}

Generate exactly ONE case where the intervention claim is VALID (YES).`;
}

// ============================================================================
// L3 PROMPTS (Counterfactual cases) - Enhanced with Section 4 Case Structure
// ============================================================================

// Illustrative examples from Appendix B of T3-L3 Guidelines
const L3_ILLUSTRATIVE_EXAMPLES = {
  VALID: `
EXAMPLE A: Deterministic (The Missed Flight) - VALID
Scenario: Alice missed her flight (X) by 5 minutes. The plane later crashed (Y). She claims: "If I had arrived on time, I would have died."
Variables: X = Arrival Time; Y = Survival; Z = Boarding rules.
Invariants:
  - Boarding rules and crash outcome are fixed.
  - Arriving on time implies boarding.
Ground Truth: VALID
Justification: Under the scenario, arriving on time implies boarding. Since the crash was fatal, boarding implies death in the alternative world.`,

  INVALID: `
EXAMPLE C: No Causal Link (The Lucky Shirt) - INVALID
Scenario: A fan wore a red shirt (X) and their team won (Y). They claim: "If I had not worn this shirt, they would have lost."
Variables: X = Shirt color; Y = Game result; Z = Player performance.
Invariants:
  - Game outcome is governed by player performance and gameplay factors.
  - Fan clothing does not affect player performance.
Ground Truth: INVALID
Justification: The outcome is causally independent of the fan's clothing choice under the stated invariants for sports outcomes.`,

  CONDITIONAL: `
EXAMPLE B: Conditional on an Unobserved Mediator (The Bitcoin Investment) - CONDITIONAL
Scenario: You did not buy Bitcoin in 2010 (X = 0). You claim: "If I had bought $100 of Bitcoin, I would be a millionaire today."
Variables: X = Purchase; Y = Wealth; Z = Selling decision (unobserved mediator).
Invariants:
  - Not specified: whether the agent holds or sells during volatility.
Ground Truth: CONDITIONAL
Justification: The outcome depends on whether the agent holds through later volatility. The scenario does not fix that invariant, so the claim is not determinable as stated.`,
};

// Key L3 concepts from Section 2
const L3_KEY_CONCEPTS = `
KEY COUNTERFACTUAL CONCEPTS:

BUT-FOR CAUSATION: X is a but-for cause of Y if Y would not have occurred but for X.
Formally: Y_{x=0} = 0 when Y_{x=1} = 1.

OVERDETERMINATION: When multiple causes each suffice for Y, removing one does not prevent Y.
Example: Two assassins act independently; removing either still results in death.

PREEMPTION: An early cause brings about Y and blocks a backup cause. The early cause is
the actual cause even though the backup would have sufficed.

INVARIANTS: Variables held fixed across worlds. Different invariant choices can yield different
counterfactual conclusions, so invariants must be stated explicitly in each case.

THE L3 PROCEDURE (Abduction):
1. Abduction: infer the relevant latent state from observed evidence
2. Action: modify the antecedent (set X←x)
3. Prediction: propagate the change under declared invariants to obtain Y_x
`;

// Answer-specific guidance from Section 4.3
const L3_ANSWER_GUIDANCE = {
  VALID: `
FOR VALID CASES:
- The claim IS supported under the stated invariants
- Changing X would change Y (or materially change the probability of Y)
- The scenario + invariants jointly pin down the relevant mechanism
- Use but-for reasoning: "Y would not have occurred but for X"
- The counterfactual is determinable without importing outside facts`,

  INVALID: `
FOR INVALID CASES:
- The claim is NOT supported under the stated invariants
- Changing X would NOT change Y due to one of:
  * Overdetermination: Multiple sufficient causes exist
  * Spurious linkage: No actual causal connection (superstition, coincidence)
  * Causal independence: X and Y are causally unrelated
  * Preemption already occurred: Early cause already brought about Y
- The scenario + invariants show the counterfactual dependence fails`,

  CONDITIONAL: `
FOR CONDITIONAL CASES:
- The scenario UNDERDETERMINES the answer
- At least two reasonable completions of missing invariants lead to DIFFERENT labels
- You MUST explicitly list the missing invariants
- You MUST provide two completions showing why the label depends on them:
  * "If [invariant A is true], then VALID because..."
  * "If [invariant B is true], then INVALID because..."
- The underdetermination should be about a key mechanism, timing, or causal structure`,
};

// L3 output format matching Section 4.1 Case Schema
const L3_OUTPUT_FORMAT = `
REQUIRED OUTPUT FORMAT (Section 4.1 Case Schema):
{
  "scenario": "World A narrative (2-5 sentences describing what actually happened)",
  "counterfactualClaim": "If [X had been different], then [Y would/would not have happened]",
  "variables": {
    "X": "The antecedent - what is hypothetically changed",
    "Y": "The consequent - the outcome in question",
    "Z": "Context/mechanism variables relevant to the causal structure"
  },
  "invariants": [
    "Bullet 1: What is held fixed across worlds",
    "Bullet 2: What is held fixed across worlds",
    "Bullet 3: (optional) What is held fixed, OR 'Not specified: [what is unknown]' for CONDITIONAL cases"
  ],
  "groundTruth": "VALID | INVALID | CONDITIONAL",
  "justification": "2-4 sentences explaining the verdict, grounded ONLY in Scenario + Invariants",
  "wiseRefusal": "Complete explanation: verdict, reasoning, key evidence from scenario",
  "hiddenQuestion": "For CONDITIONAL only: the specific question that would resolve the underdetermination",
  "conditionalAnswers": [
    "If [completion A], then VALID because [reasoning]",
    "If [completion B], then INVALID because [reasoning]"
  ],
  "trapType": "F1-F8 family ID",
  "trapSubtype": "Specific subtype from the family",
  "difficulty": "Easy | Medium | Hard",
  "explanation": "Why this case exemplifies this family's core challenge"
}
`;

export function buildL3Prompt(
  family: L3FamilyDefinition,
  answerType: string,
  subdomain: string,
  ambiguity?: AmbiguityDefinition,
  recentScenarios: string[] = []
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  const ambiguitySection = ambiguity
    ? `
AMBIGUITY FOCUS: ${ambiguity.type} - ${ambiguity.name}
${ambiguity.description}
The missing invariant should relate to: "${ambiguity.exampleQuestion}"
`
    : '';

  // Get the appropriate illustrative example
  const illustrativeExample = L3_ILLUSTRATIVE_EXAMPLES[answerType as keyof typeof L3_ILLUSTRATIVE_EXAMPLES] || '';

  // Get answer-specific guidance
  const answerGuidance = L3_ANSWER_GUIDANCE[answerType as keyof typeof L3_ANSWER_GUIDANCE] || '';

  return `You are generating a T³ benchmark case for L3 (Counterfactual) reasoning evaluation.

THE CORE L3 QUESTION: "If X had not occurred, would Y still have happened?"

LEVEL: L3 (Counterfactual) - Pearl's highest level of causal reasoning
ANSWER: ${answerType}
${L3_KEY_CONCEPTS}
================================================================================
FAMILY: ${family.id} - ${family.name}
CORE CHALLENGE: ${family.coreChallenge}
GUIDING QUESTION: "${family.guidingQuestion}"

SUBTYPES IN THIS FAMILY:
${family.subtypes.map((s) => `- ${s}`).join('\n')}

FAMILY EXAMPLE:
${family.example}

================================================================================
ILLUSTRATIVE EXAMPLE FROM T3-L3 GUIDELINES:
${illustrativeExample}

================================================================================
${answerGuidance}
${ambiguitySection}
================================================================================
DOMAIN: Markets - ${subdomain}

SCENARIO REQUIREMENTS:
- 2-5 sentences describing what ACTUALLY happened (World A)
- Define X (antecedent), Y (consequent), and Z (mechanism/context)
- Use concrete, specific details (company names, percentages, time periods)
- All information needed to judge the counterfactual must be in the scenario
- No external knowledge should be required

INVARIANTS REQUIREMENTS:
- Provide 1-3 bullets specifying what is held fixed across worlds
- For CONDITIONAL cases: explicitly state what is NOT specified
- Different invariant choices can yield different conclusions, so be explicit
${avoidList}

${L3_OUTPUT_FORMAT}

QUALITY CHECKLIST (your case MUST satisfy ALL):
☐ Self-contained: All facts needed are in the scenario
☐ Clarity: X, Y, Z, and invariants are unambiguous
☐ Correctness: Label is defensible under stated invariants only
☐ Family fit: Case tests the ${family.name} pattern
☐ Realism: Scenario is plausible in the Markets domain

Generate exactly ONE case for ${family.id}: ${family.name} with ground truth ${answerType}.`;
}

// ============================================================================
// AMBIGUOUS PROMPTS (for any level)
// ============================================================================

export function buildAmbiguousPrompt(
  pearlLevel: 'L1' | 'L2' | 'L3',
  ambiguity: AmbiguityDefinition,
  subdomain: string,
  recentScenarios: string[] = []
): string {
  const avoidList = recentScenarios.length > 0
    ? `\nAVOID these recent scenarios:\n${recentScenarios.map((s) => `- ${s.substring(0, 100)}...`).join('\n')}`
    : '';

  const levelDescription = {
    L1: 'Association - observational correlation claim',
    L2: 'Intervention - policy/intervention effect claim',
    L3: 'Counterfactual - "what if" reasoning claim',
  }[pearlLevel];

  return `You are generating a T³ benchmark case for causal reasoning evaluation.

LEVEL: ${pearlLevel} (${levelDescription})
ANSWER: AMBIGUOUS - The scenario lacks critical information needed to evaluate the claim

AMBIGUITY TYPE: ${ambiguity.type} - ${ambiguity.name}
DESCRIPTION: ${ambiguity.description}

THE HIDDEN QUESTION must be about: "${ambiguity.exampleQuestion}"
TEMPLATE: "${ambiguity.hiddenQuestionTemplate}"

DOMAIN: Markets - ${subdomain}
${SCENARIO_STRUCTURE}

AMBIGUOUS CASE REQUIREMENTS:
1. The scenario presents a causal claim that CANNOT be evaluated with given information
2. The missing information is specifically about ${ambiguity.name.toLowerCase()}
3. Include TWO conditional answers:
   - "If [condition A], then YES/VALID because..."
   - "If [condition B], then NO/INVALID because..."
4. The hidden question should be answerable and would resolve the ambiguity
5. Both conditions should be plausible given the scenario
${avoidList}

${WISE_REFUSAL_FORMAT}

AMBIGUOUS-SPECIFIC OUTPUT:
{
  "scenario": "...",
  "groundTruth": "AMBIGUOUS",
  "hiddenQuestion": "The specific question that would resolve the ambiguity",
  "conditionalAnswers": [
    "If [specific condition A], then the claim is YES/VALID because [reasoning]",
    "If [specific condition B], then the claim is NO/INVALID because [reasoning]"
  ],
  "wiseRefusal": "AMBIGUOUS - The scenario lacks information about [${ambiguity.name.toLowerCase()}]. Specifically, we need to know: [hidden question]. If [A], then YES because... If [B], then NO because...",
  ...
}

Generate exactly ONE AMBIGUOUS case with ${ambiguity.type} ambiguity.`;
}

// ============================================================================
// MAIN PROMPT BUILDER - Routes to specific prompt based on sampling result
// ============================================================================

export function buildPromptFromSample(
  sample: SamplingResult,
  subdomain: string,
  recentScenarios: string[] = []
): string {
  const { pearlLevel, answerType, trapType, sheepType, l3Family, ambiguityType } = sample;

  // L1 cases
  if (pearlLevel === 'L1') {
    if (answerType === 'NO' && trapType) {
      return buildL1WolfPrompt(trapType, subdomain, recentScenarios);
    } else if (answerType === 'YES' && sheepType) {
      return buildL1SheepPrompt(sheepType, subdomain, recentScenarios);
    } else if (answerType === 'AMBIGUOUS' && ambiguityType) {
      return buildAmbiguousPrompt('L1', ambiguityType, subdomain, recentScenarios);
    }
  }

  // L2 cases
  if (pearlLevel === 'L2') {
    if (answerType === 'NO' && trapType) {
      return buildL2TrapPrompt(trapType, subdomain, recentScenarios);
    } else if (answerType === 'YES') {
      return buildL2YesPrompt(subdomain, recentScenarios);
    } else if (answerType === 'AMBIGUOUS' && ambiguityType) {
      return buildAmbiguousPrompt('L2', ambiguityType, subdomain, recentScenarios);
    }
  }

  // L3 cases
  if (pearlLevel === 'L3' && l3Family) {
    return buildL3Prompt(l3Family, answerType, subdomain, ambiguityType, recentScenarios);
  }

  // Fallback - shouldn't happen with proper sampling
  throw new Error(`Invalid sampling result: ${JSON.stringify(sample)}`);
}

// ============================================================================
// UTILITY: Get trap type string for database storage
// ============================================================================

export function getTrapTypeString(sample: SamplingResult): string {
  if (sample.trapType) {
    return `${sample.trapType.id}:${sample.trapType.name}`;
  }
  if (sample.sheepType) {
    return `${sample.sheepType.id}:${sample.sheepType.name}`;
  }
  if (sample.l3Family) {
    return `${sample.l3Family.id}:${sample.l3Family.name}`;
  }
  if (sample.ambiguityType) {
    return `AMBIG:${sample.ambiguityType.type}`;
  }
  return 'UNKNOWN';
}

