import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { CHEATSHEET_TAXONOMY, getTrapTypesForLevel, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import { formatExamplesForPrompt } from '@/lib/trap-examples';
import { PearlLevel } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Target distribution: 11% L1, 66% L2, 23% L3
const LEVEL_DISTRIBUTION = {
  L1: 0.11,
  L2: 0.66,
  L3: 0.23,
};

// Domains for systematic rotation to ensure diversity
const GENERATION_DOMAINS = ['Markets', 'Medicine', 'Law', 'Technology', 'Education'] as const;
type GenerationDomain = typeof GENERATION_DOMAINS[number];

// Subdomains for within-domain diversity (rotated through)
const DOMAIN_SUBDOMAINS: Record<GenerationDomain, string[]> = {
  Markets: [
    'cryptocurrency trading', 'forex markets', 'commodity futures', 'equity derivatives',
    'real estate investment', 'hedge fund strategies', 'retail banking', 'insurance underwriting',
    'venture capital', 'bond markets', 'algorithmic trading', 'pension funds'
  ],
  Medicine: [
    'oncology treatment', 'psychiatric care', 'epidemiology studies', 'surgical outcomes',
    'drug interactions', 'mental health interventions', 'vaccine efficacy', 'chronic disease management',
    'emergency medicine', 'pediatric care', 'geriatric health', 'preventive medicine'
  ],
  Law: [
    'tort liability', 'contract disputes', 'criminal sentencing', 'regulatory compliance',
    'intellectual property', 'employment discrimination', 'antitrust cases', 'environmental law',
    'medical malpractice', 'product liability', 'securities fraud', 'immigration policy'
  ],
  Technology: [
    'A/B testing', 'recommendation algorithms', 'cybersecurity incidents', 'cloud migration',
    'machine learning models', 'user engagement metrics', 'system reliability', 'mobile app analytics',
    'API performance', 'data pipeline optimization', 'autonomous systems', 'social media platforms'
  ],
  Education: [
    'curriculum design', 'standardized testing', 'online learning', 'tutoring interventions',
    'teacher effectiveness', 'school funding', 'early childhood education', 'college admissions',
    'vocational training', 'special education', 'STEM programs', 'educational technology'
  ],
};

// Get next domain in rotation based on index
function getRotatedDomain(index: number, fixedDomain?: string): GenerationDomain {
  if (fixedDomain && GENERATION_DOMAINS.includes(fixedDomain as GenerationDomain)) {
    return fixedDomain as GenerationDomain;
  }
  return GENERATION_DOMAINS[index % GENERATION_DOMAINS.length];
}

// Get a specific subdomain for extra diversity
function getRotatedSubdomain(domain: GenerationDomain, index: number): string {
  const subdomains = DOMAIN_SUBDOMAINS[domain];
  return subdomains[index % subdomains.length];
}

interface TrapSelection {
  pearlLevel: PearlLevel;
  trapType: string;
  trapTypeLabel: string;
  trapTypeDescription: string;
  trapSubtype: string;
  subtypeDescription: string;
  subtypeMinimalGraph?: string;
  subtypeMathSignature?: string;
  subtypeHowItHappens?: string;
}

// Select underrepresented trap type/subtype based on current distribution
async function selectNextTrap(targetLevel?: PearlLevel): Promise<TrapSelection> {
  // Get current distribution of trap types and subtypes
  const existingQuestions = await prisma.question.findMany({
    select: { pearlLevel: true, trapType: true, trapSubtype: true },
  });

  // Count by level
  const levelCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
  existingQuestions.forEach(q => {
    if (q.pearlLevel && levelCounts[q.pearlLevel] !== undefined) {
      levelCounts[q.pearlLevel]++;
    }
  });
  const totalCount = existingQuestions.length || 1;

  // Determine which level to generate for
  let selectedLevel: PearlLevel;
  if (targetLevel) {
    selectedLevel = targetLevel;
  } else {
    // Find most underrepresented level
    const levelDeficits = Object.entries(LEVEL_DISTRIBUTION).map(([level, target]) => ({
      level: level as PearlLevel,
      deficit: target - (levelCounts[level] / totalCount),
    }));
    levelDeficits.sort((a, b) => b.deficit - a.deficit);
    selectedLevel = levelDeficits[0].level;
  }

  // Get trap types valid for this level
  const validTrapTypes = getTrapTypesForLevel(selectedLevel);

  // Count existing by trap type for this level
  const trapTypeCounts: Record<string, number> = {};
  validTrapTypes.forEach(t => { trapTypeCounts[t.type] = 0; });
  existingQuestions
    .filter(q => q.pearlLevel === selectedLevel)
    .forEach(q => {
      if (q.trapType && trapTypeCounts[q.trapType] !== undefined) {
        trapTypeCounts[q.trapType]++;
      }
    });

  // Find least represented trap type (with some randomization)
  const trapTypeEntries = Object.entries(trapTypeCounts);
  trapTypeEntries.sort((a, b) => a[1] - b[1]);

  // Pick from the bottom 3 (or fewer) with weighted randomization
  const candidates = trapTypeEntries.slice(0, Math.min(3, trapTypeEntries.length));
  const weights = candidates.map((_, i) => 3 - i); // 3, 2, 1 weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let selectedTrapType = candidates[0][0];
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      selectedTrapType = candidates[i][0];
      break;
    }
  }

  const trapDef = validTrapTypes.find(t => t.type === selectedTrapType)!;

  // Get subtypes for this trap type and level
  const subtypes = getSubtypesForTypeAndLevel(selectedTrapType, selectedLevel);

  // Count existing by subtype
  const subtypeCounts: Record<string, number> = {};
  subtypes.forEach(s => { subtypeCounts[s.name] = 0; });
  existingQuestions
    .filter(q => q.pearlLevel === selectedLevel && q.trapType === selectedTrapType)
    .forEach(q => {
      if (q.trapSubtype && subtypeCounts[q.trapSubtype] !== undefined) {
        subtypeCounts[q.trapSubtype]++;
      }
    });

  // Select least represented subtype (or random if no subtypes)
  let selectedSubtype = '';
  let subtypeDescription = '';
  let subtypeMinimalGraph: string | undefined;
  let subtypeMathSignature: string | undefined;
  let subtypeHowItHappens: string | undefined;
  if (subtypes.length > 0) {
    const subtypeEntries = Object.entries(subtypeCounts);
    subtypeEntries.sort((a, b) => a[1] - b[1]);
    // Pick from bottom 2 with randomization
    const subCandidates = subtypeEntries.slice(0, Math.min(2, subtypeEntries.length));
    selectedSubtype = subCandidates[Math.floor(Math.random() * subCandidates.length)][0];
    const selectedSubtypeDef = subtypes.find(s => s.name === selectedSubtype);
    subtypeDescription = selectedSubtypeDef?.description || '';
    subtypeMinimalGraph = selectedSubtypeDef?.minimalGraph;
    subtypeMathSignature = selectedSubtypeDef?.mathSignature;
    subtypeHowItHappens = selectedSubtypeDef?.howItHappens;
  }

  return {
    pearlLevel: selectedLevel,
    trapType: selectedTrapType,
    trapTypeLabel: trapDef.label,
    trapTypeDescription: trapDef.description,
    trapSubtype: selectedSubtype,
    subtypeDescription,
    subtypeMinimalGraph,
    subtypeMathSignature,
    subtypeHowItHappens,
  };
}

/**
 * Get detailed explanation of how each trap type works
 */
function getTrapMechanism(trapType: string): string {
  const mechanisms: Record<string, string> = {
    'CONFOUNDING': `A hidden variable Z causes BOTH X and Y independently.
- Causal structure: Z → X, Z → Y (no direct X → Y link)
- The observed correlation between X and Y is spurious
- Example: Ice cream sales (X) correlate with drowning (Y) because summer heat (Z) causes both
- To identify: Look for an uncontrolled common cause that affects both variables`,

    'REVERSE': `The assumed causal direction is backwards: Y causes X, not X causes Y.
- What looks like: X → Y
- What's actually happening: Y → X (or Z → X, Z → Y)
- Example: Fire trucks (X) at fire scenes (Y) - trucks don't cause fires; fires cause truck presence
- To identify: Ask "could the outcome be driving the supposed cause?"`,

    'SELECTION': `Non-random sampling distorts the relationship between X and Y.
- Only certain cases are observed (e.g., survivors, successes, published studies)
- The sample is not representative of the full population
- Example: "MBA graduates earn more" - but only successful applicants are studied
- To identify: Ask "who is missing from this dataset?"`,

    'COLLIDER': `Conditioning on a variable Z that is caused by BOTH X and Y creates spurious correlation.
- Causal structure: X → Z ← Y (Z is a "collision" of X and Y)
- When you condition on Z, X and Y become spuriously correlated
- Example: Among admitted students (Z), test scores (X) and essays (Y) appear negatively correlated
- To identify: Is the analysis restricted to a subset defined by a common effect?`,

    'SIMPSONS': `A trend in aggregated data reverses when data is stratified by a confounding variable.
- Aggregate: X appears to help Y
- Stratified: Within each subgroup, X hurts Y (or vice versa)
- Example: Hospital A looks worse overall but better within each severity level
- To identify: Ask "are the groups being compared compositionally different?"`,

    'REGRESSION': `Extreme values tend to move toward the average on subsequent measurements.
- Selecting based on extreme performance guarantees regression toward mean
- Not a causal effect, just statistical artifact
- Example: "Sophomore slump" - rookies of year had unusually good first years
- To identify: Was selection based on extreme values of the outcome variable?`,

    'SURVIVORSHIP': `Only analyzing entities that "survived" a selection process, ignoring those that didn't.
- Failed companies, dead patients, unpublished studies are invisible
- Remaining sample is biased toward success
- Example: "Old buildings are sturdier" - no, weak old buildings already collapsed
- To identify: Ask "what happened to the failures?"`,

    'GOODHART': `When a measure becomes a target, it ceases to be a good measure.
- Optimizing a proxy metric (Z) at the expense of the true goal (Y)
- Agents game the metric rather than improving outcomes
- Example: Teaching to the test improves scores but not learning
- To identify: Is there incentive to optimize the metric independent of the goal?`,

    'FEEDBACK': `X affects Y, but Y also affects X, creating circular causation.
- Standard causal inference assumes no feedback loops
- With feedback, isolating the effect of X on Y becomes impossible
- Example: Police presence and crime rate affect each other
- To identify: Could the outcome influence future values of the treatment?`,

    'COUNTERFACTUAL': `Reasoning about what would have happened under different conditions.
- Valid when mechanism is deterministic or structurally necessary
- Invalid when counterfactual world is undefined or multiple causes exist
- Example: "If the dam hadn't been there, the flood would have destroyed the town" (valid if dam was only barrier)
- To identify: Is there a clear, isolatable mechanism connecting X to Y?`,
  };

  return mechanisms[trapType] || `This trap type involves a violation of causal assumptions. The scenario must clearly reveal the specific flaw.`;
}

type ValidityType = 'YES' | 'NO' | 'AMBIGUOUS';

function buildPrompt(
  trap: TrapSelection,
  validity: ValidityType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string
): string {
  const levelDescription = {
    L1: 'Association - Observational relationships and patterns in data. You observe correlations but cannot intervene.',
    L2: 'Intervention - Causal effects of actions and interventions. You can set/manipulate variables via do(X).',
    L3: 'Counterfactual - Reasoning about what-ifs. What would have happened if X had been different?',
  };

  // Scenario structure guidance by Pearl level
  const scenarioStructureByLevel = {
    L1: `SCENARIO STRUCTURE FOR L1 (Data-Centric):
- Focus on describing the DATA PATTERN itself
- Show observational correlations, associations, or patterns
- No actor/analyst persona required - the data speaks for itself
- The trap should be visible in the data structure (e.g., uncontrolled confounders, selected samples)`,

    L2: `SCENARIO STRUCTURE FOR L2 (Actor-Centric):
- The scenario MUST include someone who TOOK AN ACTION and MAKES A CLAIM about its effect
- This could be: an analyst, policy maker, CEO, researcher, doctor, manager, etc.
- Show: (1) what intervention they did, (2) what they observed, (3) their causal conclusion
- The trap is in their METHODOLOGY or INTERPRETATION, not just the data
- Example structure: "A [role] implemented [X]. They observed [Y] and concluded that [causal claim]."`,

    L3: `SCENARIO STRUCTURE FOR L3 (Reasoning-Centric):
- The scenario MUST include someone making a COUNTERFACTUAL CLAIM ("what if" / "had X not happened")
- This could be: an analyst, investigator, historian, policy evaluator, etc.
- Show: (1) what happened, (2) their counterfactual reasoning about alternatives
- The trap is in their COUNTERFACTUAL LOGIC (preemption, cross-world confounding, etc.)
- Example structure: "After [X happened], [role] claims that if [X had not happened], then [counterfactual Y]."`,
  };

  // Build diversity instructions based on recent scenarios
  const diversityBlock = recentScenarios.length > 0 ? `
DIVERSITY REQUIREMENTS - CRITICAL:
You MUST create a scenario that is DISTINCTLY DIFFERENT from these recent scenarios:
${recentScenarios.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join('\n')}

To ensure diversity, vary along these dimensions:
- Industry/sector: Choose a DIFFERENT specific industry than those above
- Time horizon: Mix short-term (days), medium-term (months), long-term (years) effects
- Geographic context: Vary between US, Europe, Asia, global, local contexts
- Stakeholder type: Vary who makes the claim (CEO, analyst, doctor, regulator, researcher, etc.)
- Scale: Vary between individual, company, industry, national, global scale
- Era: Consider historical, current, or emerging/future contexts
` : '';

  // Different instructions based on validity type
  if (validity === 'YES') {
    return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question where the claim IS SUPPORTED (YES).

MANDATORY SPECIFICATIONS:
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- The reasoning should AVOID common traps like ${trap.trapTypeLabel}
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain})

${scenarioStructureByLevel[trap.pearlLevel]}

SCENARIO STYLE - BE CONCISE (2-3 sentences, 40-80 words max):
Use inline variable notation (X), (Y), (Z) directly in the scenario text.

CRITICAL: Describe ONLY observable behaviors and outcomes. NEVER describe intentions, motivations, or mental states.
- BAD: "Brokers engage in excessive trading merely to meet targets rather than to make profitable investments"
- GOOD: "Brokers engage in excessive trading (Z). Trading volume increased 300% while profit per trade decreased 50%."
The reader should infer the trap from observable patterns, not from stated intentions.

GOOD EXAMPLE (L2, YES):
"A randomized controlled trial assigned 500 patients to receive Drug X or placebo. After 12 weeks, Drug X patients (X) showed 40% greater improvement in symptoms (Y) compared to placebo, with proper blinding and no dropouts."

GOOD EXAMPLE (L3, YES - note the EXPLICIT structural assumption):
"ASSUME the only factor affecting this stock's price is the discount rate used in valuation models. The Federal Reserve raised interest rates by 2% (X). The stock fell 30% (Y). Claim: Had the Fed held rates steady, the stock would not have fallen."
[VALID because the scenario EXPLICITLY states a structural assumption that overrides real-world complexity]

GOOD EXAMPLE (L3, YES - with MODEL VALIDATION + EXTERNAL VALIDITY):
"A currency analyst used a DSGE model (Z) calibrated on 30 years of Fed decisions, validated on 10 out-of-sample rate changes with 90% directional accuracy. The model assumes interest rate differentials directly drive capital flows. Simulating the counterfactual, USD/EUR would have remained stable without the rate hike (X). Claim: Had the Fed not raised rates, USD/EUR (Y) would have remained stable."
[VALID because: (1) Model validated with out-of-sample accuracy, (2) Explicit mechanism stated, (3) Counterfactual derived from validated structural model]

BAD EXAMPLE #1 (L3, YES - REJECTED: method assertion without validation):
"A currency analyst built a model and simulated alternative scenarios where the rate hike did not occur, showing the USD/EUR exchange rate would have remained stable."
[REJECTED - Just saying "built a model" and "simulated" is NOT enough. Where is the model validation? What are the structural assumptions? Why should we trust this simulation? This should be AMBIGUOUS.]

BAD EXAMPLE #2 (L3, YES - REJECTED: no structural assumption):
"The Federal Reserve raised interest rates (X). Tech stocks fell 30% (Y). Claim: Had rates been steady, stocks would have rallied."
[REJECTED - Nothing in the scenario tells us what would happen in the counterfactual world. This should be AMBIGUOUS.]

FOR L3 YES - MANDATORY VALIDATION LANGUAGE (include at least 2):
- "validated on N out-of-sample predictions with X% accuracy"
- "calibrated against N years of historical data"
- "the structural equations assume [explicit mechanism]"
- "meta-analysis of N studies across M contexts found consistent effects"
- "replicated across diverse populations including [list]"
- "field experiment in real-world conditions showed [result]"

BAD EXAMPLE (too long):
"In a groundbreaking study conducted by researchers at Stanford University in collaboration with major pharmaceutical companies, a comprehensive randomized controlled trial was designed to evaluate the efficacy of a novel treatment approach..." [too much narrative padding]

GROUND TRUTH LABEL RULES:
| Label     | Definition                                                                                      | Trap Type |
|-----------|------------------------------------------------------------------------------------------------|-----------|
| YES       | The claim is supported as stated by the given scenario under the appropriate Pearl level.       | NONE      |
| NO        | The claim is invalid as stated due to a violated causal or statistical assumption.              | Exactly 1 |
| AMBIGUOUS | The claim cannot be definitively evaluated given the available information.                     | NONE      |

CRITICAL EPISTEMOLOGICAL RULE:
The claim's validity is determined ONLY from information EXPLICITLY stated in the scenario.
Do NOT use external domain knowledge to fill in gaps.
If evaluating the claim requires knowledge not in the scenario, the answer is AMBIGUOUS, not YES.

CLAIM LANGUAGE MUST MATCH PEARL LEVEL:
- L1 (Association): Use "is associated with", "is correlated with", "predicts" - NO causal language
- L2 (Intervention): Use "causes", "leads to", "increases/decreases" - causal language OK
- L3 (Counterfactual): Use "would have", "had X not occurred" - counterfactual language

FOR YES CASES - STRICT REQUIREMENTS BY PEARL LEVEL:
- L1 (Association): Scenario shows a valid observed correlation with sufficient sample/context
- L2 (Intervention): Scenario MUST explicitly describe proper causal identification:
  * RCT with explicit randomization and control group
  * Quasi-experiment with SPECIFIC design details (diff-in-diff, regression discontinuity, IV)
  * Natural experiment with clearly identified exogenous variation
  WITHOUT explicit method details, L2 should be AMBIGUOUS, not YES.
- L3 (Counterfactual): THIS IS THE HARDEST LEVEL. Scenario MUST include ALL of:
  1. VALIDATED MODEL: Not just "built a model" but HOW it was validated:
     - "validated on N out-of-sample cases with X% accuracy"
     - "calibrated against N years of data"
     - "replicated across N independent studies"
  2. EXPLICIT MECHANISM: State the structural assumption:
     - "the model assumes X directly causes Y with no confounders"
     - "the structural equations specify [mechanism]"
  3. EXTERNAL VALIDITY: Why this applies beyond the specific study:
     - "tested across diverse populations/conditions"
     - "meta-analysis of N studies"
     - "field experiment in real-world settings"

  ⚠️ CRITICAL: "Analyst built a model and simulated X" is NOT sufficient for YES.
  If any of the 3 requirements above are missing, the scenario should be AMBIGUOUS, not YES.

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${diversityBlock}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. Get straight to the causal pattern.",
  "claim": "The specific claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "NONE",
    "trapSubtype": "NONE",
    "difficulty": "easy or medium or hard",
    "causalStructure": "Causal diagram edges only, e.g. 'X -> Y' or 'Z -> X, Z -> Y'. No descriptions.",
    "keyInsight": "One-line key takeaway about why this reasoning is sound"
  },
  "groundTruth": "YES",
  "explanation": "Explanation (50-100 words) of why the claim IS supported based ONLY on scenario information.",
  "wiseRefusal": "Complete answer starting with 'YES - the claim is supported.' followed by clear reasoning about why the causal identification is sound."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
  }

  if (validity === 'AMBIGUOUS') {
    return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question where the claim is AMBIGUOUS.

MANDATORY SPECIFICATIONS:
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain})

${scenarioStructureByLevel[trap.pearlLevel]}

SCENARIO STYLE - BE CONCISE (2-3 sentences, 40-80 words max):
Use inline variable notation (X), (Y), (Z) directly in the scenario text.

CRITICAL: Describe ONLY observable behaviors and outcomes. NEVER describe intentions, motivations, or mental states.
- BAD: "Brokers engage in excessive trading merely to meet targets rather than to make profitable investments"
- GOOD: "Brokers engage in excessive trading (Z). Trading volume increased 300% while profit per trade decreased 50%."
The reader should infer the trap from observable patterns, not from stated intentions.

GOOD EXAMPLE (AMBIGUOUS with hidden timestamp):
"Electric Vehicle sales (Y) surged in Q3. The government launched a $7,500 tax credit (X). Gasoline prices (Z) hit $5.00/gallon during the same quarter."
[AMBIGUOUS because: timing unclear - did gas spike before or after credit? Cannot determine primary driver.]

GOOD EXAMPLE (AMBIGUOUS with missing mechanism):
"Company A went public during a bear market (X) and raised $100M (Y). CFO claims waiting for a bull market would have raised $200M."
[AMBIGUOUS because: direction likely true but specific magnitude is speculative.]

GROUND TRUTH LABEL RULES:
| Label     | Definition                                                                                      | Trap Type |
|-----------|------------------------------------------------------------------------------------------------|-----------|
| YES       | The claim is supported as stated by the given scenario under the appropriate Pearl level.       | NONE      |
| NO        | The claim is invalid as stated due to a violated causal or statistical assumption.              | Exactly 1 |
| AMBIGUOUS | The claim cannot be definitively evaluated given the available information.                     | NONE      |

CRITICAL DISTINCTION - AMBIGUOUS vs NO:
- NO: The scenario EXPLICITLY reveals a causal flaw. A reader can point to specific text showing the problem.
- AMBIGUOUS: The scenario does NOT provide enough information. Key details are MISSING.

KEY PRINCIPLE: If the scenario mentions a potential problem (confounder, selection issue), that's NO, not AMBIGUOUS.
AMBIGUOUS means we genuinely cannot tell - the scenario is silent on key details like timing, mechanism, or magnitude.

FOR AMBIGUOUS CASES, the scenario should be MISSING key information:
- No timing information (which came first?)
- No mechanism details (how would this work?)
- Speculative quantification (direction may be right but magnitude uncertain)
- Multiple plausible explanations with no way to distinguish

SPECIAL CASE - L3 (Counterfactual) AMBIGUOUS:
L3 AMBIGUOUS scenarios should NOT just be "we don't know" - they should include A STUDY OR METHOD that was used to make the counterfactual claim, but with UNSTATED ASSUMPTIONS about the approach's validity.

The ambiguity should be about WHETHER THE METHOD SUPPORTS THE CLAIM, not just missing facts.

GOOD L3 AMBIGUOUS EXAMPLE:
"A research team used a synthetic control method (Z) to estimate what GDP (Y) would have been without the stimulus (X). They constructed a counterfactual from donor economies with similar pre-treatment trends. The study concludes stimulus added 2% GDP growth. Claim: Had stimulus not been implemented, GDP would have been 2% lower."
[AMBIGUOUS because: The synthetic control method was used, but we don't know if the donor pool was adequate, if there were parallel shocks, or if the pre-treatment fit was good. The APPROACH validity is unclear, not the facts.]

BAD L3 AMBIGUOUS EXAMPLE (too shallow):
"The Federal Reserve raised interest rates (X). Tech stocks fell 30% (Y). Claim: Had the Fed held rates steady, stocks would have rallied."
[BAD because: No study or method is mentioned. This is just "we don't know" - doesn't help train on counterfactual validity.]

FOR L3 AMBIGUOUS, the scenario MUST include:
- A study, analysis, or method used to support the counterfactual claim
- Enough detail that a reviewer can ask "what assumption would need to hold for this to be valid?"
- The unstated assumptions should relate to external validity (transportability, sample diversity, field conditions)

CLAIM LANGUAGE MUST MATCH PEARL LEVEL:
- L1 (Association): Use "is associated with", "is correlated with", "predicts"
- L2 (Intervention): Use "causes", "leads to", "increases/decreases"
- L3 (Counterfactual): Use "would have", "had X not occurred"

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${diversityBlock}

AMBIGUOUS CASES REQUIRE TWO ADDITIONAL FIELDS:
1. "hiddenTimestamp": A question that would reveal temporal/causal ordering to disambiguate the case.
   Example: "Did sales lag throughout the quarter (tX effect), or only during the storm window (tZ effect)?"
2. "conditionalAnswers": JSON object with "Answer if..." sections for different scenarios.
   Example: {
     "ifScenarioA": "Answer if tZ dominates (storm drove results): The storm (Z) prevented shoppers...",
     "ifScenarioB": "Answer if tX dominates (sales lagged before storm): Sales were bad (Y) due to mix (X)..."
   }

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. Present facts without enough info to determine validity.",
  "claim": "The claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": "Ambiguous variable (timing unclear, role uncertain)"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "NONE",
    "trapSubtype": "NONE",
    "difficulty": "medium or hard",
    "keyInsight": "One-line key takeaway about what information is missing"
  },
  "groundTruth": "AMBIGUOUS",
  "explanation": "Explanation (50-100 words) of what information is MISSING and why we cannot definitively evaluate the claim.",
  "wiseRefusal": "Complete answer starting with 'AMBIGUOUS - cannot definitively evaluate.' followed by clear reasoning about what information is missing and what would be needed to resolve it.",
  "hiddenTimestamp": "A question that reveals temporal/causal ordering needed to resolve ambiguity.",
  "conditionalAnswers": {
    "ifScenarioA": "Answer if [condition A]: [reasoning under that assumption]...",
    "ifScenarioB": "Answer if [condition B]: [reasoning under that assumption]..."
  }
}

Generate the question now. Return ONLY valid JSON, no other text.`;
  }

  // Default: NO case with trap
  return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question where the claim is INVALID (NO).

MANDATORY SPECIFICATIONS (you MUST follow these exactly):
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- Trap Type: ${trap.trapTypeLabel} (${trap.trapType})
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain})

${scenarioStructureByLevel[trap.pearlLevel]}

=== TRAP DEFINITION: ${trap.trapTypeLabel.toUpperCase()} ===
${trap.trapTypeDescription}
${trap.trapSubtype ? `
**Subtype**: ${trap.trapSubtype.replace(/_/g, ' ')}
**Definition**: ${trap.subtypeDescription}
${trap.subtypeMinimalGraph ? `**Causal Graph**: ${trap.subtypeMinimalGraph}` : ''}
${trap.subtypeMathSignature ? `**What Goes Wrong**: ${trap.subtypeMathSignature}` : ''}
${trap.subtypeHowItHappens ? `**Practical Example**: ${trap.subtypeHowItHappens}` : ''}
` : ''}
HOW THIS TRAP WORKS:
${getTrapMechanism(trap.trapType)}

=== END TRAP DEFINITION ===

SCENARIO STYLE - BE CONCISE (2-3 sentences, 40-80 words max):
Use inline variable notation (X), (Y), (Z) directly in the scenario text.

CRITICAL: Describe ONLY observable behaviors and outcomes. NEVER describe intentions, motivations, or mental states.
- BAD: "Brokers engage in excessive trading merely to meet targets rather than to make profitable investments"
- GOOD: "Brokers engage in excessive trading (Z). Trading volume increased 300% while profit per trade decreased 50%."
The reader should infer the trap from observable patterns, not from stated intentions.

CRITICAL: Variables X, Y, and Z must be DISTINCT concepts. X and Z should NOT overlap or describe the same thing.
- BAD: X = "Trading compliance", Z = "Compliance with strategy" (these are the same!)
- GOOD: X = "Trading strategy used", Y = "Profits", Z = "Survived 10+ years (Collider)"

${formatExamplesForPrompt(trap.trapType) || `GOOD EXAMPLE (L1, REVERSE CAUSATION):
"Historical data suggests that when small 'odd lot' retail investors buy heavily (X), the market tops out and crashes (Y). A trader sees retail buying surge and sells immediately."
Variables: X = Retail Buying, Y = Market Crash, Z = Late-Cycle Euphoria (Latent Cause)
Causal Structure: Z → X and Z → Y`}

BAD EXAMPLE (too long):
"In a comprehensive study conducted by researchers at a prestigious university, examining the relationship between environmental sustainability initiatives and corporate financial performance over a multi-year period spanning from 2015 to 2022..." [too much narrative padding - get to the point!]

GROUND TRUTH LABEL RULES:
| Label     | Definition                                                                                      | Trap Type |
|-----------|------------------------------------------------------------------------------------------------|-----------|
| YES       | The claim is supported as stated by the given scenario under the appropriate Pearl level.       | NONE      |
| NO        | The claim is invalid as stated due to a violated causal or statistical assumption.              | Exactly 1 |
| AMBIGUOUS | The claim cannot be definitively evaluate given the available information.                     | NONE      |

CRITICAL DISTINCTION - NO vs AMBIGUOUS:
- NO: The scenario EXPLICITLY reveals a causal flaw. The reader can point to specific text showing the problem.
- AMBIGUOUS: The scenario does NOT provide enough information. We cannot identify a specific flaw.

KEY PRINCIPLE: For NO, the trap MUST be identifiable from scenario text. The reader should be able to quote the problematic part.

FOR NO CASES, the scenario MUST EXPLICITLY reveal the trap (in 2-3 sentences):
- CONFOUNDING: State an uncontrolled variable affects both X and Y
- SURVIVORSHIP: State only surviving/current entities were studied
- SELECTION: State how the sample was non-randomly selected
- REVERSE: Show that Y (or its causes) influence X
- COLLIDER: Show conditioning on a common effect
- SIMPSON'S: Show aggregation reversal
- REGRESSION: Show extreme group selection

CLAIM LANGUAGE MUST MATCH PEARL LEVEL:
- L1 (Association): Use "is associated with", "is correlated with", "predicts"
- L2 (Intervention): Use "causes", "leads to", "increases/decreases"
- L3 (Counterfactual): Use "would have", "had X not occurred"

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${diversityBlock}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. EXPLICITLY reveal the trap.",
  "claim": "The claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": "Confounder/Mediator/Collider that causes the trap (describe role: Latent Cause, Confounder, Condition, Context, etc.)"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "${trap.trapType}",
    "trapSubtype": "${trap.trapSubtype || 'NONE'}",
    "difficulty": "easy or medium or hard",
    "causalStructure": "Causal diagram edges only, e.g. 'Z -> X, Z -> Y'. No descriptions.",
    "keyInsight": "One-line key takeaway"
  },
  "groundTruth": "NO",
  "explanation": "Explanation (50-100 words) citing SPECIFIC text from scenario that reveals the ${trap.trapTypeLabel} trap.",
  "wiseRefusal": "Complete answer starting with 'NO - the claim is invalid.' followed by clear reasoning about the ${trap.trapTypeLabel} trap."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
}

// Distribution matrix: specify exact counts for each Pearl level × validity combination
interface DistributionMatrix {
  L1?: { yes?: number; no?: number; ambiguous?: number };
  L2?: { yes?: number; no?: number; ambiguous?: number };
  L3?: { yes?: number; no?: number; ambiguous?: number };
}

interface GenerateRequest {
  pearlLevel?: string;
  domain?: string;
  batchSize: number;
  promptNotes?: string;
  dataset?: string;  // Dataset identifier for grouping questions
  validityMix?: {
    yes: number;        // percentage of YES cases (0-100)
    no: number;         // percentage of NO cases (0-100)
    ambiguous: number;  // percentage of AMBIGUOUS cases (0-100)
  };
  // New: specify exact distribution across Pearl levels and validity types
  // If provided, batchSize and validityMix are ignored
  distributionMatrix?: DistributionMatrix;
}

// A single generation task with specific pearl level and validity
interface GenerationTask {
  pearlLevel: PearlLevel;
  validity: ValidityType;
}

interface GeneratedQuestion {
  scenario: string;
  claim: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
    [key: string]: string | undefined;
  };
  annotations: {
    pearlLevel: string;
    domain: string;
    subdomain: string;
    trapType: string;
    trapSubtype: string;
    difficulty: string;
    causalStructure?: string; // Optional - not used for AMBIGUOUS
    keyInsight: string;
  };
  groundTruth: string;
  explanation: string;
  wiseRefusal: string;
  // AMBIGUOUS-specific fields
  hiddenTimestamp?: string;
  conditionalAnswers?: Record<string, string>;
}

// Helper to select validity type based on mix percentages
function selectValidity(
  validityMix: { yes: number; no: number; ambiguous: number },
  index: number,
  total: number
): ValidityType {
  // Calculate how many of each type we need
  const yesCount = Math.round((validityMix.yes / 100) * total);
  const noCount = Math.round((validityMix.no / 100) * total);
  // Rest goes to ambiguous

  if (index < yesCount) return 'YES';
  if (index < yesCount + noCount) return 'NO';
  return 'AMBIGUOUS';
}

// Expand distribution matrix into a list of generation tasks
function expandDistributionMatrix(matrix: DistributionMatrix): GenerationTask[] {
  const tasks: GenerationTask[] = [];
  const levels: PearlLevel[] = ['L1', 'L2', 'L3'];
  const validities: ValidityType[] = ['YES', 'NO', 'AMBIGUOUS'];

  for (const level of levels) {
    const levelConfig = matrix[level];
    if (!levelConfig) continue;

    for (const validity of validities) {
      const key = validity.toLowerCase() as 'yes' | 'no' | 'ambiguous';
      const count = levelConfig[key] || 0;
      for (let i = 0; i < count; i++) {
        tasks.push({ pearlLevel: level, validity });
      }
    }
  }

  // Shuffle tasks to randomize generation order
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  return tasks;
}

// Background generation function - runs detached from the request
async function runBackgroundGeneration(
  batchId: string,
  batchSize: number,
  pearlLevel: string | undefined,
  fixedDomain: string | undefined,
  promptNotes: string | undefined,
  initialScenarios: string[],
  validityMix: { yes: number; no: number; ambiguous: number },
  dataset: string,
  tasks?: GenerationTask[]  // Optional: explicit task list from distribution matrix
) {
  const totalTasks = tasks?.length || batchSize;
  if (tasks) {
    console.log(`[Batch ${batchId}] Starting matrix-based generation of ${totalTasks} questions`);
  } else {
    console.log(`[Batch ${batchId}] Starting background generation of ${batchSize} questions (mix: ${validityMix.yes}% YES, ${validityMix.no}% NO, ${validityMix.ambiguous}% AMBIGUOUS)`);
  }

  try {
    // Mark as running
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: { status: 'running', currentIndex: 0 },
    });

    let successCount = 0;
    let errorCount = 0;

    // Track recent scenarios for diversity (dynamically updated during batch)
    // Keep last 20 scenarios: 10 from DB + up to 10 from current batch
    const recentScenarios: string[] = [...initialScenarios.slice(0, 10)];

    // If not using explicit tasks, shuffle indices to randomize validity distribution
    let indices: number[] = [];
    if (!tasks) {
      indices = Array.from({ length: batchSize }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }

    for (let i = 0; i < totalTasks; i++) {
      // Check if batch was cancelled
      const currentBatch = await prisma.generationBatch.findUnique({
        where: { id: batchId },
        select: { status: true },
      });
      if (currentBatch?.status === 'cancelled') {
        console.log(`[Batch ${batchId}] Cancelled by user at ${i + 1}/${totalTasks}`);
        break;
      }

      // Update current index
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: { currentIndex: i + 1 },
      });

      // Determine validity and pearl level for this iteration
      let validity: ValidityType;
      let taskPearlLevel: PearlLevel | undefined;

      if (tasks) {
        // Use explicit task
        validity = tasks[i].validity;
        taskPearlLevel = tasks[i].pearlLevel;
      } else {
        // Use validity mix (old behavior)
        validity = selectValidity(validityMix, indices[i], batchSize);
        taskPearlLevel = pearlLevel as PearlLevel | undefined;
      }

      // Select trap type/subtype based on current distribution
      const trap = await selectNextTrap(taskPearlLevel);

      // Use domain rotation for diversity (unless a fixed domain was specified)
      const currentDomain = getRotatedDomain(i, fixedDomain);
      // Also rotate through subdomains within the domain for extra diversity
      const currentSubdomain = getRotatedSubdomain(currentDomain, i);

      console.log(`[Batch ${batchId}] Generating ${i + 1}/${batchSize}: ${validity} - ${trap.pearlLevel} - ${trap.trapType} - ${trap.trapSubtype || 'No subtype'} - ${currentDomain}/${currentSubdomain}`);

      const prompt = buildPrompt(trap, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes);

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert in causal reasoning and Pearl's Causality Hierarchy. You specialize in generating training questions about causal traps and biases. Follow the specifications EXACTLY - the trap type and subtype are mandatory requirements, not suggestions.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.85,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0].message.content;
        if (!content) {
          errorCount++;
          continue;
        }

        const generated: GeneratedQuestion = JSON.parse(content);

        // Validate: Check for duplicate/overlapping variables
        const varValues = Object.values(generated.variables || {}).map(v =>
          String(v).toLowerCase().replace(/[^a-z]/g, '')
        );
        const uniqueVars = new Set(varValues);
        if (varValues.length > uniqueVars.size) {
          console.log(`[Batch ${batchId}] Skipping: duplicate variable definitions - ${JSON.stringify(generated.variables)}`);
          errorCount++;
          continue;
        }

        // Validate: Check if X and Z are too similar (common LLM error)
        if (generated.variables?.X && generated.variables?.Z) {
          const xWords = String(generated.variables.X).toLowerCase().split(/\s+/);
          const zWords = String(generated.variables.Z).toLowerCase().split(/\s+/);
          const commonWords = xWords.filter(w => w.length > 3 && zWords.includes(w));
          if (commonWords.length >= 2) {
            console.log(`[Batch ${batchId}] Skipping: X and Z too similar - X="${generated.variables.X}", Z="${generated.variables.Z}"`);
            errorCount++;
            continue;
          }
        }

        // Get the next case ID
        const lastQuestion = await prisma.question.findFirst({
          where: { sourceCase: { startsWith: 'G.' } },
          orderBy: { sourceCase: 'desc' },
        });

        const nextCaseNumber = lastQuestion?.sourceCase
          ? parseInt(lastQuestion.sourceCase.split('.')[1] || '0') + 1
          : 1;
        const caseId = `G.${nextCaseNumber}`;

        // For YES and AMBIGUOUS cases, trapType should be NONE
        // For NO cases, use the requested trap type (override LLM if it deviated)
        let finalTrapType: string;
        let finalTrapSubtype: string;

        if (validity === 'YES' || validity === 'AMBIGUOUS') {
          // No trap for valid or ambiguous claims
          finalTrapType = 'NONE';
          finalTrapSubtype = 'NONE';
        } else {
          // For NO cases, enforce the requested trap type
          finalTrapType = trap.trapType;
          finalTrapSubtype = trap.trapSubtype || 'NONE';
        }

        // For AMBIGUOUS cases, don't include causalStructure (it doesn't make sense)
        // and include the new AMBIGUOUS-specific fields
        const isAmbiguous = generated.groundTruth === 'AMBIGUOUS';

        // Create question in database
        await prisma.question.create({
          data: {
            scenario: generated.scenario,
            claim: generated.claim,
            pearlLevel: trap.pearlLevel,
            domain: generated.annotations.domain,
            subdomain: generated.annotations.subdomain,
            trapType: finalTrapType,
            trapSubtype: finalTrapSubtype || 'NONE',
            explanation: generated.explanation,
            difficulty: generated.annotations.difficulty?.toLowerCase() || 'medium',
            groundTruth: generated.groundTruth,
            variables: JSON.stringify(generated.variables),
            // No causalStructure for AMBIGUOUS cases
            causalStructure: isAmbiguous ? null : generated.annotations.causalStructure,
            keyInsight: generated.annotations.keyInsight,
            wiseRefusal: generated.wiseRefusal,
            // AMBIGUOUS-specific fields
            hiddenTimestamp: isAmbiguous ? (generated.hiddenTimestamp || 'TBD') : 'N/A',
            conditionalAnswers: isAmbiguous
              ? (generated.conditionalAnswers ? JSON.stringify(generated.conditionalAnswers) : 'TBD')
              : 'N/A',
            author: 'LLM',
            sourceCase: caseId,
            isLLMGenerated: true,
            isVerified: false,
            generationBatchId: batchId,
            dataset: dataset,
          },
        });

        successCount++;

        // Update generated count
        await prisma.generationBatch.update({
          where: { id: batchId },
          data: { generatedCount: successCount },
        });

        // Add to recent scenarios for diversity tracking (keep last 20)
        recentScenarios.unshift(generated.scenario);
        if (recentScenarios.length > 20) {
          recentScenarios.pop();
        }

      } catch (error) {
        console.error(`[Batch ${batchId}] Error generating question ${i + 1}:`, error);
        errorCount++;
      }
    }

    // Check final status (may have been cancelled)
    const finalBatch = await prisma.generationBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    });

    if (finalBatch?.status === 'cancelled') {
      // Just update the generated count, keep cancelled status
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: { generatedCount: successCount },
      });
      console.log(`[Batch ${batchId}] Cancelled: ${successCount} generated before cancellation`);
    } else {
      // Mark as completed
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          generatedCount: successCount,
        },
      });
      console.log(`[Batch ${batchId}] Completed: ${successCount} generated, ${errorCount} errors`);
    }

  } catch (error) {
    console.error(`[Batch ${batchId}] Fatal error:`, error);
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { pearlLevel, domain, batchSize, promptNotes, validityMix, dataset, distributionMatrix } = body;

    console.log('Generate request body:', JSON.stringify(body));

    // If distributionMatrix is provided, use it instead of batchSize + validityMix
    let tasks: GenerationTask[] | undefined;
    let effectiveSize: number;
    let matrixSummary = '';

    if (distributionMatrix) {
      tasks = expandDistributionMatrix(distributionMatrix);
      effectiveSize = tasks.length;

      if (effectiveSize === 0) {
        return NextResponse.json({ error: 'Distribution matrix results in 0 questions. Check your configuration.' }, { status: 400 });
      }

      if (effectiveSize > 500) {
        return NextResponse.json({ error: 'Distribution matrix exceeds 500 questions. Please reduce counts.' }, { status: 400 });
      }

      // Build summary for logging
      const summaryParts: string[] = [];
      for (const level of ['L1', 'L2', 'L3'] as const) {
        const cfg = distributionMatrix[level];
        if (cfg) {
          const counts = [];
          if (cfg.yes) counts.push(`${cfg.yes} YES`);
          if (cfg.no) counts.push(`${cfg.no} NO`);
          if (cfg.ambiguous) counts.push(`${cfg.ambiguous} AMB`);
          if (counts.length > 0) {
            summaryParts.push(`${level}: ${counts.join(', ')}`);
          }
        }
      }
      matrixSummary = summaryParts.join(' | ');
      console.log(`Distribution matrix: ${matrixSummary} (total: ${effectiveSize})`);
    } else {
      // Original behavior: use batchSize
      const size = typeof batchSize === 'number' ? batchSize : parseInt(String(batchSize), 10);
      if (!size || isNaN(size) || size < 1 || size > 200) {
        console.log('Invalid batch size:', batchSize, 'parsed as:', size);
        return NextResponse.json({ error: 'Batch size must be between 1 and 200' }, { status: 400 });
      }
      effectiveSize = size;
    }

    // Use provided dataset name or default
    const datasetName = dataset?.trim() || 'default';

    // Default validity mix: 30% YES, 50% NO, 20% AMBIGUOUS (only used if no matrix)
    const mix = validityMix || { yes: 30, no: 50, ambiguous: 20 };
    // Normalize percentages to sum to 100
    const total = mix.yes + mix.no + mix.ambiguous;
    if (total !== 100) {
      const scale = 100 / total;
      mix.yes = Math.round(mix.yes * scale);
      mix.no = Math.round(mix.no * scale);
      mix.ambiguous = 100 - mix.yes - mix.no;
    }

    // Get existing scenarios to seed diversity tracking (full scenarios, not truncated)
    const existingScenarios = await prisma.question.findMany({
      where: { dataset: datasetName },
      select: { scenario: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Pass full scenarios as array for better diversity matching
    const initialScenarios = existingScenarios.map(q => q.scenario);

    // Create generation batch record
    const batch = await prisma.generationBatch.create({
      data: {
        pearlLevel: distributionMatrix ? 'MATRIX' : (pearlLevel || null),
        domain: domain || null,
        requestedCount: effectiveSize,
        generatedCount: 0,
        status: 'pending',
        currentIndex: 0,
        promptNotes: distributionMatrix ? `Matrix: ${matrixSummary}` : (promptNotes || null),
        createdById: null,
      },
    });

    // Start background generation (fire and forget)
    // Using setImmediate to detach from the request lifecycle
    setImmediate(() => {
      runBackgroundGeneration(
        batch.id,
        effectiveSize,
        pearlLevel,
        domain,
        promptNotes,
        initialScenarios,
        mix,
        datasetName,
        tasks  // Pass tasks if using distribution matrix
      ).catch(err => {
        console.error(`[Batch ${batch.id}] Unhandled error:`, err);
      });
    });

    // Return immediately with batch ID
    const message = distributionMatrix
      ? `Matrix generation started for ${effectiveSize} questions in dataset "${datasetName}" (${matrixSummary}). Poll /api/admin/generate/${batch.id}/status for progress.`
      : `Generation started for ${effectiveSize} questions in dataset "${datasetName}" (${mix.yes}% YES, ${mix.no}% NO, ${mix.ambiguous}% AMBIGUOUS). Poll /api/admin/generate/${batch.id}/status for progress.`;

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      dataset: datasetName,
      status: 'pending',
      totalQuestions: effectiveSize,
      distributionMatrix: distributionMatrix || null,
      message,
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

