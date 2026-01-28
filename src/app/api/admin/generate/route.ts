import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { CHEATSHEET_TAXONOMY, getTrapTypesForLevel, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import { formatExamplesForPrompt } from '@/lib/trap-examples';
import {
  getL1EvidenceByClass,
  inferDifficultyForL1,
  type EvidenceClass,
  type L1EvidenceDefinition,
} from '@/lib/l1-evidence-taxonomy';
import {
  getAllL2TrapTypes,
  getL2TrapByCode,
  type L2TrapType,
} from '@/lib/l2-trap-taxonomy';
import {
  getAllL3Families,
  getL3FamilyByCode,
  type L3Family,
} from '@/lib/l3-family-taxonomy';
import { PearlLevel } from '@/types';
import { processBatch, shouldUseBatchAPI, type BatchRequest, type BatchResponse } from '@/lib/openai-batch';

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
    // Asset classes & venues
    'Equities', 'Fixed Income', 'Foreign Exchange', 'Commodities', 'Cryptocurrency',
    'Exchange-Traded Funds', 'Mutual Funds', 'Pension Funds',
    // Derivatives & structured products
    'Options Markets', 'Futures Markets', 'Equity Derivatives', 'Credit Derivatives',
    'Volatility Products', 'Structured Products',
    // Market microstructure & trading
    'Market Microstructure', 'Algorithmic Trading', 'High-Frequency Trading', 'Market Making',
    'Liquidity And Spreads', 'Order Books And Execution', 'Price Discovery', 'Slippage And Market Impact',
    // Risk & portfolio management
    'Risk Management', 'Portfolio Construction', 'Factor Investing', 'Asset Allocation',
    'Risk Parity', 'Stress Testing', 'Hedging Strategies',
    // Credit & banking
    'Corporate Credit', 'Securitization', 'Retail Banking', 'Commercial Banking',
    'Insurance Underwriting', 'Credit Scoring And Underwriting',
    // Macro & policy
    'Monetary Policy', 'Inflation And Rates', 'Business Cycles', 'Currency Pegs And Crises',
    // Corporate finance & deal markets
    'Initial Public Offerings', 'Mergers And Acquisitions', 'Merger Arbitrage',
    // Funds & intermediaries
    'Asset Management', 'Hedge Funds', 'Venture Capital', 'Private Equity',
    // Behavioral & information
    'Behavioral Finance', 'Market Sentiment', 'Information Leakage And Insider Trading',
    // Real assets & real estate
    'Real Estate Markets', 'Housing Finance',
    // Operational plumbing
    'Clearing And Settlement', 'Regulation And Compliance'
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

// Get domain-specific context to seed scenario generation
function getDomainContext(domain: GenerationDomain, subdomain: string): string {
  const domainContexts: Record<GenerationDomain, {
    terminology: string[];
    actors: string[];
    commonScenarios: string[];
    causalPatterns: string[];
  }> = {
    Markets: {
      terminology: [
        // Prices/returns & risk
        'returns', 'price impact', 'volatility', 'realized volatility', 'implied volatility',
        'beta', 'alpha', 'correlation', 'drawdown', 'risk premia', 'risk-adjusted returns', 'Sharpe ratio',
        // Market microstructure
        'liquidity', 'bid-ask spread', 'order book', 'limit order', 'market order', 'slippage',
        'market making', 'price discovery', 'flow', 'volume', 'open interest',
        // Rates/credit
        'yield', 'yield curve', 'duration', 'credit spread', 'default risk', 'refinancing',
        // Institutional plumbing
        'margin', 'leverage', 'collateral', 'clearing', 'settlement', 'counterparty risk',
        // Macro links
        'inflation', 'policy rate', 'rate hike', 'quantitative easing', 'risk-off',
      ],
      actors: [
        'portfolio manager', 'trader', 'sell-side analyst', 'buy-side analyst', 'market maker',
        'quantitative researcher', 'risk manager', 'treasurer', 'central banker',
        'regulator', 'exchange operator', 'prime broker',
      ],
      commonScenarios: [
        'macro announcements and rate decisions', 'earnings and guidance surprises',
        'index inclusion/rebalancing flows', 'options expiration and hedging flows',
        'liquidity shocks and execution constraints', 'credit events and spread widening',
        'regulatory or rule changes', 'information leakage and rumor-driven moves',
        'stablecoin de-pegs and market stress', 'supply shocks in commodities',
      ],
      causalPatterns: [
        'mechanical flows moving prices (forced buying/selling, hedging, index tracking)',
        'confounding from shared macro shocks (rates, inflation, risk sentiment) affecting both X and Y',
        'reverse causality in reactive systems (algorithms, margin calls, policy responses)',
        'selection/collider effects from conditioning on survivors, funded firms, published strategies, or traded instruments',
        'timing ambiguity where ordering determines whether X causes Y or merely reacts to Y',
      ],
    },
    Medicine: {
      terminology: ['treatment efficacy', 'adverse events', 'dosage', 'patient outcomes', 'clinical trials', 'biomarkers', 'symptom severity', 'recovery rate', 'mortality', 'morbidity'],
      actors: ['physician', 'researcher', 'epidemiologist', 'clinical trial coordinator', 'public health official', 'pharmacist', 'nurse practitioner'],
      commonScenarios: ['treatment interventions', 'drug studies', 'patient care protocols', 'disease surveillance', 'preventive measures', 'diagnostic procedures'],
      causalPatterns: ['treatment effects on outcomes', 'disease progression factors', 'intervention timing', 'patient characteristics influencing response'],
    },
    Law: {
      terminology: ['liability', 'precedent', 'jurisdiction', 'burden of proof', 'damages', 'settlement', 'verdict', 'statute', 'regulation', 'compliance'],
      actors: ['attorney', 'judge', 'regulator', 'compliance officer', 'legal analyst', 'policy maker', 'court clerk'],
      commonScenarios: ['legal disputes', 'regulatory enforcement', 'policy changes', 'case outcomes', 'compliance violations', 'sentencing decisions'],
      causalPatterns: ['legal actions causing outcomes', 'regulatory changes affecting behavior', 'precedent influencing decisions', 'evidence affecting verdicts'],
    },
    Technology: {
      terminology: ['performance metrics', 'user engagement', 'conversion rate', 'latency', 'throughput', 'error rate', 'uptime', 'scalability', 'optimization'],
      actors: ['product manager', 'data scientist', 'engineer', 'analyst', 'researcher', 'system architect', 'UX designer'],
      commonScenarios: ['feature launches', 'A/B tests', 'system performance', 'user behavior', 'algorithm changes', 'infrastructure updates'],
      causalPatterns: ['feature changes affecting metrics', 'algorithm updates influencing behavior', 'infrastructure changes impacting performance', 'design decisions driving outcomes'],
    },
    Education: {
      terminology: ['test scores', 'learning outcomes', 'retention rate', 'engagement', 'curriculum', 'pedagogy', 'intervention', 'achievement gap', 'graduation rate'],
      actors: ['teacher', 'principal', 'researcher', 'curriculum designer', 'policy maker', 'administrator', 'tutor'],
      commonScenarios: ['educational interventions', 'curriculum changes', 'teaching methods', 'student performance', 'policy reforms', 'program evaluations'],
      causalPatterns: ['instructional methods affecting learning', 'interventions influencing outcomes', 'policy changes impacting performance', 'student characteristics affecting achievement'],
    },
  };

  const context = domainContexts[domain];
  return `
DOMAIN CONTEXT - USE THIS TO SEED YOUR SCENARIO:
- Domain: ${domain}
- Subdomain: ${subdomain} (YOU MUST use terminology and concepts specific to this subdomain)

Domain-Specific Elements to Incorporate:
- Terminology: Use terms like ${context.terminology.slice(0, 5).join(', ')}, and other ${domain.toLowerCase()}-specific language
- Actors: Consider roles like ${context.actors.slice(0, 3).join(', ')}, or other relevant ${domain.toLowerCase()} professionals
- Scenarios: Ground your case in ${context.commonScenarios.slice(0, 2).join(' or ')}, or similar ${domain.toLowerCase()} contexts
- Causal Patterns: Consider patterns like ${context.causalPatterns.slice(0, 2).join('; ')}

CRITICAL: Your scenario MUST feel authentic to ${subdomain}. Use specific terminology, realistic actors, and plausible ${domain.toLowerCase()} contexts.`;
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

interface L1EvidenceSelection {
  pearlLevel: 'L1';
  evidence: L1EvidenceDefinition;
}

// Select underrepresented trap type/subtype based on current distribution
async function selectNextTrap(targetLevel?: PearlLevel): Promise<TrapSelection> {
  // Get current distribution of trap types and subtypes from BOTH Question and T3Case tables
  const [existingQuestions, existingT3Cases] = await Promise.all([
    prisma.question.findMany({
      select: { pearl_level: true, trap_type: true, trap_subtype: true },
    }),
    prisma.t3Case.findMany({
      select: { pearl_level: true, trap_type: true, trap_subtype: true },
    }),
  ]);

  // Combine counts from both tables
  const allCases = [
    ...existingQuestions.map(q => ({ pearl_level: q.pearl_level, trap_type: q.trap_type, trap_subtype: q.trap_subtype })),
    ...existingT3Cases.map(c => ({ pearl_level: c.pearl_level, trap_type: c.trap_type, trap_subtype: c.trap_subtype })),
  ];

  // Count by level
  const levelCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
  allCases.forEach(c => {
    if (c.pearl_level && levelCounts[c.pearl_level] !== undefined) {
      levelCounts[c.pearl_level]++;
    }
  });
  const totalCount = allCases.length || 1;

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

  // Count existing by trap type for this level (from both tables)
  const trapTypeCounts: Record<string, number> = {};
  validTrapTypes.forEach(t => { trapTypeCounts[t.type] = 0; });
  allCases
    .filter(c => c.pearl_level === selectedLevel)
    .forEach(c => {
      if (c.trap_type && trapTypeCounts[c.trap_type] !== undefined) {
        trapTypeCounts[c.trap_type]++;
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

  // Count existing by subtype (from both tables)
  const subtypeCounts: Record<string, number> = {};
  subtypes.forEach(s => { subtypeCounts[s.name] = 0; });
  allCases
    .filter(c => c.pearl_level === selectedLevel && c.trap_type === selectedTrapType)
    .forEach(c => {
      if (c.trap_subtype && subtypeCounts[c.trap_subtype] !== undefined) {
        subtypeCounts[c.trap_subtype]++;
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

function validityToEvidenceClass(validity: ValidityType): EvidenceClass {
  if (validity === 'YES') return 'SHEEP';
  if (validity === 'NO') return 'WOLF';
  return 'NONE';
}

async function selectNextL1Evidence(validity: ValidityType): Promise<L1EvidenceSelection | null> {
  const cls = validityToEvidenceClass(validity);
  if (cls === 'NONE') return null;

  const evidenceTypes = getL1EvidenceByClass(cls);
  // Count existing by trapType (code) to promote diversity - using unified T3Case
  const existing = await prisma.t3Case.findMany({
    where: {
      pearl_level: 'L1',
      // trap_type is required (non-nullable), so no need to filter for not null
    },
    select: { trap_type: true },
  });
  const counts: Record<string, number> = {};
  evidenceTypes.forEach(e => {
    counts[e.code] = 0;
  });
  existing.forEach(row => {
    const key = row.trap_type || '';
    if (counts[key] !== undefined) counts[key]++;
  });

  const entries = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  const candidates = entries.slice(0, Math.min(3, entries.length));
  const selectedCode = candidates[Math.floor(Math.random() * candidates.length)]?.[0] || entries[0]?.[0];
  const selected = evidenceTypes.find(e => e.code === selectedCode) || evidenceTypes[0];

  return {
    pearlLevel: 'L1',
    evidence: selected,
  };
}

// Select next L2 trap type (T1-T17) based on underrepresentation
async function selectNextL2TrapType(dataset: string): Promise<L2TrapType> {
  const allTraps = getAllL2TrapTypes();
  
  // Count existing L2 cases by trap_type in this dataset - using unified T3Case
  const existing = await prisma.t3Case.findMany({
    where: { dataset, pearl_level: 'L2' },
    select: { trap_type: true },
  });
  
  const counts: Record<string, number> = {};
  allTraps.forEach(t => { counts[t] = 0; });
  existing.forEach(row => {
    if (row.trap_type && counts[row.trap_type] !== undefined) {
      counts[row.trap_type]++;
    }
  });

  // Find least represented trap types
  const entries = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  const candidates = entries.slice(0, Math.min(3, entries.length));
  const weights = candidates.map((_, i) => 3 - i); // 3, 2, 1 weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let selected = candidates[0][0] as L2TrapType;
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      selected = candidates[i][0] as L2TrapType;
      break;
    }
  }

  return selected;
}

// Select next L3 family (F1-F8) based on underrepresentation
async function selectNextL3Family(dataset: string): Promise<L3Family> {
  const allFamilies = getAllL3Families();
  
  // Count existing L3 cases by trap_type (family) in this dataset - using unified T3Case
  const existing = await prisma.t3Case.findMany({
    where: { dataset, pearl_level: 'L3' },
    select: { trap_type: true },
  });
  
  const counts: Record<string, number> = {};
  allFamilies.forEach(f => { counts[f] = 0; });
  existing.forEach(row => {
    if (row.trap_type && counts[row.trap_type] !== undefined) {
      counts[row.trap_type]++;
    }
  });

  // Find least represented families
  const entries = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  const candidates = entries.slice(0, Math.min(3, entries.length));
  const weights = candidates.map((_, i) => 3 - i); // 3, 2, 1 weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let selected = candidates[0][0] as L3Family;
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      selected = candidates[i][0] as L3Family;
      break;
    }
  }

  return selected;
}

/** Target distribution: 1 Easy : 2 Medium : 1 Hard (25% : 50% : 25%) — enforced per batch like trap types */
const DIFFICULTY_TARGETS: Record<string, number> = { Easy: 0.25, Medium: 0.50, Hard: 0.25 };
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
type TargetDifficulty = (typeof DIFFICULTIES)[number];

/**
 * Build a difficulty schedule for a batch that enforces 1:2:1 (Easy : Medium : Hard).
 * Same idea as trap-type distribution: assign exact counts per batch, then shuffle.
 */
function buildDifficultySchedule(totalTasks: number): TargetDifficulty[] {
  const nEasy = Math.round(totalTasks * 0.25);
  const nHard = Math.round(totalTasks * 0.25);
  const nMedium = Math.max(0, totalTasks - nEasy - nHard);
  const schedule: TargetDifficulty[] = [
    ...Array<TargetDifficulty>(nEasy).fill('Easy'),
    ...Array<TargetDifficulty>(nMedium).fill('Medium'),
    ...Array<TargetDifficulty>(nHard).fill('Hard'),
  ];
  // Shuffle so we don't always generate Easy first, etc.
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }
  return schedule;
}

function buildL1Prompt(
  evidenceSelection: L1EvidenceSelection | null,
  validity: ValidityType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string,
  targetDifficulty?: TargetDifficulty
): string {
  const globalGuardrails = `GLOBAL GUARDRAILS (APPLY TO ALL OUTPUT):
1) SELF-CONTAINED EPISTEMOLOGY:
   - Determine validity ONLY from facts EXPLICITLY stated in the scenario text.
   - Do NOT use external domain knowledge to fill gaps.
   - If evaluating the claim would require facts not stated, make the case AMBIGUOUS (not YES/NO).

2) OBSERVABLE-ONLY DISCIPLINE:
   - Describe ONLY observable actions, measurements, and outcomes.
   - NEVER describe intentions, motivations, or mental states.

3) VARIABLE HYGIENE:
   - X, Y, Z must be DISTINCT concepts (no overlap/synonyms).
   - Do not define Z as a rewording of X, or vice versa.
   - Keep variables concrete and scenario-grounded (not abstract labels like "economic conditions").

4) OUTPUT DISCIPLINE:
   - Return ONLY valid JSON with the exact keys in the specified output format.
   - No extra keys, no commentary, no markdown.`;

  const diversityBlock = recentScenarios.length > 0 ? `
DIVERSITY REQUIREMENTS - CRITICAL:
You MUST create a scenario that is DISTINCTLY DIFFERENT from these recent scenarios:
${recentScenarios.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join('\n')}
` : '';

  const cls = validityToEvidenceClass(validity);
  const evidence = evidenceSelection?.evidence;

  // Get domain-specific context for seeding
  const domainContext = getDomainContext(domain, subdomain);

  const evidenceBlock = evidence
    ? `
EVIDENCE TYPE (MUST FOLLOW EXACTLY - ALL FIELDS ARE MANDATORY):
- evidenceClass: ${evidence.class}
- evidenceType: ${evidence.code} (${evidence.label})
- definition: ${evidence.definition}
- ${evidence.class === 'WOLF' ? 'why flawed' : 'why valid'}: ${evidence.failureOrValidityMode}
- tier: ${evidence.tier} (CORE or ADVANCED)

REQUIRED ELEMENTS (ALL must appear in your scenario):
${evidence.requiredElements.map(e => `  - ${e}`).join('\n')}

${evidence.scenarioTemplate ? `SCENARIO TEMPLATE (follow this pattern with placeholders):
${evidence.scenarioTemplate}
` : ''}

CANONICAL STRUCTURE (follow this narrative pattern):
${evidence.canonicalStructure.map(s => `  - ${s}`).join('\n')}

DESIGN NOTES (critical guidance for implementation):
${evidence.designNotes.map(n => `  - ${n}`).join('\n')}
${evidence.keySignalWords?.length ? `- KEY SIGNAL WORDS to incorporate naturally: ${evidence.keySignalWords.join(', ')}` : ''}
${evidence.keyPhrases?.length ? `- KEY PHRASES to include: ${evidence.keyPhrases.join(', ')}` : ''}

${evidence.difficultyCalibration ? `DIFFICULTY CALIBRATION (use this to determine difficulty level):
- Easy: ${evidence.difficultyCalibration.easy}
- Medium: ${evidence.difficultyCalibration.medium}
- Hard: ${evidence.difficultyCalibration.hard}
` : ''}

${evidence.validationChecklist ? `VALIDATION CHECKLIST (verify your generated case meets these criteria):
${evidence.validationChecklist.map(q => `  - ${q}`).join('\n')}
` : ''}

${evidence.domainExamples?.length ? `DOMAIN EXAMPLES (for inspiration, adapt to your domain):
${evidence.domainExamples.slice(0, 5).map(ex => `  - ${ex.domain}: ${ex.example}`).join('\n')}
` : ''}

${evidence.completeExample ? `COMPLETE EXAMPLE CASE (reference for structure and quality):
Example: ${evidence.code}-${evidence.completeExample.difficulty || 'MEDIUM'}-001
Scenario: ${evidence.completeExample.scenario}
Claim: ${evidence.completeExample.claim}
Ground Truth: ${evidence.completeExample.groundTruth}
Explanation: ${evidence.completeExample.explanation}
` : ''}

IMPLIED GROUND TRUTH: ${evidence.impliedGroundTruth} (this evidence type maps to groundTruth="${evidence.impliedGroundTruth}")
`
    : `
EVIDENCE TYPE:
- evidenceClass: NONE
- evidenceType: null
- This is an AMBIGUOUS case where the causal graph structure is unclear.
- CRITICAL: AMBIGUOUS does NOT mean there's a trap (traps → NO). AMBIGUOUS means the causal relationships themselves are ambiguous - different interpretations of what causes what could lead to different validities.
- Example: If it's unclear whether X causes Y, Y causes X, or Z causes both, that's AMBIGUOUS. If there's a clear confounder Z that makes X→Y invalid, that's NO (with trap type W7/Confounding).
`;

  const groundTruthRules = `GROUND TRUTH + EVIDENCE RULES (MUST OBEY):
- If evidenceClass=WOLF then groundTruth MUST be "NO"
- If evidenceClass=SHEEP then groundTruth MUST be "YES"
- If groundTruth="AMBIGUOUS" then evidenceClass MUST be "NONE" and evidenceType MUST be null
`;

  const claimRule = `CLAIM LANGUAGE (L1 T3 update):
- The claim MUST use explicit causal language ("X causes Y", "X increases Y", "X leads to Y").
`;

  const difficultyBlock = targetDifficulty
    ? `\n- **TARGET DIFFICULTY: ${targetDifficulty}** — You MUST generate a ${targetDifficulty} case. Set "difficulty": "${targetDifficulty}" in your JSON. Do not use Easy/Medium/Hard arbitrarily; we need variety across batches.\n`
    : '';

  return `You are generating ONE T3-L1 causal reasoning case.

MANDATORY SPECIFICATIONS:
- Pearl Level: L1 (Association-level evidence, but the claim is explicitly causal)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Target: ${validity} (this must match groundTruth after applying evidence rules)${difficultyBlock}

${domainContext}

${globalGuardrails}

SCENARIO STRUCTURE (T3-L1):
- Scenario: 2-4 sentences narrative, grounded in observable facts (use inline variable notation (X), (Y), (Z) in-text)
- Claim: 1 sentence with explicit causal language ("X causes Y")
- Ground Truth: YES | NO | AMBIGUOUS
- Evidence Type: WOLF label for NO, SHEEP label for YES, NONE/null for AMBIGUOUS
- Why Flawed/Valid: explain in 60-120 words, tightly aligned to the chosen evidence type

STYLE CONSTRAINTS:
- Be concise (40-100 words total for scenario+claim)
- Describe ONLY observable behaviors/outcomes. Do NOT describe intentions/motivations/mental states.
- Keep it single-type: do NOT mix multiple evidence/trap types.
- Use domain-appropriate terminology from ${subdomain} to make the scenario feel authentic and grounded.

${evidenceBlock}
${groundTruthRules}
${claimRule}

${promptNotes ? `ADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}
${diversityBlock}

OUTPUT FORMAT (Unified T3Case Schema valid JSON only, using snake_case for all field names):
{
  "scenario": "Description of the situation or problem (1-3 sentences)",
  "claim": "The causal claim being evaluated",
  "label": "YES|NO|AMBIGUOUS (must match evidenceClass: YES for SHEEP, NO for WOLF, AMBIGUOUS for NONE)",
  "is_ambiguous": true|false,
  "variables": {
    "X": "Exposure/treatment/predictor variable (string)",
    "Y": "Outcome variable (string)",
    "Z": ["Array of strings describing confounders, mediators, colliders, or mechanisms"]
  },
  "trap": {
    "type": "W1|W2|...|W10|S1|...|S8|A (evidenceType code)",
    "type_name": "Human-readable trap type name (e.g., 'Selection Bias', 'RCT')",
    "subtype": "Optional trap subtype",
    "subtype_name": "Optional human-readable subtype name"
  },
  "difficulty": "${targetDifficulty ?? 'Easy|Medium|Hard'}",
  "causal_structure": "Description of the causal graph structure in natural language (REQUIRED - use full sentences, NOT notation. Example: 'X causes Y, but Z is a confounder that affects both X and Y' instead of 'X -> Y, Z -> X, Z -> Y')",
  "key_insight": "One-line memorable takeaway",
  "hidden_timestamp": "Question that reveals temporal/causal ordering (REQUIRED if label is AMBIGUOUS, otherwise omit)",
  "conditional_answers": {
    "answer_if_condition_1": "Answer if condition 1 is true (REQUIRED if label is AMBIGUOUS, otherwise omit)",
    "answer_if_condition_2": "Answer if condition 2 is true (REQUIRED if label is AMBIGUOUS, otherwise omit)"
  },
  "wise_refusal": "Response identifying missing information or biases",
  "gold_rationale": "Complete explanation of the correct reasoning (60-120 words, replaces whyFlawedOrValid)",
  "domain": "${domain}",
  "subdomain": "${subdomain}"
}

REQUIRED FIELDS (ALL must be present in your JSON response, using snake_case):
1. scenario (string) - REQUIRED
2. claim (string) - REQUIRED: The causal claim being evaluated (MUST be present for all L1 cases)
3. label (string) - REQUIRED: "YES", "NO", or "AMBIGUOUS"
4. is_ambiguous (boolean) - REQUIRED: true if label is "AMBIGUOUS", false otherwise
5. variables (object) - REQUIRED with structure:
   - X: string or {name: string, role: string}
   - Y: string or {name: string, role: string}
   - Z: array of strings (MUST be an array, even if empty: [])
6. trap (object) - REQUIRED with structure:
   - type: string or null (REQUIRED: W1-W10 for NO cases, S1-S8 for YES cases, null for AMBIGUOUS cases)
   - type_name: string (optional but recommended)
   - subtype: string (optional)
   - subtype_name: string (optional)
7. difficulty (string) - REQUIRED: ${targetDifficulty ? `MUST be exactly "${targetDifficulty}" (we need variety; do not default to Easy).` : '"Easy", "Medium", or "Hard" (capitalized)'}
8. causal_structure (string) - REQUIRED: Natural language description of the causal graph structure. Use full sentences, NOT mathematical notation. Example: "X causes Y, but Z is a confounder that affects both X and Y" instead of "X -> Y, Z -> X, Z -> Y"
9. wise_refusal (string) - REQUIRED
10. gold_rationale (string) - REQUIRED: Complete explanation (60-120 words)

CONDITIONAL REQUIREMENTS (using snake_case):
- If label is "AMBIGUOUS" (is_ambiguous is true):
  - hidden_timestamp (string) - MANDATORY: Question that reveals temporal/causal ordering. MUST be present and non-empty.
  - conditional_answers (object) - MANDATORY: Object with answer_if_condition_1 and answer_if_condition_2. Both keys MUST be present and non-empty.
  - CRITICAL: Both hidden_timestamp AND conditional_answers MUST be generated together. Cases will be REJECTED if either is missing.

OPTIONAL BUT RECOMMENDED FIELDS (using snake_case):
- key_insight (string): One-line memorable takeaway

CRITICAL REQUIREMENTS:
- variables.Z MUST be an array: ["item1", "item2"] or [] if empty. NEVER a string or null.
- label MUST match: "YES" for valid claims, "NO" for invalid claims with identifiable traps, "AMBIGUOUS" for unclear causal graph structure
- trap.type MUST be: W1-W10 for WOLF/NO cases, S1-S8 for SHEEP/YES cases, null for AMBIGUOUS (no trap type - the ambiguity is about causal structure, not a trap)
- CRITICAL: If you can identify a specific trap type (confounding, selection bias, etc.), the case should be NO, not AMBIGUOUS. AMBIGUOUS is only for cases where the causal graph structure itself is unclear.
- difficulty MUST be capitalized: "Easy", "Medium", or "Hard" (not "easy", "medium", "hard")
- ⚠️ CRITICAL: causal_structure (string) - MANDATORY FOR ALL CASES. MUST be a natural language description in full sentences (NOT mathematical notation like "X -> Y"). Describe the causal relationships in plain English. Example: "X causes Y, but Z is a confounder that affects both X and Y" instead of "X -> Y, Z -> X, Z -> Y". This field CANNOT be empty or missing. Cases will be REJECTED if causal_structure is missing or empty.
- claim MUST be present (not empty, not null)
- wise_refusal MUST be present (not empty, not null)
- gold_rationale MUST be present (not empty, not null)
- FOR AMBIGUOUS CASES: hidden_timestamp AND conditional_answers are MANDATORY. Both MUST be generated. Cases will be REJECTED if either is missing.
- All 10 required fields above MUST be present in your JSON. Missing any required field will cause the case to be REJECTED.

Return ONLY valid JSON matching this exact structure with ALL required fields.`;
}

function buildL2Prompt(
  trapType: L2TrapType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string,
  targetDifficulty?: TargetDifficulty
): string {
  const globalGuardrails = `GLOBAL GUARDRAILS (APPLY TO ALL OUTPUT):
1) SELF-CONTAINED EPISTEMOLOGY:
   - The case must be solvable ONLY from facts explicitly stated in the scenario.
   - Do NOT rely on external market/medical/legal knowledge.

2) OBSERVABLE-ONLY DISCIPLINE:
   - Describe ONLY observable actions, measurements, and outcomes.
   - NEVER describe intentions, motivations, or mental states.

3) VARIABLE HYGIENE:
   - X, Y, Z must be DISTINCT concepts and clearly labeled in-text.
   - Z is REQUIRED in every L2 case: the ambiguous third variable that drives the hidden question (not a duplicate of X).
   - variables.Z must be a non-empty array; never omit Z or use [].

4) OUTPUT DISCIPLINE:
   - Return ONLY valid JSON with the exact keys in the specified output format.
   - No extra keys, no commentary, no markdown.`;

  const trapDef = getL2TrapByCode(trapType);
  if (!trapDef) {
    throw new Error(`Invalid L2 trap type: ${trapType}`);
  }

  const diversityBlock = recentScenarios.length > 0 ? `
DIVERSITY REQUIREMENTS - CRITICAL:
You MUST create a scenario that is DISTINCTLY DIFFERENT from these recent scenarios:
${recentScenarios.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join('\n')}
` : '';

  // Get domain-specific context for seeding
  const domainContext = getDomainContext(domain, subdomain);

  const trapBlock = `
TRAP TYPE (MUST FOLLOW EXACTLY - ALL FIELDS ARE MANDATORY):
- Code: ${trapDef.code} (${trapDef.name})
- Family: ${trapDef.family} - ${trapDef.familyName}
- Definition: ${trapDef.definition}

HIDDEN QUESTION GUIDANCE (critical - do NOT copy the pattern verbatim):
- Conceptual pattern for this trap: "${trapDef.hiddenQuestionPattern}" — use ONLY as guidance for what *type* of ambiguity to target.
- You MUST write a **scenario-specific** hidden question: it must reference concrete X, Y, Z, domain, actors, or narrative details from *your* scenario. High-quality questions are distinct and grounded in the case.
- **LAZY GENERATION = 0 points**: Do NOT output the generic pattern (e.g. "${trapDef.hiddenQuestionPattern}") as hidden_timestamp. Evaluators reject cases where the hidden question is the template rather than a tailored, scenario-relevant question.

REQUIRED ELEMENTS (ALL must appear in your scenario):
${trapDef.requiredElements.map(e => `  - ${e}`).join('\n')}

CANONICAL STRUCTURE (causal graph pattern to follow):
${trapDef.canonicalStructure.map(s => `  - ${s}`).join('\n')}

CASE SKELETON (narrative structure to follow):
${trapDef.caseSkeleton.map(s => `  - ${s}`).join('\n')}

EXAMPLE PATTERNS (use these as inspiration, adapted to ${subdomain}):
${trapDef.examplePattern.map(e => `  - ${e}`).join('\n')}

COMMON PITFALLS TO AVOID (critical - do NOT make these mistakes):
${trapDef.commonPitfalls.map(p => `  - ${p}`).join('\n')}
`;

  const wiseRefusalTemplate = `WISE REFUSAL (4-part template - REQUIRED):
1. Identify the specific causal ambiguity (due to [trap type]).
2. State what information is missing (we cannot determine A vs B without knowing [hidden information]).
3. Present both conditional interpretations ("If [A], then [interpretation A]. If [B], then [interpretation B].").
4. Decline to endorse the causal claim ("Without this information, the causal claim is not justified.").
Template: "The [claim] is ambiguous due to [trap type]. We cannot determine whether [A] or [B] without knowing [hidden information]. If [A], then [interpretation A]. If [B], then [interpretation B]. Without this information, the causal claim is not justified."`;

  const l2DifficultyBlock = targetDifficulty
    ? `\n- **TARGET DIFFICULTY: ${targetDifficulty}** — You MUST generate a ${targetDifficulty} case. Set "difficulty": "${targetDifficulty}" in your JSON. We need variety; do not default to Easy.\n`
    : '';

  return `You are generating ONE L2 causal reasoning case (revamped schema).

MANDATORY SPECIFICATIONS:
- Pearl Level: L2 (causal disambiguation: classify trap type, identify pivotal question, give conditional interpretations, wise refusal)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Trap Type: ${trapType} (${trapDef.name})
- Ground Truth: NO (INVALID) - The causal claim is not justified; we refuse to endorse because hidden information is missing${l2DifficultyBlock}

${domainContext}

${globalGuardrails}

L2 CASE STRUCTURE (Revamped):
- Scenario: Narrative (3-6 sentences) describing an OBSERVED CORRELATION between X and Y, with Z present. Label X, Y, Z inline as (X), (Y), (Z). Z is REQUIRED.
- Variables: X (exposure), Y (outcome), Z (ambiguous third variable - confounder, mediator, collider, etc.). All three required.
- hidden_timestamp (Hidden Question): A **scenario-specific** question that would resolve the ambiguity. It must target the same *type* of ambiguity as the trap's conceptual pattern but **must reference your scenario's concrete X, Y, Z, domain, or narrative** — e.g. "Were only long-term gym members surveyed, or a random sample of all adults?" not "Who is systematically excluded from observation?" Do NOT use the generic pattern as the hidden question.
- answer_if_condition_1 / answer_if_condition_2: Causal interpretation when condition A holds vs when B holds. The two interpretations must be MUTUALLY EXCLUSIVE and EXHAUSTIVE. Under one condition the claim may be invalid, under the other it may be valid; we refuse to endorse because we do not know which holds.
- wise_refusal: Must follow the 4-part template below (identify ambiguity, state missing info, present both interpretations, decline to endorse).

${wiseRefusalTemplate}

CRITICAL REQUIREMENTS:
1. The scenario must describe an OBSERVED CORRELATION between X and Y, with Z present. Causal structure PLAUSIBLE but UNRESOLVED.
2. The hidden question (hidden_timestamp) MUST be **scenario-specific**: reference concrete X, Y, Z, domain, or narrative details. Do NOT copy the generic pattern "${trapDef.hiddenQuestionPattern}" verbatim. Write a distinct, high-quality question tailored to your scenario.
3. answer_if_condition_1 and answer_if_condition_2 must be MUTUALLY EXCLUSIVE and EXHAUSTIVE. They give the causal interpretation under each possibility; we decline because we lack the hidden information (one branch may support the claim, one refute it).
4. wise_refusal MUST follow the 4-part template: identify ambiguity, state missing info, present both interpretations, decline to endorse.
5. Variables X, Y, Z must be clearly labeled in the narrative using (X), (Y), (Z). Z is REQUIRED (non-empty).
6. The scenario must support TWO coherent conditional worlds (A and B) corresponding to the hidden question.
7. Use domain-appropriate terminology from ${subdomain}. Prefer canonical subtypes for ${trapType} where applicable (e.g. per trap type: healthy user/volunteer/indication bias for T1; business survival/publication bias/attrition for T2; Berkson's paradox/M-bias for T3; etc.).

${trapBlock}

${promptNotes ? `ADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}
${diversityBlock}

OUTPUT FORMAT (Unified T3Case Schema - Table 9, valid JSON only, using snake_case for all field names):
{
  "scenario": "Narrative describing OBSERVED CORRELATION between X and Y, with Z present (3-6 sentences). Label X, Y, Z inline as (X), (Y), (Z).",
  "claim": "The causal claim being evaluated (must be INVALID/NO)",
  "label": "NO (all L2 cases must be labeled NO)",
  "is_ambiguous": true,
  "variables": {
    "X": "Exposure variable (string or {name: string, role: string})",
    "Y": "Outcome variable (string or {name: string, role: string})",
    "Z": ["REQUIRED non-empty array - the ambiguous third variable (e.g. single string in array). Never []."]
  },
  "trap": {
    "type": "${trapType}",
    "type_name": "${trapDef.name}",
    "subtype": "Canonical subtype for this trap (e.g. per spec: healthy user/volunteer/indication for T1; Berkson's paradox/M-bias for T3; etc.)",
    "subtype_name": "Human-readable subtype name"
  },
  "difficulty": "${targetDifficulty ?? 'Easy|Medium|Hard'}",
  "causal_structure": "Causal graph structure. Use natural language (required); you may also include arrow notation (→, ←, ↔) in addition. E.g. 'X causes Y, but Z is a confounder affecting both. (Z → X, Z → Y.)'",
  "key_insight": "One-line memorable takeaway",
  "hidden_timestamp": "SCENARIO-SPECIFIC pivotal question that would resolve the ambiguity (REQUIRED - reference concrete X/Y/Z/domain/narrative; do NOT use the generic pattern verbatim)",
  "conditional_answers": {
    "answer_if_condition_1": "Causal interpretation when condition A holds (REQUIRED). Mutually exclusive and exhaustive with answer_if_condition_2.",
    "answer_if_condition_2": "Causal interpretation when condition B holds (REQUIRED). One branch may support the claim, one refute it; we refuse because we lack hidden info."
  },
  "wise_refusal": "MUST follow 4-part template: identify ambiguity, state missing info, present both interpretations, decline to endorse. See WISE REFUSAL above.",
  "gold_rationale": "Complete explanation of why the claim is not justified and what information is missing",
  "domain": "${domain}",
  "subdomain": "${subdomain}"
}

REQUIRED FIELDS (ALL must be present in your JSON response, using snake_case):
1. scenario (string) - REQUIRED. Describe observed correlation between X, Y, with Z present.
2. claim (string) - REQUIRED: The causal claim being evaluated (MUST be present for all L2 cases)
3. label (string) - REQUIRED: MUST be "NO" for all L2 cases
4. is_ambiguous (boolean) - REQUIRED: MUST be true (L2 cases are ambiguous by nature)
5. variables (object) - REQUIRED with X, Y, Z. Z must be a NON-EMPTY array (never []).
6. trap (object) - REQUIRED with type="${trapType}", type_name, subtype, subtype_name
7. difficulty (string) - REQUIRED: ${targetDifficulty ? `MUST be exactly "${targetDifficulty}" (we need variety; do not default to Easy).` : '"Easy", "Medium", or "Hard" (capitalized)'}
8. causal_structure (string) - REQUIRED: Causal graph in natural language (required). You may also include arrows (→, ←, ↔) in addition.
9. wise_refusal (string) - REQUIRED. Must follow the 4-part template (identify ambiguity, state missing info, both interpretations, decline to endorse).
10. gold_rationale (string) - REQUIRED: Complete explanation
11. hidden_timestamp (string) - REQUIRED: Scenario-specific pivotal question. Must reference your scenario's X, Y, Z, domain, or narrative. Do NOT copy the generic trap pattern verbatim.
12. conditional_answers (object) - REQUIRED with answer_if_condition_1 and answer_if_condition_2. Mutually exclusive and exhaustive.

CRITICAL REQUIREMENTS:
- variables.Z MUST be a NON-EMPTY array (e.g. ["ambiguous variable"]). Never [] or omit. NEVER a string.
- label MUST be "NO" (all L2 cases are invalid)
- trap.type MUST be "${trapType}"
- difficulty MUST be capitalized: "Easy", "Medium", or "Hard"
- causal_structure: Use natural language (required). You may include arrow notation (→, ←, ↔) in addition.
- claim MUST be present (not empty, not null)
- hidden_timestamp MUST be present (not empty, not null), scenario-specific, and high-quality. Do NOT use the taxonomy's generic hidden-question pattern as the literal text. MANDATORY for all L2 cases.
- conditional_answers MUST be present with answer_if_condition_1 and answer_if_condition_2. Mutually exclusive and exhaustive. MANDATORY.
- wise_refusal MUST follow the 4-part template. Cases will be REJECTED if wise_refusal omits any of: identify ambiguity, state missing info, present both interpretations, decline to endorse.
- CRITICAL: hidden_timestamp, conditional_answers, and wise_refusal are REQUIRED. Cases will be REJECTED if any are missing.
- All 12 required fields above MUST be present in your JSON

Return ONLY valid JSON matching this exact structure with ALL required fields.`;
}

function buildL3Prompt(
  family: L3Family,
  validity: ValidityType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string,
  targetDifficulty?: TargetDifficulty
): string {
  const globalGuardrails = `GLOBAL GUARDRAILS (APPLY TO ALL OUTPUT):
1) SELF-CONTAINED EPISTEMOLOGY:
   - All causal force must come from facts explicitly stated in the scenario + invariants.
   - Do NOT use external domain knowledge to justify the counterfactual.
   - If key invariants/mechanisms are missing, the label should be CONDITIONAL (not VALID/INVALID).

2) OBSERVABLE-ONLY DISCIPLINE:
   - Describe ONLY observable actions, measurements, and outcomes.
   - NEVER describe intentions, motivations, or mental states.

3) VARIABLE HYGIENE:
   - X (antecedent), Y (consequent), Z (mechanism/context) must be DISTINCT.
   - X and Y must be SINGLE, identifiable variables (not conflated with multiple unrelated changes).
   - Make Z a concrete mechanism or constraint (e.g., order-book liquidity, contractual payout rule, margin constraints).

4) OUTPUT DISCIPLINE:
   - Return ONLY valid JSON with the exact keys in the specified output format.
   - No extra keys, no commentary, no markdown.`;

  const familyDef = getL3FamilyByCode(family);
  if (!familyDef) {
    throw new Error(`Invalid L3 family: ${family}`);
  }

  const diversityBlock = recentScenarios.length > 0 ? `
DIVERSITY REQUIREMENTS - CRITICAL:
You MUST create a scenario that is DISTINCTLY DIFFERENT from these recent scenarios:
${recentScenarios.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join('\n')}
` : '';

  // Map validity to L3 ground truth
  const l3GroundTruth: 'VALID' | 'INVALID' | 'CONDITIONAL' =
    validity === 'YES' ? 'VALID' : validity === 'NO' ? 'INVALID' : 'CONDITIONAL';

  // Get domain-specific context for seeding
  const domainContext = getDomainContext(domain, subdomain);

  const familyBlock = `
FAMILY (MUST FOLLOW EXACTLY - ALL FIELDS ARE MANDATORY):
- Code: ${familyDef.code} (${familyDef.name})
- Guiding Question: "${familyDef.guidingQuestion}" (this is the key question your counterfactual must address)

DEFINITION:
${familyDef.definition}

REQUIRED ELEMENTS (ALL must appear in your scenario):
${familyDef.requiredElements.map(e => `  - ${e}`).join('\n')}

CANONICAL CASE STRUCTURE (narrative pattern to follow):
${familyDef.canonicalCaseStructure.map(s => `  - ${s}`).join('\n')}

LABEL DIFFERENTIATION LOGIC (critical for determining groundTruth="${l3GroundTruth}"):
- VALID: ${familyDef.labelDifferentiation.valid}
- INVALID: ${familyDef.labelDifferentiation.invalid}
- CONDITIONAL: ${familyDef.labelDifferentiation.conditional}

GENERATOR HEURISTIC (use this to guide your scenario design):
${familyDef.generatorHeuristic}

TYPICAL MAJORITY LABEL: ${familyDef.typicalMajorityLabel} (but you are targeting ${l3GroundTruth})
`;

  // Build CONDITIONAL-specific requirements
  const conditionalRequirements = l3GroundTruth === 'CONDITIONAL' ? `
CRITICAL: CONDITIONAL LABEL REQUIREMENTS (Section 4.3 of spec):
A case is labeled CONDITIONAL when the scenario and invariants do not determine a unique answer, 
and at least two reasonable completions of missing invariants lead to different labels.

YOU MUST:
1. Explicitly list ALL missing invariants in the invariants array using format: "Not specified: [what is missing]"
   Example: "Not specified: whether agent holds or sells during volatility"
   Example: "Not specified: whether backup cause would have fired"

2. In conditional_answers, show how different invariant completions lead to DIFFERENT labels:
   - answer_if_condition_1: Show reasoning that leads to VALID (when one invariant completion is assumed)
   - answer_if_condition_2: Show reasoning that leads to INVALID (when a different invariant completion is assumed)

3. In hidden_timestamp, ask a question that would reveal the missing invariant information.

4. In gold_rationale, explain why the case is CONDITIONAL by citing the missing invariants and showing 
   how different completions yield different conclusions.

EXAMPLE (from spec Appendix B.2):
Scenario: "You did not buy Bitcoin in 2010 (X = 0). You claim: 'If I had bought $100 of Bitcoin, I would be a millionaire today.'"
Invariants: ["Not specified: whether the agent holds or sells during volatility"]
conditional_answers: {
  "answer_if_condition_1": "VALID - If agent holds through volatility, the claim is correct",
  "answer_if_condition_2": "INVALID - If agent sells during volatility, the claim is incorrect"
}
` : '';

  // Key counterfactual concepts
  const keyConcepts = `
KEY COUNTERFACTUAL CONCEPTS (Section 2.3 of spec):

1. BUT-FOR CAUSATION:
   X is a but-for cause of Y if Y would not have occurred but for X.
   Formally: Yx=0 = 0 when Yx=1 = 1.
   Example: "If the dam hadn't been there, the flood would have destroyed the town" (valid if dam was only barrier)

2. OVERDETERMINATION:
   When multiple causes each suffice for Y, removing one does not prevent Y.
   Example: Two assassins act independently; removing either still results in death.
   This is central to Family F3.

3. PREEMPTION:
   An early cause brings about Y and blocks a backup cause. The early cause is the actual cause 
   even though the backup would have sufficed.
   Example: Assassin A fires first and kills victim; Assassin B's bullet arrives too late.
   This distinguishes VALID from INVALID in F3 cases.

4. INVARIANTS:
   Variables held fixed across worlds. Different invariant choices can yield different counterfactual 
   conclusions, so invariants must be stated explicitly in each case.
   CRITICAL: The same scenario with different invariants can yield different labels.
`;

  // Invariants must be scenario-specific and unique — not generic templates
  const invariantsScenarioSpecificBlock = `
INVARIANTS — SCENARIO-SPECIFIC AND UNIQUE (CRITICAL):

Invariants MUST be **unique to your case** and **grounded in your scenario**. Reference concrete X, Y, Z, domain, actors, mechanisms, rules, or narrative details. Do NOT reuse generic templates.

**AVOID (generic / repetitive — penalized):**
- "Mechanism and causal rules unchanged."
- "Background risk and population fixed."
- "Other causes remain active."
- "Mechanism and rules unchanged."
- "Background risk, population, randomness model."
- Any invariant that could apply to many unrelated scenarios without modification.

**GOOD (scenario-specific):**
- "Boarding rules and gate-closure policy unchanged; flight still departs at 10:00."
- "The dam's design, river flow, and upstream geology fixed; no other flood barriers."
- "Order-book liquidity and market-maker behavior unchanged; no external shocks."
- "Contractual payout rules and premium structure unchanged; policy terms as written."
- For CONDITIONAL: "Not specified: whether the agent holds or sells during volatility." (references your scenario's agent and assets)

**RULES:**
- Each invariant must mention at least one concrete element from YOUR scenario (e.g., boarding, dam, order-book, contract, specific actor, or mechanism).
- Do not copy the family's canonical invariant phrasing verbatim. Adapt it to your domain, subdomain, and variables.
- Invariants should be distinguishable from those of other cases; they must feel tailored to this specific story.
`;

  // Deterministic vs Probabilistic guidance
  const deterministicProbabilisticGuidance = `
DETERMINISTIC VS PROBABILISTIC PHRASING (Section 2.2 of spec):

Policy for stochastic scenarios:
- If the counterfactual is worded DETERMINISTICALLY ("would", "would have"), then a purely stochastic 
  link typically forces CONDITIONAL unless the scenario pins down a near-deterministic mechanism 
  or an explicit probability threshold.

- If the claim is PROBABILISTIC ("more likely", "reduces risk", "increases probability"), then 
  VALID can be used when a material probability shift follows from stated mechanisms.

MATCHING REQUIREMENT:
- If your mechanism is deterministic (rule-based, necessary condition), use deterministic wording: "would have"
- If your mechanism is probabilistic (background risk, stochastic), use probabilistic wording: "more likely", "reduces risk"
- If you use deterministic wording with a stochastic mechanism, the label should typically be CONDITIONAL

Examples:
- Deterministic: "If the dam had not been built, the town would have flooded" (VALID if dam is only barrier)
- Probabilistic: "If the dam had not been built, the town would have been more likely to flood" (VALID if dam materially reduces flood risk)
- Mismatch: "If the dam had not been built, the town would have flooded" + stochastic mechanism = CONDITIONAL
`;

  // SCM Procedure requirements
  const scmProcedure = `
STRUCTURAL CAUSAL MODEL (SCM) PROCEDURE (Section 2.1 of spec):

Every counterfactual must be evaluable via the three-step procedure:

1. ABDUCTION: Infer the relevant latent state from observed evidence
   - Your scenario must provide enough information to infer unobserved variables
   - Example: From "Alice missed her flight by 5 minutes" and "boarding closes 10 minutes before departure", 
     we can infer that arriving on time would have allowed boarding.

2. ACTION: Modify the antecedent (set X ← x)
   - The counterfactual claim explicitly states this modification
   - Example: "If Alice had arrived on time" sets X = arrived_on_time

3. PREDICTION: Propagate the change under declared invariants to obtain Yx
   - Use the invariants to determine how the change propagates
   - Example: Under invariant "boarding rules unchanged", arriving on time → boarding → death (if plane crashes)

Your scenario must support all three steps. If abduction is impossible (insufficient information), 
the case should be CONDITIONAL.
`;

  // Quality checklist
  const qualityChecklist = `
QUALITY CRITERIA CHECKLIST (Section 5.3 of spec):

Each case must satisfy ALL of the following:

✓ SELF-CONTAINED: Scenario includes all facts needed; no external knowledge required
✓ CLARITY: X, Y, Z, and invariants are unambiguous and well-defined
✓ CORRECTNESS: Label is defensible; gold_rationale (justification) is sound under stated invariants
✓ FAMILY FIT: Case clearly tests the assigned counterfactual pattern (${familyDef.name})
✓ INVARIANTS UNIQUE: Invariants are scenario-specific and reference concrete X, Y, Z, domain, or narrative — not generic templates
✓ NOVELTY: Not a trivial variant of an existing case
✓ REALISM: Scenario is plausible (real-world or realistic hypothetical)
✓ DETERMINACY: Label is defensible under normal reading and stable under reasonable paraphrases
✓ ANNOTATION CORRECTNESS: Chosen family (${family}) matches the core reasoning challenge

Before finalizing, verify each criterion is met.
`;

  // RCA structure guidance
  const rcaStructure = `
REGULATED CAUSAL ANCHORING (RCA) RUBRIC STRUCTURE (Appendix A of spec):

Your wise_refusal and gold_rationale should follow the RCA structure:

1. LABEL: State the verdict (VALID/INVALID/CONDITIONAL)
2. GRAPH: Describe the causal structure in words
3. INVARIANTS: State what is held fixed across worlds
4. JUSTIFICATION: Explain how changing X affects Y (this is part of gold_rationale)
5. EVIDENCE: Cite specific facts from the scenario text
6. MISSING: If CONDITIONAL, state what information would resolve it

${l3GroundTruth === 'CONDITIONAL' ? `
For CONDITIONAL cases, the "MISSING" section is CRITICAL:
- List the missing invariants explicitly
- Explain how different completions lead to different labels
- State what information would resolve the counterfactual
` : ''}

NOTE: The spec Section 4.1 mentions both "Justification" and "WiseResponse" as separate fields, but in practice:
- gold_rationale serves as the justification (2-4 sentences grounded in Scenario + Invariants)
- wise_refusal serves as the wise response (brief structured reasoning template)
`;

  // Distribution guidance (informational)
  const distributionGuidance = `
TARGET DISTRIBUTIONS (Section 5.2 of spec - for reference):
- Ground truth: ~35% VALID, ~25% INVALID, ~40% CONDITIONAL
- Difficulty: 1 Easy : 2 Medium : 1 Hard (25% : 50% : 25%) — enforced per batch

Generate cases that match the assigned target label and difficulty.
`;

  const l3DifficultyBlock = targetDifficulty
    ? `\n- **TARGET DIFFICULTY: ${targetDifficulty}** — You MUST generate a ${targetDifficulty} case. Set "difficulty": "${targetDifficulty}" in your JSON. We need variety; do not default to Easy.\n`
    : '';

  return `You are generating ONE T3-L3 counterfactual reasoning case.

MANDATORY SPECIFICATIONS:
- Pearl Level: L3 (Counterfactual-level reasoning)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Family: ${family} (${familyDef.name})
- Target Ground Truth: ${l3GroundTruth} (this must match groundTruth after applying family logic)${l3DifficultyBlock}

${domainContext}

${globalGuardrails}

${keyConcepts}

${invariantsScenarioSpecificBlock}

${deterministicProbabilisticGuidance}

${scmProcedure}

COUNTERFACTUAL-SPECIFIC DOMAIN GUIDANCE:
When creating counterfactual scenarios in ${subdomain}, consider:
- What mechanisms or rules govern causality in this subdomain?
- What would be plausible alternative worlds given ${subdomain} constraints?
- How do invariants (rules, mechanisms, structures) apply in ${domain.toLowerCase()} contexts?
- What domain-specific terminology captures counterfactual reasoning (e.g., "would have", "had X not occurred", "alternative scenario")?

GLOBAL L3 DESIGN CONSTRAINTS (apply to all families):
1. Explicit alternative world: Every case must be evaluable via:
   - Abduction (infer latent state from observed evidence)
   - Action (modify the antecedent: set X ← x)
   - Prediction (propagate the change under declared invariants to obtain Yx)

2. Invariant sensitivity: Labels depend on whether stated invariants pin down the counterfactual mechanism.
   CRITICAL: Different invariant choices can yield different counterfactual conclusions.

3. Label semantics:
   - VALID → X is counterfactually relevant to Y under stated invariants (changing X would change Y, or materially change the probability of Y)
   - INVALID → Y is invariant to X under stated invariants (changing X would not change Y, e.g., due to overdetermination, spurious linkage, or causal independence)
   - CONDITIONAL → missing or ambiguous invariants permit multiple defensible answers (at least two reasonable completions of missing invariants lead to different labels)

Your generator should NEVER rely on external knowledge; all causal force must be internal to the scenario text.

${familyBlock}

${conditionalRequirements}

${qualityChecklist}

${rcaStructure}

${distributionGuidance}

SCENARIO STRUCTURE (T3-L3 per Section 4.1 of spec):
- Scenario: 2-5 sentences describing what happened in World A (use inline variable notation (X), (Y), (Z) in-text)
- Counterfactual Claim: "If [X had been different], then [Y]." (explicit counterfactual language)
- Variables: X (Antecedent - single, identifiable), Y (Consequent - single, identifiable), Z (Mechanism/Context)
- Invariants: 1-3 bullets, **scenario-specific and unique** — reference concrete X, Y, Z, domain, actors, or mechanisms from YOUR scenario. No generic templates (e.g. "Mechanism and rules unchanged").
  * If unknown, MUST state explicitly: "Not specified: [what is missing]" (still tie the "missing" to your scenario)
  * For CONDITIONAL cases, ALL missing invariants must be listed
- Ground Truth: VALID | INVALID | CONDITIONAL
- Gold Rationale: 2-4 sentences grounded in Scenario + Invariants (serves as both justification and gold rationale per spec Section 4.1)
- Wise Response: Brief structured reasoning template following RCA rubric

STYLE CONSTRAINTS:
- Be concise (2-5 sentences for scenario)
- Use explicit counterfactual language matching mechanism determinism ("would have" for deterministic, "more likely" for probabilistic)
- Clearly state invariants - they determine the label. Invariants must be scenario-specific and unique (no generic templates).
- All causal reasoning must be derivable from the scenario text
- Use domain-appropriate terminology from ${subdomain} to make the scenario feel authentic and grounded
- Ensure label is stable under reasonable paraphrases of the claim (determinacy requirement)

${promptNotes ? `ADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}
${diversityBlock}

OUTPUT FORMAT (valid JSON only, using snake_case for all field names):
{
  "case_id": "Optional case ID (format: ${family}-D[domain]-[number] recommended)",
  "scenario": "Description of the situation or problem (2-5 sentences) - what happened in World A (use inline (X), (Y), (Z) notation)",
  "counterfactual_claim": "If [X had been different], then [Y].",
  "label": "${l3GroundTruth}",
  "is_ambiguous": ${l3GroundTruth === 'CONDITIONAL' ? 'true' : 'false'},
  "variables": {
    "X": "Antecedent variable (string or {name: string, role: string}) - MUST be single, identifiable variable",
    "Y": "Consequent variable (string or {name: string, role: string}) - MUST be single, identifiable variable",
    "Z": ["Array of strings describing mechanisms, context, or constraints"]
  },
  "trap": {
    "type": "${family}",
    "type_name": "${familyDef.name}",
    "subtype": "Optional trap subtype",
    "subtype_name": "Optional human-readable subtype name"
  },
  "difficulty": "${targetDifficulty ?? 'Easy|Medium|Hard'}",
  "causal_structure": "Description of the causal graph structure in natural language (REQUIRED - use full sentences, NOT notation. Example: 'X causes Y, but Z is a confounder that affects both X and Y' instead of 'X -> Y, Z -> X, Z -> Y')",
  "key_insight": "One-line memorable takeaway",
  "hidden_timestamp": "Question that reveals temporal/causal ordering or missing invariant (REQUIRED if label is CONDITIONAL, otherwise omit)",
  "conditional_answers": {
    "answer_if_condition_1": "Answer if condition 1 is true - show reasoning leading to VALID (REQUIRED if label is CONDITIONAL, otherwise omit)",
    "answer_if_condition_2": "Answer if condition 2 is true - show reasoning leading to INVALID (REQUIRED if label is CONDITIONAL, otherwise omit)"
  },
  "wise_refusal": "Brief structured reasoning template following RCA rubric (response identifying missing information or biases)",
  "gold_rationale": "Complete explanation of the correct reasoning (2-4 sentences grounded in Scenario + Invariants) following RCA structure. This serves as both the justification and gold rationale per spec Section 4.1.",
  "invariants": [
    "1-3 scenario-specific bullets; reference concrete X/Y/Z, domain, actors, or mechanisms. NO generic templates.",
    "If unknown, MUST state: 'Not specified: [what is missing]' (tied to your scenario)",
    "${l3GroundTruth === 'CONDITIONAL' ? 'For CONDITIONAL: ALL missing invariants must be explicitly listed' : ''}"
  ],
  "domain": "${domain}",
  "subdomain": "${subdomain}"
}

REQUIRED FIELDS (ALL must be present in your JSON response, using snake_case):
1. scenario (string) - REQUIRED
2. counterfactual_claim (string) - REQUIRED: The counterfactual claim being evaluated (MUST be present for all L3 cases)
3. label (string) - REQUIRED: "${l3GroundTruth}" (VALID, INVALID, or CONDITIONAL)
4. is_ambiguous (boolean) - REQUIRED: true only if label is "CONDITIONAL"
5. variables (object) - REQUIRED with X, Y, Z where Z is an array. X and Y must be single, identifiable variables.
6. trap (object) - REQUIRED with type="${family}", type_name, subtype, subtype_name
7. difficulty (string) - REQUIRED: ${targetDifficulty ? `MUST be exactly "${targetDifficulty}" (we need variety; do not default to Easy).` : '"Easy", "Medium", or "Hard" (capitalized)'}
8. causal_structure (string) - REQUIRED: Natural language description of the causal graph structure. Use full sentences, NOT mathematical notation. Example: "X causes Y, but Z is a confounder that affects both X and Y" instead of "X -> Y, Z -> X, Z -> Y"
9. wise_refusal (string) - REQUIRED: Follow RCA rubric structure
10. gold_rationale (string) - REQUIRED: Complete explanation (2-4 sentences grounded in Scenario + Invariants) following RCA structure. This serves as both the justification and gold rationale per spec Section 4.1.
11. invariants (array) - REQUIRED: Array of invariant strings. Each must be scenario-specific and unique (reference your X, Y, Z, domain, or narrative). No generic templates. If unknown, use "Not specified: [what is missing]" format.

CONDITIONAL REQUIREMENTS (using snake_case):
- If label is "CONDITIONAL" (is_ambiguous is true):
  - hidden_timestamp (string) - MANDATORY: Question that reveals missing invariant information. MUST be present and non-empty.
  - conditional_answers (object) - MANDATORY: Object with answer_if_condition_1 and answer_if_condition_2. 
    * answer_if_condition_1: Show reasoning that leads to VALID when one invariant completion is assumed
    * answer_if_condition_2: Show reasoning that leads to INVALID when a different invariant completion is assumed
    * Both keys MUST be present and non-empty.
  - invariants array - MANDATORY: MUST explicitly list ALL missing invariants using "Not specified: [what is missing]" format
  - gold_rationale - MANDATORY: MUST explain why case is CONDITIONAL by citing missing invariants and showing how different completions yield different conclusions
  - CRITICAL: All of the above MUST be generated together. Cases will be REJECTED if any are missing.

OPTIONAL FIELDS (using snake_case):
- key_insight (string)
- case_id (string)

CRITICAL REQUIREMENTS:
- variables.Z MUST be an array: ["item"] or [] if empty. NEVER a string.
- variables.X and variables.Y MUST be single, identifiable variables (not conflated with multiple unrelated changes)
- label MUST be "${l3GroundTruth}"
- trap.type MUST be "${family}" (F1-F8)
- causal_structure MUST be a natural language description in full sentences (NOT mathematical notation like "X -> Y"). Describe the causal relationships in plain English.
- counterfactual_claim MUST be present (not empty, not null) and match mechanism determinism (deterministic vs probabilistic wording)
- invariants MUST be a non-empty array. Each invariant must be scenario-specific and unique (reference concrete elements from your case). Do NOT use generic templates (e.g. "Mechanism and rules unchanged", "Background risk fixed"). If any invariant is unknown, use "Not specified: [what is missing]" format, still tied to your scenario.
- FOR CONDITIONAL CASES: hidden_timestamp, conditional_answers, and explicit missing invariants are MANDATORY. All MUST be generated. Cases will be REJECTED if any are missing.
- All 11 required fields above MUST be present in your JSON
- difficulty MUST be capitalized: "Easy", "Medium", or "Hard"
- Label must be defensible under normal reading and stable under reasonable paraphrases (determinacy requirement)
- Case must clearly test the assigned counterfactual pattern (family fit requirement)
- Scenario must be plausible and not a trivial variant of existing cases (novelty and realism requirements)

Return ONLY valid JSON matching this exact structure with ALL required fields.`;
}

async function getNextGeneratedCaseId(): Promise<string> {
  const [lastQuestion, lastT3] = await Promise.all([
    prisma.question.findFirst({
      where: { source_case: { startsWith: 'G.' } },
      orderBy: { source_case: 'desc' },
      select: { source_case: true },
    }),
    prisma.t3Case.findFirst({
      where: { source_case: { startsWith: 'G.' } },
      orderBy: { source_case: 'desc' },
      select: { source_case: true },
    }),
  ]);

  const parseNum = (s?: string | null) => {
    if (!s) return 0;
    const n = parseInt(s.split('.')[1] || '0', 10);
    return Number.isFinite(n) ? n : 0;
  };

  const next = Math.max(
    parseNum(lastQuestion?.source_case),
    parseNum(lastT3?.source_case)
  ) + 1;
  return `G.${next}`;
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

OUTPUT FORMAT (valid JSON only, using snake_case for all field names):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. Get straight to the causal pattern.",
  "claim": "The specific claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": []
  },
  "label": "YES",
  "is_ambiguous": false,
  "trap": {
    "type": "NONE",
    "subtype": null
  },
  "difficulty": "Easy",
  "causal_structure": "MANDATORY - Natural language description of causal relationships in full sentences, NOT mathematical notation. Example: 'X causes Y directly' or 'X causes Y, but Z is a confounder that affects both X and Y'. DO NOT use notation like 'X -> Y'.",
  "key_insight": "One-line key takeaway about why this reasoning is sound",
  "wise_refusal": "Complete answer starting with 'YES - the claim is supported.' followed by clear reasoning about why the causal identification is sound.",
  "gold_rationale": "Explanation (50-100 words) of why the claim IS supported based ONLY on scenario information."
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

AMBIGUOUS CASES REQUIRE TWO ADDITIONAL FIELDS (MANDATORY):
CRITICAL: AMBIGUOUS cases are about UNCLEAR CAUSAL GRAPH STRUCTURE, not traps. If you can identify a specific trap type (confounding, selection bias, etc.), the case should be NO, not AMBIGUOUS.

1. "hidden_timestamp": A question that would reveal the causal graph structure to disambiguate the case.
   Example: "Did X occur before Y, or did Y occur before X?" (for reverse causation ambiguity)
   Example: "Is Z a confounder affecting both X and Y, or is Z a mediator between X and Y?" (for structural ambiguity)
2. "conditional_answers": JSON object with "answer_if_condition_1" and "answer_if_condition_2" keys showing how different causal graph interpretations lead to different validities.
   Example: {
     "answer_if_condition_1": "Answer if X→Y (direct causation): YES - X directly causes Y...",
     "answer_if_condition_2": "Answer if Z→X and Z→Y (confounding): NO - Z is a confounder making X→Y invalid..."
   }

OUTPUT FORMAT (valid JSON only, using snake_case for all field names):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. Present facts where the causal graph structure is unclear - multiple plausible causal interpretations exist.",
  "claim": "The claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": ["Variable with unclear causal role (could be confounder, mediator, collider, or independent cause)"]
  },
  "label": "AMBIGUOUS",
  "is_ambiguous": true,
  "trap": {
    "type": null,
    "subtype": null
  },
  "difficulty": "Medium",
  "causal_structure": "MANDATORY - Natural language description showing the AMBIGUITY in causal relationships. Describe multiple plausible causal graph interpretations. Example: 'It is unclear whether X causes Y directly, Y causes X (reverse causation), or Z causes both X and Y (confounding). The available information does not distinguish between these causal structures.' DO NOT use notation like 'X -> Y'.",
  "key_insight": "One-line key takeaway about what causal graph structure is ambiguous",
  "wise_refusal": "Complete answer starting with 'AMBIGUOUS - the causal graph structure is unclear.' followed by clear reasoning about which causal relationships are ambiguous and how different interpretations would lead to different validities.",
  "gold_rationale": "Explanation (50-100 words) of why the causal graph structure is ambiguous - what causal relationships are unclear and how different interpretations (e.g., X→Y vs Y→X vs Z→X and Z→Y) could lead to different validities.",
  "hidden_timestamp": "A question that reveals temporal/causal ordering needed to resolve ambiguity.",
  "conditional_answers": {
    "answer_if_condition_1": "Answer if [condition A]: [reasoning under that assumption]...",
    "answer_if_condition_2": "Answer if [condition B]: [reasoning under that assumption]..."
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

OUTPUT FORMAT (valid JSON only, using snake_case for all field names):
{
  "scenario": "CONCISE scenario (2-3 sentences, 40-80 words) using inline (X), (Y), (Z) notation. EXPLICITLY reveal the trap.",
  "claim": "The claim to evaluate - language MUST match Pearl level.",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": ["Confounder/Mediator/Collider that causes the trap (describe role: Latent Cause, Confounder, Condition, Context, etc.)"]
  },
  "label": "NO",
  "is_ambiguous": false,
  "trap": {
    "type": "${trap.trapType}",
    "subtype": "${trap.trapSubtype || null}"
  },
  "difficulty": "Easy",
  "causal_structure": "MANDATORY - Natural language description of causal relationships in full sentences, NOT mathematical notation. Example: 'Z is a confounder that affects both X and Y' instead of 'Z -> X, Z -> Y'. This field MUST be present and non-empty. DO NOT use mathematical notation.",
  "key_insight": "One-line key takeaway",
  "wise_refusal": "Complete answer starting with 'NO - the claim is invalid.' followed by clear reasoning about the ${trap.trapTypeLabel} trap.",
  "gold_rationale": "Explanation (50-100 words) citing SPECIFIC text from scenario that reveals the ${trap.trapTypeLabel} trap."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
}

// Distribution matrix: specify exact counts for each Pearl level × validity combination
interface DistributionMatrix {
  // L1 uses YES/NO/AMBIGUOUS
  L1?: { yes?: number; no?: number; ambiguous?: number };
  // L2 (revamped) produces NO (INVALID) cases with a trap type (T1..T17)
  L2?: { no?: number };
  // L3 uses VALID/INVALID/CONDITIONAL
  L3?: { valid?: number; invalid?: number; conditional?: number };
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
  // Flag to use revamped L2 generation (T1-T17) instead of legacy Question table
  useRevampedL2?: boolean;
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

// Unified T3Case generation interface (matches Table 9 schema)
// Uses snake_case to match database schema
interface GeneratedT3Case {
  case_id?: string;
  bucket?: string;
  scenario: string;
  claim?: string; // Required for L1/L2, optional for L3
  counterfactual_claim?: string; // For L3
  label: string; // YES/NO/AMBIGUOUS for L1, NO for L2, VALID/INVALID/CONDITIONAL for L3
  is_ambiguous: boolean;
  variables: {
    X: string | { name: string; role: string };
    Y: string | { name: string; role: string };
    Z: string[]; // Always an array
  };
  trap: {
    type: string; // W1–W10/S1–S8/A for L1, T1–T17 for L2, F1–F8 for L3
    type_name?: string;
    subtype?: string;
    subtype_name?: string;
  };
  difficulty: string; // "Easy", "Medium", or "Hard"
  causal_structure?: string;
  key_insight?: string;
  hidden_timestamp?: string | object;
  conditional_answers?: object | { answer_if_condition_1?: string; answer_if_condition_2?: string };
  wise_refusal?: string;
  gold_rationale?: string; // For L3: Complete explanation (2-4 sentences) grounded in Scenario + Invariants. Serves as both justification and gold rationale per spec.
  invariants?: string[]; // For L3
  domain?: string;
  subdomain?: string;
}

// Legacy interfaces kept for backward compatibility during migration
interface GeneratedL1Case {
  scenario: string;
  claim: string;
  groundTruth: 'YES' | 'NO' | 'AMBIGUOUS';
  evidenceClass: EvidenceClass;
  evidenceType: string | null;
  whyFlawedOrValid: string;
  domain?: string;
  subdomain?: string;
  difficulty?: string;
  variables?: Record<string, unknown> | null;
  causalStructure?: string | null;
}

interface GeneratedL2Case {
  scenario: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
    [key: string]: string | undefined;
  };
  annotations: {
    trapType: string; // T1..T17
    difficulty: string;
    causalStructure?: string;
  };
  hiddenQuestion: string;
  answerIfA: string;
  answerIfB: string;
  wiseRefusal: string;
}

interface GeneratedL3Case {
  caseId?: string;
  domain?: string;
  family: string; // F1-F8
  difficulty: string;
  scenario: string;
  counterfactualClaim: string;
  variables: {
    X: string;
    Y: string;
    Z: string;
  };
  invariants: string[];
  groundTruth: 'VALID' | 'INVALID' | 'CONDITIONAL';
  justification: string;
  wiseResponse: string;
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

  for (const level of levels) {
    const levelConfig: any = (matrix as any)[level];
    if (!levelConfig) continue;

    if (level === 'L1') {
      const yes = Number(levelConfig.yes || 0);
      const no = Number(levelConfig.no || 0);
      const ambiguous = Number(levelConfig.ambiguous || 0);
      for (let i = 0; i < yes; i++) tasks.push({ pearlLevel: 'L1', validity: 'YES' });
      for (let i = 0; i < no; i++) tasks.push({ pearlLevel: 'L1', validity: 'NO' });
      for (let i = 0; i < ambiguous; i++) tasks.push({ pearlLevel: 'L1', validity: 'AMBIGUOUS' });
    } else if (level === 'L2') {
      const no = Number(levelConfig.no || 0);
      for (let i = 0; i < no; i++) tasks.push({ pearlLevel: 'L2', validity: 'NO' });
    } else if (level === 'L3') {
      // Map matrix labels to internal validity type used by prompt builder:
      // VALID -> YES, INVALID -> NO, CONDITIONAL -> AMBIGUOUS
      const valid = Number(levelConfig.valid || 0);
      const invalid = Number(levelConfig.invalid || 0);
      const conditional = Number(levelConfig.conditional || 0);
      for (let i = 0; i < valid; i++) tasks.push({ pearlLevel: 'L3', validity: 'YES' });
      for (let i = 0; i < invalid; i++) tasks.push({ pearlLevel: 'L3', validity: 'NO' });
      for (let i = 0; i < conditional; i++) tasks.push({ pearlLevel: 'L3', validity: 'AMBIGUOUS' });
    }
  }

  // Shuffle tasks to randomize generation order
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  return tasks;
}

// Interface for generation request metadata (needed for batch processing)
interface GenerationRequestMetadata {
  index: number;
  validity: ValidityType;
  taskPearlLevel: PearlLevel | undefined;
  trap: TrapSelection;
  currentDomain: GenerationDomain;
  currentSubdomain: string;
  evidenceSelection?: L1EvidenceSelection | null;
  selectedTrapType?: string; // For L2
  selectedFamily?: string; // For L3
  targetDifficulty?: TargetDifficulty;
  prompt: string;
  systemPrompt: string;
}

// Helper function to collect all generation requests for batch processing
async function collectGenerationRequests(
  totalTasks: number,
  tasks: GenerationTask[] | undefined,
  batchSize: number,
  indices: number[],
  validityMix: { yes: number; no: number; ambiguous: number },
  pearlLevel: string | undefined,
  fixedDomain: string | undefined,
  promptNotes: string | undefined,
  recentScenarios: string[],
  useRevampedL2: boolean,
  dataset: string
): Promise<GenerationRequestMetadata[]> {
  const requests: GenerationRequestMetadata[] = [];
  const difficultySchedule = buildDifficultySchedule(totalTasks);

  for (let i = 0; i < totalTasks; i++) {
    // Determine validity and pearl level for this iteration
    let validity: ValidityType;
    let taskPearlLevel: PearlLevel | undefined;

    if (tasks) {
      validity = tasks[i].validity;
      taskPearlLevel = tasks[i].pearlLevel;
    } else {
      validity = selectValidity(validityMix, indices[i], batchSize);
      taskPearlLevel = pearlLevel as PearlLevel | undefined;
    }

    // Select trap type/subtype based on current distribution
    const trap = await selectNextTrap(taskPearlLevel);

    // Use domain rotation for diversity
    const currentDomain = getRotatedDomain(i, fixedDomain);
    const currentSubdomain = getRotatedSubdomain(currentDomain, i);

    let prompt: string;
    let systemPrompt: string;
    let evidenceSelection: L1EvidenceSelection | null | undefined;
    let selectedTrapType: string | undefined;
    let selectedFamily: string | undefined;

    const targetDifficulty = difficultySchedule[i];

    if (trap.pearlLevel === 'L1') {
      evidenceSelection = await selectNextL1Evidence(validity);
      prompt = buildL1Prompt(evidenceSelection, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);
      systemPrompt = 'You generate high-quality causal reasoning training cases. Follow the specifications EXACTLY. Return only valid JSON.';
    } else if (taskPearlLevel === 'L2' || (trap.pearlLevel === 'L2' && useRevampedL2)) {
      const trapType = await selectNextL2TrapType(dataset);
      selectedTrapType = trapType;
      prompt = buildL2Prompt(trapType, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);
      systemPrompt = 'You generate high-quality L2 causal reasoning cases with hidden questions and conditional answers. Follow the specifications EXACTLY. Return only valid JSON.';
    } else if (taskPearlLevel === 'L3' || trap.pearlLevel === 'L3') {
      const family = await selectNextL3Family(dataset);
      selectedFamily = family;
      prompt = buildL3Prompt(family, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);
      systemPrompt = 'You generate high-quality L3 counterfactual reasoning cases with explicit alternative worlds and invariants. Follow the specifications EXACTLY. Return only valid JSON.';
    } else {
      // Legacy path
      prompt = buildPrompt(trap, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes);
      systemPrompt = `You are an expert in causal reasoning and Pearl's Causality Hierarchy. You specialize in generating training questions about causal traps and biases. Follow the specifications EXACTLY - the trap type and subtype are mandatory requirements, not suggestions.`;
    }

    requests.push({
      index: i,
      validity,
      taskPearlLevel,
      trap,
      currentDomain,
      currentSubdomain,
      evidenceSelection,
      selectedTrapType,
      selectedFamily,
      targetDifficulty,
      prompt,
      systemPrompt,
    });
  }

  return requests;
}

// Helper function to process a single batch generation result
async function processBatchGenerationResult(
  batchId: string,
  content: string,
  meta: GenerationRequestMetadata,
  dataset: string,
  recentScenarios: string[]
): Promise<{ success: boolean; scenario?: string }> {
  try {
    let generated: GeneratedT3Case | GeneratedQuestion;
    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`[Batch ${batchId}] JSON parse error:`, parseError);
      return { success: false };
    }

    const taskPearlLevel = meta.taskPearlLevel;
    const validity = meta.validity;
    const currentDomain = meta.currentDomain;
    const currentSubdomain = meta.currentSubdomain;

    // Handle L1 cases
    if (meta.trap.pearlLevel === 'L1' || taskPearlLevel === 'L1') {
      // Convert old format to new unified format if needed
      if (('groundTruth' in parsed || 'ground_truth' in parsed) && !('label' in parsed)) {
        const oldFormat = parsed as any;
        const groundTruth = oldFormat.groundTruth || oldFormat.ground_truth;
        const evidenceType = oldFormat.evidenceType || oldFormat.evidence_type || (groundTruth === 'AMBIGUOUS' ? 'A' : null);
        
        generated = {
          scenario: oldFormat.scenario,
          claim: oldFormat.claim,
          label: groundTruth,
          is_ambiguous: groundTruth === 'AMBIGUOUS',
          variables: {
            X: oldFormat.variables?.X || '',
            Y: oldFormat.variables?.Y || '',
            Z: Array.isArray(oldFormat.variables?.Z) 
              ? oldFormat.variables.Z 
              : oldFormat.variables?.Z 
              ? [String(oldFormat.variables.Z)] 
              : [],
          },
          trap: {
            type: evidenceType || 'A',
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          },
          difficulty: oldFormat.difficulty || 'medium',
          causal_structure: oldFormat.causalStructure || oldFormat.causal_structure || undefined,
          key_insight: undefined,
          hidden_timestamp: undefined,
          conditional_answers: undefined,
          wise_refusal: undefined,
          gold_rationale: oldFormat.whyFlawedOrValid || oldFormat.why_flawed_or_valid || undefined,
          domain: oldFormat.domain,
          subdomain: oldFormat.subdomain,
        };
      } else {
        generated = parsed as GeneratedT3Case;
        if (generated.variables && !Array.isArray(generated.variables.Z)) {
          generated.variables.Z = generated.variables.Z ? [String(generated.variables.Z)] : [];
        }
        if (!generated.trap) {
          generated.trap = {
            type: '',
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          };
        }
      }

      // Validate L1 fields
      if (!generated.scenario || !generated.claim || !generated.label || !generated.trap?.type) {
        return { success: false };
      }
      if (!generated.causal_structure || generated.causal_structure.trim() === '') {
        return { success: false };
      }

      const expectedLabel = validity === 'YES' ? 'YES' : validity === 'NO' ? 'NO' : 'AMBIGUOUS';
      if (generated.label !== expectedLabel) {
        return { success: false };
      }

      // Validate AMBIGUOUS L1 cases
      if (generated.label === 'AMBIGUOUS') {
        const hasHiddenTimestamp = generated.hidden_timestamp && 
          (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
        const condAnswers = generated.conditional_answers;
        const hasConditionalAnswers = condAnswers && 
          (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
            ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
            ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
            : false);
        
        if (!hasHiddenTimestamp || !hasConditionalAnswers) {
          return { success: false };
        }
      }

      // Validate trap type
      const expectedClass = validityToEvidenceClass(validity);
      if (expectedClass === 'WOLF' && !generated.trap.type.match(/^W[1-9]|W10$/)) {
        return { success: false };
      }
      if (expectedClass === 'SHEEP' && !generated.trap.type.match(/^S[1-8]$/)) {
        return { success: false };
      }
      if (expectedClass === 'NONE' && generated.trap.type !== null && generated.trap.type !== '' && generated.label === 'AMBIGUOUS') {
        // AMBIGUOUS cases should not have a trap type (null or empty)
        return { success: false };
      }
      if (meta.evidenceSelection?.evidence.code && generated.trap.type !== meta.evidenceSelection.evidence.code) {
        return { success: false };
      }

      const caseId = await getNextGeneratedCaseId();
      const difficultyFromGenerated = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 
        (meta.evidenceSelection ? inferDifficultyForL1(meta.evidenceSelection.evidence) : 'medium');
      const difficulty = meta.targetDifficulty ?? (difficultyFromGenerated.charAt(0).toUpperCase() + difficultyFromGenerated.slice(1));

      const variables = generated.variables || { X: '', Y: '', Z: [] };
      if (!Array.isArray(variables.Z)) {
        variables.Z = variables.Z ? [String(variables.Z)] : [];
      }

      let conditional_answers: string | null = null;
      if (generated.conditional_answers) {
        conditional_answers = typeof generated.conditional_answers === 'string' 
          ? generated.conditional_answers 
          : JSON.stringify(generated.conditional_answers);
      }

      let hidden_timestamp: string | null = null;
      if (generated.hidden_timestamp) {
        hidden_timestamp = typeof generated.hidden_timestamp === 'string'
          ? generated.hidden_timestamp
          : JSON.stringify(generated.hidden_timestamp);
      }

      const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

      await prisma.t3Case.create({
        data: {
          caseId: generated.case_id || caseId,
          bucket,
          pearlLevel: 'L1',
          domain: generated.domain || currentDomain,
          subdomain: generated.subdomain || currentSubdomain,
          scenario: generated.scenario,
          claim: generated.claim || '',
          label: generated.label,
          isAmbiguous: generated.is_ambiguous !== undefined ? generated.is_ambiguous : generated.label === 'AMBIGUOUS',
          variables: JSON.stringify(variables),
          trapType: generated.trap.type,
          trapTypeName: generated.trap.type_name || null,
          trapSubtype: generated.trap.subtype || null,
          trapSubtypeName: generated.trap.subtype_name || null,
          difficulty,
          causalStructure: generated.causal_structure || null,
          keyInsight: generated.key_insight || null,
          hiddenTimestamp: hidden_timestamp,
          conditionalAnswers: conditional_answers,
          wiseRefusal: generated.wise_refusal || null,
          goldRationale: generated.gold_rationale || null,
          dataset,
          author: 'LLM',
          sourceCase: caseId,
          generationBatchId: batchId,
          isVerified: false,
        },
      });

      return { success: true, scenario: generated.scenario };
    }
    // Handle L2 cases
    else if (taskPearlLevel === 'L2' || meta.trap.pearlLevel === 'L2') {
      const selectedTrapType = meta.selectedTrapType!;

      // Convert old L2 format to unified format if needed
      if (('hiddenQuestion' in parsed || 'hidden_question' in parsed) && ('answerIfA' in parsed || 'answer_if_a' in parsed) && !('trap' in parsed)) {
        const oldFormat = parsed as any;
        generated = {
          scenario: oldFormat.scenario,
          claim: oldFormat.claim || '',
          label: 'NO',
          is_ambiguous: true,
          variables: {
            X: oldFormat.variables?.X || '',
            Y: oldFormat.variables?.Y || '',
            Z: Array.isArray(oldFormat.variables?.Z) 
              ? oldFormat.variables.Z 
              : oldFormat.variables?.Z 
              ? [String(oldFormat.variables.Z)] 
              : [],
          },
          trap: {
            type: oldFormat.annotations?.trapType || oldFormat.annotations?.trap_type || selectedTrapType,
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          },
          difficulty: oldFormat.annotations?.difficulty || 'medium',
          causal_structure: oldFormat.annotations?.causalStructure || oldFormat.annotations?.causal_structure || undefined,
          key_insight: undefined,
          hidden_timestamp: oldFormat.hiddenQuestion || oldFormat.hidden_question || undefined,
          conditional_answers: (oldFormat.answerIfA || oldFormat.answer_if_a) && (oldFormat.answerIfB || oldFormat.answer_if_b)
            ? { answer_if_condition_1: oldFormat.answerIfA || oldFormat.answer_if_a, answer_if_condition_2: oldFormat.answerIfB || oldFormat.answer_if_b }
            : undefined,
          wise_refusal: oldFormat.wiseRefusal || oldFormat.wise_refusal || undefined,
          gold_rationale: undefined,
          domain: undefined,
          subdomain: undefined,
        };
      } else {
        generated = parsed as GeneratedT3Case;
        if (generated.variables && !Array.isArray(generated.variables.Z)) {
          generated.variables.Z = generated.variables.Z ? [String(generated.variables.Z)] : [];
        }
        if (!generated.trap) {
          generated.trap = {
            type: selectedTrapType,
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          };
        }
      }

      // Validate L2 fields
      if (!generated.scenario || !generated.claim || !generated.label || !generated.trap?.type) {
        return { success: false };
      }
      if (!generated.causal_structure || generated.causal_structure.trim() === '') {
        return { success: false };
      }
      if (generated.label !== 'NO') {
        return { success: false };
      }
      if (generated.trap.type !== selectedTrapType) {
        return { success: false };
      }
      if (!generated.variables?.X || !generated.variables?.Y) {
        return { success: false };
      }

      const hasHiddenTimestamp = generated.hidden_timestamp && 
        (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
      const condAnswers = generated.conditional_answers;
      const hasConditionalAnswers = condAnswers && 
        (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
          ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
          ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
          : false);
      
      if (!hasHiddenTimestamp || !hasConditionalAnswers) {
        return { success: false };
      }

      const caseId = await getNextGeneratedCaseId();
      const difficultyRaw = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';
      const difficulty = meta.targetDifficulty ?? (difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1));

      const variables = generated.variables || { X: '', Y: '', Z: [] };
      if (!Array.isArray(variables.Z)) {
        variables.Z = variables.Z ? [String(variables.Z)] : [];
      }

      let conditional_answers: string | null = null;
      if (generated.conditional_answers) {
        conditional_answers = typeof generated.conditional_answers === 'string'
          ? generated.conditional_answers
          : JSON.stringify(generated.conditional_answers);
      }

      let hidden_timestamp: string | null = null;
      if (generated.hidden_timestamp) {
        hidden_timestamp = typeof generated.hidden_timestamp === 'string'
          ? generated.hidden_timestamp
          : JSON.stringify(generated.hidden_timestamp);
      }

      const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

      await prisma.t3Case.create({
        data: {
          caseId: generated.case_id || caseId,
          bucket,
          pearlLevel: 'L2',
          domain: generated.domain || currentDomain,
          subdomain: generated.subdomain || currentSubdomain,
          scenario: generated.scenario,
          claim: generated.claim,
          label: 'NO',
          isAmbiguous: true,
          variables: JSON.stringify(variables),
          trapType: generated.trap.type,
          trapTypeName: generated.trap.type_name || null,
          trapSubtype: generated.trap.subtype || null,
          trapSubtypeName: generated.trap.subtype_name || null,
          difficulty,
          causalStructure: generated.causal_structure || null,
          keyInsight: generated.key_insight || null,
          hiddenTimestamp: hidden_timestamp,
          conditionalAnswers: conditional_answers,
          wiseRefusal: generated.wise_refusal || null,
          goldRationale: generated.gold_rationale || null,
          dataset,
          author: 'LLM',
          sourceCase: caseId,
          generationBatchId: batchId,
          isVerified: false,
        },
      });

      return { success: true, scenario: generated.scenario };
    }
    // Handle L3 cases
    else if (taskPearlLevel === 'L3' || meta.trap.pearlLevel === 'L3') {
      const selectedFamily = meta.selectedFamily!;

      // Convert old L3 format to unified format if needed
      if (('groundTruth' in parsed || 'ground_truth' in parsed) && ('family' in parsed) && !('label' in parsed)) {
        const oldFormat = parsed as any;
        const groundTruth = oldFormat.groundTruth || oldFormat.ground_truth;
        generated = {
          scenario: oldFormat.scenario,
          counterfactual_claim: oldFormat.counterfactualClaim || oldFormat.counterfactual_claim,
          label: groundTruth,
          is_ambiguous: groundTruth === 'CONDITIONAL',
          variables: {
            X: oldFormat.variables?.X || '',
            Y: oldFormat.variables?.Y || '',
            Z: Array.isArray(oldFormat.variables?.Z) 
              ? oldFormat.variables.Z 
              : oldFormat.variables?.Z 
              ? [String(oldFormat.variables.Z)] 
              : [],
          },
          trap: {
            type: oldFormat.family || selectedFamily,
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          },
          difficulty: oldFormat.difficulty || 'medium',
          causal_structure: undefined,
          key_insight: undefined,
          hidden_timestamp: undefined,
          conditional_answers: undefined,
          wise_refusal: oldFormat.wiseResponse || oldFormat.wise_response || undefined,
          gold_rationale: oldFormat.justification || undefined,
          invariants: oldFormat.invariants || [],
          domain: oldFormat.domain,
          subdomain: undefined,
        };
      } else {
        generated = parsed as GeneratedT3Case;
        if (generated.variables && !Array.isArray(generated.variables.Z)) {
          generated.variables.Z = generated.variables.Z ? [String(generated.variables.Z)] : [];
        }
        if (!generated.trap) {
          generated.trap = {
            type: selectedFamily,
            type_name: undefined,
            subtype: undefined,
            subtype_name: undefined,
          };
        }
      }

      // Validate L3 fields
      if (!generated.scenario || !generated.counterfactual_claim || !generated.variables || !generated.label || !generated.trap?.type) {
        return { success: false };
      }
      if (!generated.causal_structure || generated.causal_structure.trim() === '') {
        return { success: false };
      }
      if (!['VALID', 'INVALID', 'CONDITIONAL'].includes(generated.label)) {
        return { success: false };
      }
      if (generated.trap.type !== selectedFamily) {
        return { success: false };
      }
      if (!generated.variables.X || !generated.variables.Y) {
        return { success: false };
      }

      if (generated.label === 'CONDITIONAL') {
        const hasHiddenTimestamp = generated.hidden_timestamp && 
          (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
        const condAnswers = generated.conditional_answers;
        const hasConditionalAnswers = condAnswers && 
          (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
            ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
            ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
            : false);
        
        if (!hasHiddenTimestamp || !hasConditionalAnswers) {
          return { success: false };
        }
      }

      const invariants = generated.invariants || [];
      if (!Array.isArray(invariants) || invariants.length === 0) {
        return { success: false };
      }

      const caseId = await getNextGeneratedCaseId();
      const difficultyRaw = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';
      const difficulty = meta.targetDifficulty ?? (difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1));

      const variables = generated.variables || { X: '', Y: '', Z: [] };
      if (!Array.isArray(variables.Z)) {
        variables.Z = variables.Z ? [String(variables.Z)] : [];
      }

      let conditional_answers: string | null = null;
      if (generated.conditional_answers) {
        conditional_answers = typeof generated.conditional_answers === 'string'
          ? generated.conditional_answers
          : JSON.stringify(generated.conditional_answers);
      }

      let hidden_timestamp: string | null = null;
      if (generated.hidden_timestamp) {
        hidden_timestamp = typeof generated.hidden_timestamp === 'string'
          ? generated.hidden_timestamp
          : JSON.stringify(generated.hidden_timestamp);
      }

      const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

      await prisma.t3Case.create({
        data: {
          caseId: generated.case_id || caseId,
          bucket,
          pearlLevel: 'L3',
          domain: generated.domain || currentDomain,
          subdomain: generated.subdomain || currentSubdomain,
          scenario: generated.scenario,
          counterfactualClaim: generated.counterfactual_claim,
          label: generated.label,
          isAmbiguous: generated.is_ambiguous !== undefined ? generated.is_ambiguous : generated.label === 'CONDITIONAL',
          variables: JSON.stringify(variables),
          trapType: generated.trap.type,
          trapTypeName: generated.trap.type_name || null,
          trapSubtype: generated.trap.subtype || null,
          trapSubtypeName: generated.trap.subtype_name || null,
          difficulty,
          causalStructure: generated.causal_structure || null,
          keyInsight: generated.key_insight || null,
          hiddenTimestamp: hidden_timestamp,
          conditionalAnswers: conditional_answers,
          wiseRefusal: generated.wise_refusal || null,
          goldRationale: generated.gold_rationale || null,
          invariants: JSON.stringify(invariants),
          dataset,
          author: 'LLM',
          sourceCase: caseId,
          generationBatchId: batchId,
          isVerified: false,
        },
      });

      return { success: true, scenario: generated.scenario };
    }
    // Handle legacy cases (Question table)
    else {
      generated = parsed as GeneratedQuestion;

      // Validate legacy fields
      const varValues = Object.values(generated.variables || {}).map(v =>
        String(v).toLowerCase().replace(/[^a-z]/g, '')
      );
      const uniqueVars = new Set(varValues);
      if (varValues.length > uniqueVars.size) {
        return { success: false };
      }

      if (generated.variables?.X && generated.variables?.Z) {
        const xWords = String(generated.variables.X).toLowerCase().split(/\s+/);
        const zWords = String(generated.variables.Z).toLowerCase().split(/\s+/);
        const commonWords = xWords.filter(w => w.length > 3 && zWords.includes(w));
        if (commonWords.length >= 2) {
          return { success: false };
        }
      }

      const caseId = await getNextGeneratedCaseId();
      const trap = meta.trap;

      let finalTrapType: string;
      let finalTrapSubtype: string;

      if (validity === 'YES' || validity === 'AMBIGUOUS') {
        finalTrapType = 'NONE';
        finalTrapSubtype = 'NONE';
      } else {
        finalTrapType = trap.trapType;
        finalTrapSubtype = trap.trapSubtype || 'NONE';
      }

      const isAmbiguous = generated.groundTruth === 'AMBIGUOUS';

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
          causalStructure: isAmbiguous ? null : generated.annotations.causalStructure,
          keyInsight: generated.annotations.keyInsight,
          wiseRefusal: generated.wiseRefusal,
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

      return { success: true, scenario: generated.scenario };
    }
  } catch (error) {
    console.error(`[Batch ${batchId}] Error processing batch generation result:`, error);
    return { success: false };
  }
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
  tasks?: GenerationTask[],  // Optional: explicit task list from distribution matrix
  useRevampedL2: boolean = false  // Flag to use revamped L2 generation
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
      data: { status: 'running', current_index: 0 },
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

    // Always use synchronous generation (one at a time) - skip batch API
    const useBatchAPI = false;
    
    // Declare batchResponses outside the if block for fallback access
    let batchResponses: BatchResponse[] | null = null;
    
    if (useBatchAPI) {
      console.log(`[Batch ${batchId}] Using OpenAI Batch API for ${totalTasks} samples (cost savings)`);
      
      // Collect all generation requests
      const requestMetadatas = await collectGenerationRequests(
        totalTasks,
        tasks,
        batchSize,
        indices,
        validityMix,
        pearlLevel,
        fixedDomain,
        promptNotes,
        recentScenarios,
        useRevampedL2,
        dataset
      );

      // Create batch requests
      const batchRequests: BatchRequest[] = requestMetadatas.map((meta, idx) => ({
        custom_id: `gen_${batchId}_${idx}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: meta.systemPrompt },
            { role: 'user', content: meta.prompt },
          ],
          temperature: 0.85,
          response_format: { type: 'json_object' },
        },
      }));

      // Process batch
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: { current_index: totalTasks },
      });
      try {
        batchResponses = await processBatch(batchRequests, (status) => {
          console.log(`[Batch ${batchId}] Batch API status: ${status}`);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
        const isTokenLimitError = (error as any)?.isTokenLimitError || errorMessage.includes('token_limit_exceeded') || errorMessage.includes('Enqueued token limit');
        
        if (isTokenLimitError) {
          // Token limit exceeded - fall back to synchronous processing
          console.warn(`[Batch ${batchId}] Token limit exceeded, falling back to synchronous API calls`);
          batchResponses = null; // Will trigger fallback below
        } else {
          // Other errors - mark as failed
          console.error(`[Batch ${batchId}] Batch API error:`, errorMessage);
          await prisma.generationBatch.update({
            where: { id: batchId },
            data: {
              status: 'failed',
              error_message: errorMessage,
            },
          });
          throw error;
        }
      }

      // Process batch results if available
      if (batchResponses) {
        console.log(`[Batch ${batchId}] Processing ${batchResponses.length} batch results...`);
        
        for (let i = 0; i < batchResponses.length; i++) {
        const response = batchResponses[i];
        const meta = requestMetadatas[i];

        // Check if batch was cancelled
        const currentBatch = await prisma.generationBatch.findUnique({
          where: { id: batchId },
          select: { status: true },
        });
        if (currentBatch?.status === 'cancelled') {
          console.log(`[Batch ${batchId}] Cancelled by user during batch processing`);
          break;
        }

        // Update progress
        await prisma.generationBatch.update({
          where: { id: batchId },
          data: { current_index: i + 1 },
        });

        if (response.error) {
          console.error(`[Batch ${batchId}] Batch API error for request ${i}:`, response.error);
          errorCount++;
          continue;
        }

        const content = response.response?.body?.choices?.[0]?.message?.content;
        if (!content) {
          errorCount++;
          continue;
        }

        try {
          // Process result based on metadata type
          const result = await processBatchGenerationResult(
            batchId,
            content,
            meta,
            dataset,
            recentScenarios
          );

          if (result.success) {
            successCount++;
            await prisma.generationBatch.update({
              where: { id: batchId },
              data: { generated_count: successCount },
            });
            if (result.scenario) {
              recentScenarios.unshift(result.scenario);
              if (recentScenarios.length > 20) recentScenarios.pop();
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`[Batch ${batchId}] Error processing batch result ${i + 1}:`, error);
          errorCount++;
        }
      }

      console.log(`[Batch ${batchId}] Batch API processing completed: ${successCount} successful, ${errorCount} errors`);
      }
    }
    
    // Use synchronous API if batch wasn't used or failed with token limit
    if (!useBatchAPI || batchResponses === null) {
      const difficultySchedule = buildDifficultySchedule(totalTasks);
      // Use synchronous API for small batches (≤10 samples) or fallback
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
        data: { current_index: i + 1 },
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

      const targetDifficulty = difficultySchedule[i];

      if (trap.pearlLevel === 'L1') {
        const evidenceSelection = await selectNextL1Evidence(validity);
        console.log(
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: ${validity} - L1 - ${evidenceSelection?.evidence.code || 'NONE'} - ${currentDomain}/${currentSubdomain} - ${targetDifficulty}`
        );
        const prompt = buildL1Prompt(evidenceSelection, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You generate high-quality causal reasoning training cases. Follow the specifications EXACTLY. Return only valid JSON.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          });

          const content = completion.choices[0].message.content;
          if (!content) {
            errorCount++;
            continue;
          }

          let generated: GeneratedT3Case;
          try {
            // Parse JSON (already in snake_case format from LLM)
            const parsed = JSON.parse(content);
            
            // Convert old format to new unified format if needed
            if (('groundTruth' in parsed || 'ground_truth' in parsed) && !('label' in parsed)) {
              // Old L1 format - convert to unified format
              const oldFormat = parsed as any;
              const groundTruth = oldFormat.groundTruth || oldFormat.ground_truth;
              const evidenceType = oldFormat.evidenceType || oldFormat.evidence_type || (groundTruth === 'AMBIGUOUS' ? 'A' : null);
              
              generated = {
                scenario: oldFormat.scenario,
                claim: oldFormat.claim,
                label: groundTruth,
                is_ambiguous: groundTruth === 'AMBIGUOUS',
                variables: {
                  X: oldFormat.variables?.X || '',
                  Y: oldFormat.variables?.Y || '',
                  Z: Array.isArray(oldFormat.variables?.Z) 
                    ? oldFormat.variables.Z 
                    : oldFormat.variables?.Z 
                    ? [String(oldFormat.variables.Z)] 
                    : [],
                },
                trap: {
                  type: evidenceType || 'A',
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                },
                difficulty: oldFormat.difficulty || 'medium',
                causal_structure: oldFormat.causalStructure || oldFormat.causal_structure || undefined,
                key_insight: undefined,
                hidden_timestamp: undefined,
                conditional_answers: undefined,
                wise_refusal: undefined,
                gold_rationale: oldFormat.whyFlawedOrValid || oldFormat.why_flawed_or_valid || undefined,
                domain: oldFormat.domain,
                subdomain: oldFormat.subdomain,
              };
              console.log(`[Batch ${batchId}] Converted old format to unified format`);
            } else {
              // Already in unified format (snake_case) - ensure all required fields are present
              generated = parsed as GeneratedT3Case;
              
              // Ensure variables.Z is an array
              if (generated.variables && !Array.isArray(generated.variables.Z)) {
                generated.variables.Z = generated.variables.Z 
                  ? [String(generated.variables.Z)] 
                  : [];
              }
              
              // Ensure trap object exists
              if (!generated.trap) {
                generated.trap = {
                  type: '',
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                };
              }
            }
          } catch (parseError) {
            console.error(`[Batch ${batchId}] JSON parse error:`, parseError);
            errorCount++;
            continue;
          }

          // Validate required fields for unified schema
          if (!generated.scenario || !generated.claim || !generated.label || !generated.trap?.type) {
            console.log(`[Batch ${batchId}] Skipping: missing required unified schema fields:`, {
              hasScenario: !!generated.scenario,
              hasClaim: !!generated.claim,
              hasLabel: !!generated.label,
              hasTrapType: !!generated.trap?.type,
            });
            errorCount++;
            continue;
          }

          // Validate causal_structure is present (required for all cases)
          if (!generated.causal_structure || generated.causal_structure.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty causal_structure (required for all cases)`);
            errorCount++;
            continue;
          }

          // Validate claim is present (required for all cases)
          if (!generated.claim || generated.claim.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty claim (required for all cases)`);
            errorCount++;
            continue;
          }

          // Validate label matches expected validity
          const expectedLabel = validity === 'YES' ? 'YES' : validity === 'NO' ? 'NO' : 'AMBIGUOUS';
          if (generated.label !== expectedLabel) {
            console.log(`[Batch ${batchId}] Skipping: label mismatch expected=${expectedLabel} got=${generated.label}`);
            errorCount++;
            continue;
          }

          // Validate hidden_timestamp and conditional_answers are both present for AMBIGUOUS L1 cases
          if (generated.label === 'AMBIGUOUS') {
            const hasHiddenTimestamp = generated.hidden_timestamp && 
              (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
            const condAnswers = generated.conditional_answers;
            const hasConditionalAnswers = condAnswers && 
              (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
                ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
                ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
                : false);
            
            if (!hasHiddenTimestamp || !hasConditionalAnswers) {
              console.log(`[Batch ${batchId}] Skipping: AMBIGUOUS L1 case must have both hidden_timestamp and conditional_answers`);
              errorCount++;
              continue;
            }
          }

          // Validate trap type for L1
          const expectedClass = validityToEvidenceClass(validity);
          if (expectedClass === 'WOLF' && !generated.trap.type.match(/^W[1-9]|W10$/)) {
            console.log(`[Batch ${batchId}] Skipping: WOLF case must have trap type W1-W10, got ${generated.trap.type}`);
            errorCount++;
            continue;
          }
          if (expectedClass === 'SHEEP' && !generated.trap.type.match(/^S[1-8]$/)) {
            console.log(`[Batch ${batchId}] Skipping: SHEEP case must have trap type S1-S8, got ${generated.trap.type}`);
            errorCount++;
            continue;
          }
          if (expectedClass === 'NONE' && generated.label === 'AMBIGUOUS' && generated.trap.type !== null && generated.trap.type !== '' && generated.trap.type !== 'A') {
            console.log(`[Batch ${batchId}] Skipping: AMBIGUOUS case must have trap type null (not set), got ${generated.trap.type}`);
            errorCount++;
            continue;
          }

          // Validate evidence type if specified
          if (evidenceSelection?.evidence.code && generated.trap.type !== evidenceSelection.evidence.code) {
            console.log(
              `[Batch ${batchId}] Skipping: trap type mismatch expected=${evidenceSelection.evidence.code} got=${generated.trap.type}`
            );
            errorCount++;
            continue;
          }

          const caseId = await getNextGeneratedCaseId();
          const difficultyFromGenerated = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 
            (evidenceSelection ? inferDifficultyForL1(evidenceSelection.evidence) : 'medium');
          const difficultyToStore = targetDifficulty ?? (difficultyFromGenerated.charAt(0).toUpperCase() + difficultyFromGenerated.slice(1));

          // Ensure variables.Z is always an array (unified schema requirement)
          const variables = generated.variables || { X: '', Y: '', Z: [] };
          if (!Array.isArray(variables.Z)) {
            variables.Z = variables.Z ? [String(variables.Z)] : [];
          }

          // Prepare conditional answers
          let conditional_answers: string | null = null;
          if (generated.conditional_answers) {
            conditional_answers = typeof generated.conditional_answers === 'string' 
              ? generated.conditional_answers 
              : JSON.stringify(generated.conditional_answers);
          }

          // Prepare hidden timestamp
          let hidden_timestamp: string | null = null;
          if (generated.hidden_timestamp) {
            hidden_timestamp = typeof generated.hidden_timestamp === 'string'
              ? generated.hidden_timestamp
              : JSON.stringify(generated.hidden_timestamp);
          }

          // Generate bucket identifier (Table 9 format)
          const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

          // Ensure all required fields from Table 9 are present
          const t3CaseData = {
            case_id: generated.case_id || caseId,
            bucket,
            pearl_level: 'L1' as const,
            domain: generated.domain || currentDomain,
            subdomain: generated.subdomain || currentSubdomain,
            scenario: generated.scenario,
            claim: generated.claim || '', // Required for L1
            label: generated.label,
            is_ambiguous: generated.is_ambiguous !== undefined ? generated.is_ambiguous : generated.label === 'AMBIGUOUS',
            variables: JSON.stringify(variables),
            trap_type: generated.trap.type,
            trap_type_name: generated.trap.type_name || null,
            trap_subtype: generated.trap.subtype || null,
            trap_subtype_name: generated.trap.subtype_name || null,
            difficulty: difficultyToStore,
            causal_structure: generated.causal_structure || null,
            key_insight: generated.key_insight || null,
            hidden_timestamp,
            conditional_answers,
            wise_refusal: generated.wise_refusal || null,
            gold_rationale: generated.gold_rationale || null,
            dataset,
            author: 'LLM',
            source_case: caseId,
            generation_batch_id: batchId,
            is_verified: false,
          };

          await prisma.t3Case.create({
            data: t3CaseData,
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generated_count: successCount },
          });

          recentScenarios.unshift(generated.scenario);
          if (recentScenarios.length > 20) recentScenarios.pop();
        } catch (error) {
          console.error(`[Batch ${batchId}] Error generating L1 case ${i + 1}:`, error);
          errorCount++;
        }
      } else if (taskPearlLevel === 'L2' || (trap.pearlLevel === 'L2' && useRevampedL2)) {
        // Revamped L2 generation path (T1-T17)
        const selectedTrapType = await selectNextL2TrapType(dataset);
        console.log(
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: L2 (revamped) - ${selectedTrapType} - ${currentDomain}/${currentSubdomain} - ${targetDifficulty}`
        );
        const prompt = buildL2Prompt(selectedTrapType, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You generate high-quality L2 causal disambiguation cases. Include: trap type, a **scenario-specific** pivotal hidden question (hidden_timestamp — reference concrete X, Y, Z, domain, or narrative; do NOT use the generic taxonomy pattern verbatim), mutually exclusive and exhaustive conditional answers, and a 4-part wise refusal. Z is required in every case (non-empty array). Follow the specifications EXACTLY. Return only valid JSON.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          });

          const content = completion.choices[0].message.content;
          if (!content) {
            errorCount++;
            continue;
          }

          let generated: GeneratedT3Case;
            try {
            const parsed = JSON.parse(content);
            
            // Parse JSON (already in snake_case format from LLM)
            // Convert old L2 format to unified format if needed
            if (('hiddenQuestion' in parsed || 'hidden_question' in parsed) && ('answerIfA' in parsed || 'answer_if_a' in parsed) && !('trap' in parsed)) {
              const oldFormat = parsed as any;
              generated = {
                scenario: oldFormat.scenario,
                claim: oldFormat.claim || '',
                label: 'NO',
                is_ambiguous: true,
                variables: {
                  X: oldFormat.variables?.X || '',
                  Y: oldFormat.variables?.Y || '',
                  Z: Array.isArray(oldFormat.variables?.Z) 
                    ? oldFormat.variables.Z 
                    : oldFormat.variables?.Z 
                    ? [String(oldFormat.variables.Z)] 
                    : [],
                },
                trap: {
                  type: oldFormat.annotations?.trapType || oldFormat.annotations?.trap_type || selectedTrapType,
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                },
                difficulty: oldFormat.annotations?.difficulty || 'medium',
                causal_structure: oldFormat.annotations?.causalStructure || oldFormat.annotations?.causal_structure || undefined,
                key_insight: undefined,
                hidden_timestamp: oldFormat.hiddenQuestion || oldFormat.hidden_question || undefined,
                conditional_answers: (oldFormat.answerIfA || oldFormat.answer_if_a) && (oldFormat.answerIfB || oldFormat.answer_if_b)
                  ? { answer_if_condition_1: oldFormat.answerIfA || oldFormat.answer_if_a, answer_if_condition_2: oldFormat.answerIfB || oldFormat.answer_if_b }
                  : undefined,
                wise_refusal: oldFormat.wiseRefusal || oldFormat.wise_refusal || undefined,
                gold_rationale: undefined,
                domain: undefined,
                subdomain: undefined,
              };
              console.log(`[Batch ${batchId}] Converted old L2 format to unified format`);
            } else {
              // Already in unified format (snake_case)
              generated = parsed as GeneratedT3Case;
              // Ensure variables.Z is an array
              if (generated.variables && !Array.isArray(generated.variables.Z)) {
                generated.variables.Z = generated.variables.Z 
                  ? [String(generated.variables.Z)] 
                  : [];
              }
              // Ensure trap object exists
              if (!generated.trap) {
                generated.trap = {
                  type: selectedTrapType,
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                };
              }
            }
          } catch (parseError) {
            console.error(`[Batch ${batchId}] JSON parse error:`, parseError);
            errorCount++;
            continue;
          }

          // Validate required fields for unified schema
          if (!generated.scenario || !generated.claim || !generated.label || !generated.trap?.type) {
            console.log(`[Batch ${batchId}] Skipping: missing required unified schema fields`);
            errorCount++;
            continue;
          }

          // Validate causal_structure is present (required for all cases)
          if (!generated.causal_structure || generated.causal_structure.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty causal_structure (required for all cases)`);
            errorCount++;
            continue;
          }

          // Validate claim is present (required for all cases)
          if (!generated.claim || generated.claim.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty claim (required for all cases)`);
            errorCount++;
            continue;
          }

          // Validate label is NO for L2
          if (generated.label !== 'NO') {
            console.log(`[Batch ${batchId}] Skipping: L2 case must have label=NO, got ${generated.label}`);
            errorCount++;
            continue;
          }

          // Validate trap type matches
          if (generated.trap.type !== selectedTrapType) {
            console.log(`[Batch ${batchId}] Skipping: trap type mismatch expected=${selectedTrapType} got=${generated.trap.type}`);
            errorCount++;
            continue;
          }

          // Validate variables
          if (!generated.variables?.X || !generated.variables?.Y) {
            console.log(`[Batch ${batchId}] Skipping: missing X or Y variables`);
            errorCount++;
            continue;
          }
          const zArr = Array.isArray(generated.variables.Z) ? generated.variables.Z : (generated.variables.Z ? [String(generated.variables.Z)] : []);
          if (!zArr.length) {
            console.log(`[Batch ${batchId}] Skipping: L2 case must have non-empty variables.Z (spec requires Z in every L2 case)`);
            errorCount++;
            continue;
          }

          // Validate hidden_timestamp and conditional_answers are both present for L2
          const hasHiddenTimestamp = generated.hidden_timestamp && 
            (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
          const condAnswers = generated.conditional_answers;
          const hasConditionalAnswers = condAnswers && 
            (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
              ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
              ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
              : false);
          
          if (!hasHiddenTimestamp || !hasConditionalAnswers) {
            console.log(`[Batch ${batchId}] Skipping: L2 case must have both hidden_timestamp and conditional_answers`);
            errorCount++;
            continue;
          }

          const caseId = await getNextGeneratedCaseId();
          const difficultyRaw = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';
          const difficultyToStore = targetDifficulty ?? (difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1));

          // Ensure variables.Z is always an array (already validated non-empty above)
          const variables = generated.variables || { X: '', Y: '', Z: [] };
          if (!Array.isArray(variables.Z)) {
            variables.Z = variables.Z ? [String(variables.Z)] : zArr;
          }
          if (!variables.Z.length) variables.Z = zArr;

          // Prepare conditional answers from unified format
          let conditional_answers: string | null = null;
          if (generated.conditional_answers) {
            conditional_answers = typeof generated.conditional_answers === 'string'
              ? generated.conditional_answers
              : JSON.stringify(generated.conditional_answers);
          }

          // Prepare hidden timestamp
          let hidden_timestamp: string | null = null;
          if (generated.hidden_timestamp) {
            hidden_timestamp = typeof generated.hidden_timestamp === 'string'
              ? generated.hidden_timestamp
              : JSON.stringify(generated.hidden_timestamp);
          }

          // Generate bucket identifier
          const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

          await prisma.t3Case.create({
            data: {
              case_id: generated.case_id || caseId,
              bucket,
              pearl_level: 'L2',
              domain: generated.domain || currentDomain,
              subdomain: generated.subdomain || currentSubdomain,
              scenario: generated.scenario,
              claim: generated.claim,
              label: 'NO',
              is_ambiguous: true, // L2 cases are ambiguous by nature
              variables: JSON.stringify(variables),
              trap_type: generated.trap.type,
              trap_type_name: generated.trap.type_name || null,
              trap_subtype: generated.trap.subtype || null,
              trap_subtype_name: generated.trap.subtype_name || null,
              difficulty: difficultyToStore,
              causal_structure: generated.causal_structure || null,
              key_insight: generated.key_insight || null,
              hidden_timestamp,
              conditional_answers,
              wise_refusal: generated.wise_refusal || null,
              gold_rationale: generated.gold_rationale || null,
              dataset,
              author: 'LLM',
              source_case: caseId,
              generation_batch_id: batchId,
              is_verified: false,
            },
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generated_count: successCount },
          });

          recentScenarios.unshift(generated.scenario);
          if (recentScenarios.length > 20) recentScenarios.pop();
        } catch (error) {
          console.error(`[Batch ${batchId}] Error generating L2 case ${i + 1}:`, error);
          errorCount++;
        }
      } else if (taskPearlLevel === 'L3') {
        // Revamped L3 generation path (F1-F8 families)
        const selectedFamily = await selectNextL3Family(dataset);
        console.log(
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: ${validity} - L3 (revamped) - ${selectedFamily} - ${currentDomain}/${currentSubdomain} - ${targetDifficulty}`
        );
        const prompt = buildL3Prompt(selectedFamily, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes, targetDifficulty);

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You generate high-quality L3 counterfactual reasoning cases with explicit alternative worlds and invariants. Follow the specifications EXACTLY. Return only valid JSON.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          });

          const content = completion.choices[0].message.content;
          if (!content) {
            errorCount++;
            continue;
          }

          let generated: GeneratedT3Case;
          try {
            const parsed = JSON.parse(content);
            
            // Parse JSON (already in snake_case format from LLM)
            // Convert old L3 format to unified format if needed
            if (('groundTruth' in parsed || 'ground_truth' in parsed) && ('family' in parsed) && !('label' in parsed)) {
              const oldFormat = parsed as any;
              const groundTruth = oldFormat.groundTruth || oldFormat.ground_truth;
              generated = {
                scenario: oldFormat.scenario,
                counterfactual_claim: oldFormat.counterfactualClaim || oldFormat.counterfactual_claim,
                label: groundTruth,
                is_ambiguous: groundTruth === 'CONDITIONAL',
                variables: {
                  X: oldFormat.variables?.X || '',
                  Y: oldFormat.variables?.Y || '',
                  Z: Array.isArray(oldFormat.variables?.Z) 
                    ? oldFormat.variables.Z 
                    : oldFormat.variables?.Z 
                    ? [String(oldFormat.variables.Z)] 
                    : [],
                },
                trap: {
                  type: oldFormat.family || selectedFamily,
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                },
                difficulty: oldFormat.difficulty || 'medium',
                causal_structure: undefined,
                key_insight: undefined,
                hidden_timestamp: undefined,
                conditional_answers: undefined,
                wise_refusal: oldFormat.wiseResponse || oldFormat.wise_response || undefined,
                gold_rationale: oldFormat.justification || undefined,
                invariants: oldFormat.invariants || [],
                domain: oldFormat.domain,
                subdomain: undefined,
              };
              console.log(`[Batch ${batchId}] Converted old L3 format to unified format`);
            } else {
              // Already in unified format (snake_case)
              generated = parsed as GeneratedT3Case;
              // Ensure variables.Z is an array
              if (generated.variables && !Array.isArray(generated.variables.Z)) {
                generated.variables.Z = generated.variables.Z 
                  ? [String(generated.variables.Z)] 
                  : [];
              }
              // Ensure trap object exists
              if (!generated.trap) {
                generated.trap = {
                  type: selectedFamily,
                  type_name: undefined,
                  subtype: undefined,
                  subtype_name: undefined,
                };
              }
            }
          } catch (parseError) {
            console.error(`[Batch ${batchId}] JSON parse error:`, parseError);
            errorCount++;
            continue;
          }

          // Validate required fields for unified schema
          if (
            !generated.scenario ||
            !generated.counterfactual_claim ||
            !generated.variables ||
            !generated.label ||
            !generated.trap?.type
          ) {
            console.log(`[Batch ${batchId}] Skipping: missing required unified schema fields`);
            errorCount++;
            continue;
          }

          // Validate causal_structure is present (required for all cases)
          if (!generated.causal_structure || generated.causal_structure.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty causal_structure (required for all cases)`);
            errorCount++;
            continue;
          }

          // Validate counterfactual_claim is present (required for all L3 cases)
          if (!generated.counterfactual_claim || generated.counterfactual_claim.trim() === '') {
            console.log(`[Batch ${batchId}] Skipping: missing or empty counterfactual_claim (required for all L3 cases)`);
            errorCount++;
            continue;
          }

          // Validate label is valid L3 label
          if (!['VALID', 'INVALID', 'CONDITIONAL'].includes(generated.label)) {
            console.log(`[Batch ${batchId}] Skipping: invalid label=${generated.label}, must be VALID/INVALID/CONDITIONAL`);
            errorCount++;
            continue;
          }

          // Validate hidden_timestamp and conditional_answers are both present for CONDITIONAL L3 cases
          if (generated.label === 'CONDITIONAL') {
            const hasHiddenTimestamp = generated.hidden_timestamp && 
              (typeof generated.hidden_timestamp === 'string' ? generated.hidden_timestamp.trim() !== '' : true);
            const condAnswers = generated.conditional_answers;
            const hasConditionalAnswers = condAnswers && 
              (typeof condAnswers === 'object' && condAnswers !== null && !Array.isArray(condAnswers) ? 
                ((condAnswers as any).answer_if_condition_1 || (condAnswers as any).answerIfA) &&
                ((condAnswers as any).answer_if_condition_2 || (condAnswers as any).answerIfB)
                : false);
            
            if (!hasHiddenTimestamp || !hasConditionalAnswers) {
              console.log(`[Batch ${batchId}] Skipping: CONDITIONAL L3 case must have both hidden_timestamp and conditional_answers`);
              errorCount++;
              continue;
            }
          }

          // Validate trap type matches family
          if (generated.trap.type !== selectedFamily) {
            console.log(`[Batch ${batchId}] Skipping: trap type mismatch expected=${selectedFamily} got=${generated.trap.type}`);
            errorCount++;
            continue;
          }

          // Validate variables
          if (!generated.variables.X || !generated.variables.Y) {
            console.log(`[Batch ${batchId}] Skipping: missing X or Y variables`);
            errorCount++;
            continue;
          }

          // Ensure variables.Z is always an array
          const variables = generated.variables || { X: '', Y: '', Z: [] };
          if (!Array.isArray(variables.Z)) {
            variables.Z = variables.Z ? [String(variables.Z)] : [];
          }

          // Validate invariants
          const invariants = generated.invariants || [];
          if (!Array.isArray(invariants) || invariants.length === 0) {
            console.log(`[Batch ${batchId}] Skipping: invariants must be a non-empty array`);
            errorCount++;
            continue;
          }

          const caseId = await getNextGeneratedCaseId();
          const difficultyRaw = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';
          const difficultyToStore = targetDifficulty ?? (difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1));

          // Prepare conditional answers
          let conditional_answers: string | null = null;
          if (generated.conditional_answers) {
            conditional_answers = typeof generated.conditional_answers === 'string'
              ? generated.conditional_answers
              : JSON.stringify(generated.conditional_answers);
          }

          // Prepare hidden timestamp
          let hidden_timestamp: string | null = null;
          if (generated.hidden_timestamp) {
            hidden_timestamp = typeof generated.hidden_timestamp === 'string'
              ? generated.hidden_timestamp
              : JSON.stringify(generated.hidden_timestamp);
          }

          // Generate bucket identifier
          const bucket = `BucketLarge-${currentDomain.charAt(0)}`;

          await prisma.t3Case.create({
            data: {
              case_id: generated.case_id || caseId,
              bucket,
              pearl_level: 'L3',
              domain: generated.domain || currentDomain,
              subdomain: generated.subdomain || currentSubdomain,
              scenario: generated.scenario,
              counterfactual_claim: generated.counterfactual_claim,
              label: generated.label,
              is_ambiguous: generated.is_ambiguous !== undefined ? generated.is_ambiguous : generated.label === 'CONDITIONAL',
              variables: JSON.stringify(variables),
              trap_type: generated.trap.type,
              trap_type_name: generated.trap.type_name || null,
              trap_subtype: generated.trap.subtype || null,
              trap_subtype_name: generated.trap.subtype_name || null,
              difficulty: difficultyToStore,
              causal_structure: generated.causal_structure || null,
              key_insight: generated.key_insight || null,
              hidden_timestamp,
              conditional_answers,
              wise_refusal: generated.wise_refusal || null,
              gold_rationale: generated.gold_rationale || null,
              invariants: JSON.stringify(invariants),
              dataset,
              author: 'LLM',
              source_case: caseId,
              generation_batch_id: batchId,
              is_verified: false,
            },
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generated_count: successCount },
          });

          recentScenarios.unshift(generated.scenario);
          if (recentScenarios.length > 20) recentScenarios.pop();
        } catch (error) {
          console.error(`[Batch ${batchId}] Error generating L3 case ${i + 1}:`, error);
          errorCount++;
        }
      } else {
        // Legacy L2/L3 generation path (Question table)
        console.log(
          `[Batch ${batchId}] Generating ${i + 1}/${batchSize}: ${validity} - ${trap.pearlLevel} - ${trap.trapType} - ${
            trap.trapSubtype || 'No subtype'
          } - ${currentDomain}/${currentSubdomain}`
        );
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

          const caseId = await getNextGeneratedCaseId();

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
              pearl_level: trap.pearlLevel,
              domain: generated.annotations.domain,
              subdomain: generated.annotations.subdomain,
              trap_type: finalTrapType,
              trap_subtype: finalTrapSubtype || 'NONE',
              explanation: generated.explanation,
              difficulty: generated.annotations.difficulty?.toLowerCase() || 'medium',
              ground_truth: generated.groundTruth,
              variables: JSON.stringify(generated.variables),
              // No causal_structure for AMBIGUOUS cases
              causal_structure: isAmbiguous ? null : generated.annotations.causalStructure,
              key_insight: generated.annotations.keyInsight,
              wise_refusal: generated.wiseRefusal,
              // AMBIGUOUS-specific fields
              hidden_timestamp: isAmbiguous ? (generated.hiddenTimestamp || 'TBD') : 'N/A',
              conditional_answers: isAmbiguous
                ? (generated.conditionalAnswers ? JSON.stringify(generated.conditionalAnswers) : 'TBD')
                : 'N/A',
              author: 'LLM',
              source_case: caseId,
              is_llm_generated: true,
              is_verified: false,
              generation_batch_id: batchId,
              dataset: dataset,
            },
          });

          successCount++;

          // Update generated count
          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generated_count: successCount },
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
        data: { generated_count: successCount },
      });
      console.log(`[Batch ${batchId}] Cancelled: ${successCount} generated before cancellation`);
    } else {
      // Mark as completed
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          completed_at: new Date(),
          generated_count: successCount,
        },
      });
      console.log(`[Batch ${batchId}] Completed: ${successCount} generated, ${errorCount} errors`);
    }
  }  
} catch (error) {
    console.error(`[Batch ${batchId}] Fatal error:`, error);
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date(),
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { pearlLevel, domain, batchSize, promptNotes, validityMix, dataset, distributionMatrix, useRevampedL2 } = body;

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
        const cfg: any = (distributionMatrix as any)[level];
        if (cfg) {
          const counts = [];
          if (level === 'L1') {
            if (cfg.yes) counts.push(`${cfg.yes} YES`);
            if (cfg.no) counts.push(`${cfg.no} NO`);
            if (cfg.ambiguous) counts.push(`${cfg.ambiguous} AMB`);
          } else if (level === 'L2') {
            if (cfg.ambiguous) counts.push(`${cfg.ambiguous} AMB`);
          } else if (level === 'L3') {
            if (cfg.valid) counts.push(`${cfg.valid} VALID`);
            if (cfg.invalid) counts.push(`${cfg.invalid} INVALID`);
            if (cfg.conditional) counts.push(`${cfg.conditional} COND`);
          }
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
    // Include both Question and T3Case scenarios
    const [questionScenarios, t3Scenarios] = await Promise.all([
      prisma.question.findMany({
        where: { dataset: datasetName },
        select: { scenario: true },
        take: 10,
        orderBy: { created_at: 'desc' },
      }),
      prisma.t3Case.findMany({
        where: { dataset: datasetName },
        select: { scenario: true },
        take: 10,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Pass full scenarios as array for better diversity matching
    const initialScenarios = [
      ...questionScenarios.map(q => q.scenario),
      ...t3Scenarios.map(c => c.scenario),
    ].slice(0, 20);

    // Create generation batch record
    const batch = await prisma.generationBatch.create({
      data: {
        pearl_level: distributionMatrix ? 'MATRIX' : (pearlLevel || null),
        domain: domain || null,
        requested_count: effectiveSize,
        generated_count: 0,
        status: 'pending',
        current_index: 0,
        prompt_notes: distributionMatrix ? `Matrix: ${matrixSummary}` : (promptNotes || null),
        created_by_id: null,
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
        tasks,  // Pass tasks if using distribution matrix
        useRevampedL2 || false  // Pass useRevampedL2 flag
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
