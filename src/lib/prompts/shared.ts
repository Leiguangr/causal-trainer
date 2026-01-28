/**
 * Shared prompt components used across all levels
 */

import { ScenarioSeed } from './types';

// Domain configuration
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

// Output format for L1 (Association)
// Claims are STATEMENTS, not questions: "X causes Y"
// Per revised spec: X/Y as objects with name/role, Z as array
export const OUTPUT_FORMAT_L1 = `
OUTPUT FORMAT (JSON):
{
  "scenario": "40-80 words describing the situation with specific details",
  "claim": "A causal STATEMENT (not a question): 'X causes Y' - e.g., 'Wine consumption causes reduced heart disease risk.'",
  "variables": {
    "X": { "name": "exposure/treatment variable name", "role": "exposure" },
    "Y": { "name": "outcome variable name", "role": "outcome" },
    "Z": ["confounding/mediating variable(s) - MUST be array, even if single element"]
  },
  "groundTruth": "YES | NO | AMBIGUOUS",
  "trapType": "The trap ID (W1-W10 for WOLF, S1-S8 for SHEEP, A for Ambiguous)",
  "trapSubtype": "Specific subtype name",
  "causalStructure": "Brief description of the causal graph (e.g., 'Z causes both X and Y, creating spurious correlation')",
  "keyInsight": "One-line memorable takeaway for this case",
  "hiddenTimestamp": "Question that reveals temporal/causal ordering (or 'N/A' if not applicable)",
  "conditionalAnswers": {
    "answer_if_condition_1": "If [condition A], then [answer] because [reasoning]",
    "answer_if_condition_2": "If [condition B], then [answer] because [reasoning]"
  },
  "explanation": "Why this scenario exemplifies this trap/evidence type",
  "wiseRefusal": "Complete answer with verdict, reasoning, and key evidence",
  "goldRationale": "Complete explanation of the correct reasoning",
  "difficulty": "Easy | Medium | Hard"
}

TRAP TYPE CODES:
- WOLF (NO cases): W1=Selection, W2=Survivorship, W3=Healthy User, W4=Regression, W5=Ecological, W6=Base Rate, W7=Confounding, W8=Simpson's, W9=Reverse, W10=Post Hoc
- SHEEP (YES cases): S1=RCT, S2=Natural Experiment, S3=Lottery, S4=Ablation, S5=Mechanism+Dose, S6=IV, S7=Diff-in-Diff, S8=Regression Discontinuity
- Ambiguous: A

IMPORTANT: The claim must be a STATEMENT, not a question.
- CORRECT: "The new curriculum causes improved math performance."
- WRONG: "Does the new curriculum cause improved math performance?"
`;

// Output format for L2 (Intervention)
// Claims are STATEMENTS about interventions: "Doing X causes Y" or "X intervention causes Y"
// NOTE: All L2 cases should be labeled "NO" per revised Assignment 2 spec (they are traps)
// Per revised spec: X/Y as objects with name/role, Z as array
export const OUTPUT_FORMAT_L2 = `
OUTPUT FORMAT (JSON):
{
  "scenario": "40-80 words describing the intervention situation with specific details",
  "claim": "An intervention STATEMENT (not a question): 'Doing X causes Y' or 'The X intervention causes Y' - e.g., 'Implementing the training program causes increased productivity.'",
  "variables": {
    "X": { "name": "intervention/treatment variable name", "role": "exposure" },
    "Y": { "name": "outcome variable name", "role": "outcome" },
    "Z": ["confounding/mediating variable(s) - MUST be array, even if single element"]
  },
  "groundTruth": "NO",
  "trapType": "The trap ID (T1-T17)",
  "trapSubtype": "Specific subtype name",
  "causalStructure": "Brief description of the causal graph (e.g., 'Intervention affects Z, which is correlated with Y but X does not directly cause Y')",
  "keyInsight": "One-line memorable takeaway for this case",
  "hiddenTimestamp": "Question that reveals temporal/causal ordering (or 'N/A' if not applicable)",
  "conditionalAnswers": {
    "answer_if_condition_1": "If [condition A], then [answer] because [reasoning]",
    "answer_if_condition_2": "If [condition B], then [answer] because [reasoning]"
  },
  "explanation": "Why this scenario exemplifies this trap type",
  "wiseRefusal": "Complete answer with verdict, reasoning, and key evidence",
  "goldRationale": "Complete explanation of the correct reasoning",
  "difficulty": "Easy | Medium | Hard"
}

TRAP TYPE CODES (T1-T17):
- F1 Selection: T1=Selection, T2=Survivorship, T3=Collider, T4=Immortal Time
- F2 Statistical: T5=Regression, T6=Ecological
- F3 Confounding: T7=Confounder, T8=Simpson's, T9=Conf-Med
- F4 Direction: T10=Reverse, T11=Feedback, T12=Temporal
- F5 Information: T13=Measurement, T14=Recall
- F6 Mechanism: T15=Mechanism, T16=Goodhart, T17=Backfire

IMPORTANT: L2 cases are TRAPS - the causal claim is INVALID. groundTruth should be "NO".
The claim must be a STATEMENT about an intervention, not a question.
- CORRECT: "Implementing the training program causes increased productivity."
- WRONG: "If we implement the training program, will productivity increase?"
`;

// NOTE: L2 AMBIGUOUS is NOT used per revised Assignment 2 spec.
// All L2 cases should be "NO" (traps).
// Keeping this as deprecated for reference only.
// @deprecated - Do not use. All L2 cases should use OUTPUT_FORMAT_L2 with groundTruth: "NO"
export const OUTPUT_FORMAT_L2_AMBIGUOUS = OUTPUT_FORMAT_L2;

// Legacy alias for backward compatibility
export const OUTPUT_FORMAT_L1_L2 = OUTPUT_FORMAT_L1;

// Output format for L3 (Counterfactual)
// Claims are counterfactual STATEMENTS: "If X had been different, then Y would have been different"
// Per revised spec: X/Y can be strings for L3, X' for counterfactual, Z as array
// Labels: VALID, INVALID, CONDITIONAL (not YES/NO/AMBIGUOUS)
export const OUTPUT_FORMAT_L3 = `
OUTPUT FORMAT (JSON):
{
  "scenario": "World A narrative (2-5 sentences describing what actually happened)",
  "claim": "A counterfactual STATEMENT: 'If [X had been different], then [Y would/would not have happened]' - e.g., 'If I had bought Bitcoin in 2010, I would be rich today.'",
  "variables": {
    "X": "What actually happened (the antecedent)",
    "X'": "The counterfactual alternative (what could have happened instead)",
    "Y": "The outcome in question (the consequent)",
    "Z": ["mechanism/context variable(s) that affect the counterfactual - MUST be array"]
  },
  "invariants": [
    "What is held fixed across worlds (1-3 bullets)",
    "For CONDITIONAL: include 'Not specified: [what is unknown]'"
  ],
  "groundTruth": "VALID | INVALID | CONDITIONAL",
  "trapType": "F1-F8 family ID",
  "trapSubtype": "Specific subtype from the family",
  "causalStructure": "Brief description of the counterfactual mechanism (e.g., 'X directly caused Y with no alternative paths')",
  "keyInsight": "One-line memorable takeaway for this counterfactual case",
  "hiddenTimestamp": "Question that reveals what would resolve the counterfactual (or context needed)",
  "conditionalAnswers": {
    "answer_if_condition_1": "If [condition A], then VALID because [reasoning]",
    "answer_if_condition_2": "If [condition B], then INVALID because [reasoning]"
  },
  "explanation": "Why this case exemplifies this family's core challenge",
  "wiseRefusal": "Complete explanation: verdict, reasoning, key evidence",
  "goldRationale": "Complete explanation of the correct reasoning for this counterfactual",
  "difficulty": "Easy | Medium | Hard"
}

TRAP TYPE CODES (F1-F8):
- F1=Deterministic: Clear single-cause determinism
- F2=Probabilistic: Probabilistic causation
- F3=Overdetermination: Multiple sufficient causes
- F4=Structural: DAG/structural issues
- F5=Temporal: Timing and order issues
- F6=Epistemic: Knowledge and belief issues
- F7=Attribution: Credit assignment issues
- F8=Moral/Legal: Ethical/legal responsibility

IMPORTANT:
1. The claim must be a counterfactual STATEMENT using past tense.
2. L3 labels are VALID/INVALID/CONDITIONAL (not YES/NO/AMBIGUOUS)
- CORRECT: "If the stop-loss had been set at 6%, the trader would not have lost $50,000."
- CORRECT: "If earnings had met expectations, the stock would not have dropped 30%."
- WRONG: "Would the trader have lost money if the stop-loss was different?"
`;

// Build scenario context from seed
export function buildSeedContext(seed: ScenarioSeed): string {
  const difficultySection = seed.difficulty 
    ? getDifficultyGuidance(seed.difficulty)
    : '';

  return `
SCENARIO SEED (use this as the basis for your case):
- Topic: ${seed.topic}
- Subdomain: ${seed.subdomain}
- Entities: ${seed.entities.join(', ')}
- Timeframe: ${seed.timeframe}
- Event: ${seed.event}
- Context: ${seed.context}
${seed.difficulty ? `- Target Difficulty: ${seed.difficulty}` : ''}

IMPORTANT: Build your scenario around this seed. Do NOT change the core entities or event.
${difficultySection}
`;
}

// Realistic scenario guidance for behavioral finance and market reactions
export const REALISTIC_SCENARIO_GUIDANCE = `
SCENARIO REALISM REQUIREMENTS:

Your scenarios should feel like real situations that market practitioners (traders, portfolio managers, policy makers, analysts) would encounter. Draw inspiration from REAL historical events and market phenomena:

BEHAVIORAL FINANCE & MARKET REACTIONS TO REAL-WORLD EVENTS:
- Geopolitical events: Wars, political unrest, elections, sanctions (e.g., Russia-Ukraine conflict → defense stocks, energy prices)
- Natural disasters: Hurricanes, earthquakes, pandemics (e.g., COVID-19 → Zoom, Peloton, vaccine makers)
- Policy announcements: Tariffs, interest rate decisions, regulatory changes (e.g., Trump tariffs → steel stocks, China trade)
- Corporate events: Earnings surprises, CEO changes, scandals (e.g., Enron, FTX collapse, Boeing 737 MAX)
- Technological shifts: AI announcements, product launches (e.g., ChatGPT → Nvidia, iPhone launches → Apple suppliers)
- Social phenomena: Meme stocks, social media influence (e.g., GameStop, AMC, Elon Musk tweets)

HISTORICAL EXAMPLES TO DRAW FROM (adapt, don't copy exactly):
- 2020: COVID crash and recovery, work-from-home stocks, vaccine race
- 2021: Meme stock mania, crypto boom, inflation concerns
- 2022: Fed rate hikes, tech selloff, energy crisis, FTX collapse
- 2023: AI boom (Nvidia, Microsoft), banking crisis (SVB, Credit Suisse)
- 2008: Financial crisis, Lehman Brothers, housing bubble
- 2000: Dot-com bubble burst, tech valuations
- Classic cases: Black Monday 1987, LTCM 1998, Flash Crash 2010

PRACTITIONER RELEVANCE:
Think about what questions a real market participant would ask:
- "Should I buy defense stocks given rising tensions in [region]?"
- "Will the Fed's rate decision cause a market rally or selloff?"
- "Does this company's earnings beat mean the stock will outperform?"
- "Is the correlation between [X] and [Y] causal or spurious?"

DIVERSITY REQUIREMENTS:
- Vary the asset classes: stocks, bonds, commodities, currencies, crypto, derivatives
- Vary the actors: retail traders, institutional investors, hedge funds, central banks, corporations
- Vary the timeframes: intraday, weekly, quarterly, multi-year
- Vary the regions: US, Europe, Asia, emerging markets
- Avoid repeating the same companies or events across cases
`;

// Difficulty level definitions per CS372 Assignment 2 Guidelines
// Target distribution: 1:2:1 (Easy:Medium:Hard) = 25%:50%:25%
export const DIFFICULTY_DEFINITIONS = `
DIFFICULTY LEVEL GUIDELINES:
The difficulty level should match the actual complexity of identifying the trap/flaw.
Target distribution is 1:2:1 (Easy:Medium:Hard).

**EASY (25% of cases):**
- Obvious trap that most readers would catch with basic reasoning
- Common, well-known fallacy (e.g., obvious correlation vs causation)
- Trap is explicitly mentioned or nearly explicit in the scenario
- Single, clear flaw without complicating factors
- Example: "People who carry lighters have higher lung cancer rates, therefore lighters cause cancer."

**MEDIUM (50% of cases):**
- Requires careful reading and moderate domain knowledge
- Trap is present but not immediately obvious
- May require recognizing a specific statistical or causal reasoning pattern
- Some nuance in distinguishing valid from invalid reasoning
- Example: "Hospitals with more nurses have lower mortality - but also have more resources."

**HARD (25% of cases):**
- Multiple interacting factors or subtle distinctions
- Requires expert-level domain knowledge (e.g., finance, statistics, epidemiology)
- Trap involves advanced concepts (Simpson's Paradox, Instrumental Variables, etc.)
- Easy to get fooled even with careful reading
- May involve quantitative reasoning or technical details
- Example: A case requiring understanding of collider bias in a medical context with realistic clinical details
`;

// Quality checklist
export const QUALITY_CHECKLIST = `
QUALITY CHECKLIST (your case MUST satisfy ALL):
☐ Self-contained: All facts needed are in the scenario
☐ Clarity: X, Y, Z are unambiguous and well-defined
☐ Correctness: Label is defensible; reasoning is sound
☐ Trap fit: Case clearly tests the assigned pattern
☐ Realism: Scenario is plausible and grounded in real market dynamics
☐ Specificity: Uses concrete details (names, numbers, dates, real-world context)
☐ Practitioner relevance: A trader, analyst, or policy maker would find this interesting
☐ Difficulty calibration: The claimed difficulty matches actual complexity
`;

// L3 subtype guidance - helps LLM understand the diversity within each family
export function buildL3SubtypeGuidance(subtypes: string[]): string {
  return `
REPRESENTATIVE SUBTYPES (for diversity - not exhaustive):
These are common patterns within this family. You may use one of these or create a novel variation:
${subtypes.map((s, i) => `${i + 1}. ${s}`).join('\n')}

NOTE: These subtypes are representative examples to encourage diversity, not strict requirements.
Your case should clearly fit the family's core challenge, but may introduce novel patterns not listed above.
`;
}

// Get difficulty-specific guidance for generation
export function getDifficultyGuidance(difficulty: 'Easy' | 'Medium' | 'Hard'): string {
  switch (difficulty) {
    case 'Easy':
      return `
DIFFICULTY: EASY
Generate a case where the trap/flaw is relatively obvious:
- Use a common, well-known fallacy that most readers would catch
- The flaw should be nearly explicit in the scenario
- Single, clear issue without complicating factors
- Appropriate for someone with basic critical thinking skills
`;
    case 'Medium':
      return `
DIFFICULTY: MEDIUM
Generate a case that requires careful reading:
- The trap is present but not immediately obvious
- Requires recognizing a specific statistical or causal pattern
- Some nuance in distinguishing valid from invalid reasoning
- Appropriate for someone with moderate domain knowledge
`;
    case 'Hard':
      return `
DIFFICULTY: HARD
Generate a challenging case with subtle distinctions:
- Multiple interacting factors or advanced concepts
- Requires expert-level domain knowledge
- Easy to get fooled even with careful reading
- May involve quantitative reasoning or technical details
- Appropriate for experts in the field
`;
    default:
      return '';
  }
}

// Wise refusal format by answer type
export function getWiseRefusalFormat(answerType: string): string {
  switch (answerType) {
    case 'YES':
    case 'VALID':
      return `WISE REFUSAL FORMAT:
Start with "${answerType}." Then explain:
1. Why the causal identification is sound
2. What evidence supports the causal link
3. Why alternative explanations are ruled out`;

    case 'NO':
    case 'INVALID':
      return `WISE REFUSAL FORMAT:
Start with "${answerType}." Then explain:
1. Identify the specific trap/flaw
2. Quote scenario text that reveals the problem
3. Explain why the causal claim fails`;

    case 'AMBIGUOUS':
    case 'CONDITIONAL':
      return `WISE REFUSAL FORMAT:
Start with "${answerType}." Then:
1. State what information is missing
2. Provide conditional answer A: "If [X], then YES/VALID because..."
3. Provide conditional answer B: "If [Y], then NO/INVALID because..."`;

    default:
      return '';
  }
}

