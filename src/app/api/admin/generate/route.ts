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

// Get domain-specific context to seed scenario generation
function getDomainContext(domain: GenerationDomain, subdomain: string): string {
  const domainContexts: Record<GenerationDomain, {
    terminology: string[];
    actors: string[];
    commonScenarios: string[];
    causalPatterns: string[];
  }> = {
    Markets: {
      terminology: ['returns', 'volatility', 'liquidity', 'spread', 'yield', 'portfolio', 'asset allocation', 'risk-adjusted', 'correlation', 'beta', 'alpha', 'sharpe ratio'],
      actors: ['portfolio manager', 'trader', 'analyst', 'hedge fund manager', 'risk officer', 'investment advisor', 'quantitative researcher'],
      commonScenarios: ['market movements', 'trading strategies', 'portfolio performance', 'risk management', 'regulatory changes', 'economic indicators'],
      causalPatterns: ['market conditions affecting returns', 'trading volume influencing prices', 'regulatory changes impacting behavior', 'risk factors driving outcomes'],
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

function validityToEvidenceClass(validity: ValidityType): EvidenceClass {
  if (validity === 'YES') return 'SHEEP';
  if (validity === 'NO') return 'WOLF';
  return 'NONE';
}

async function selectNextL1Evidence(validity: ValidityType): Promise<L1EvidenceSelection | null> {
  const cls = validityToEvidenceClass(validity);
  if (cls === 'NONE') return null;

  const evidenceTypes = getL1EvidenceByClass(cls);
  // Count existing by evidenceType (code) to promote diversity
  const existing = await prisma.l1Case.findMany({
    where: {
      evidenceClass: cls,
      evidenceType: { not: null },
    },
    select: { evidenceType: true },
  });
  const counts: Record<string, number> = {};
  evidenceTypes.forEach(e => {
    counts[e.code] = 0;
  });
  existing.forEach(row => {
    const key = row.evidenceType || '';
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
  
  // Count existing L2 cases by trapType in this dataset
  const existing = await prisma.l2Case.findMany({
    where: { dataset },
    select: { trapType: true },
  });
  
  const counts: Record<string, number> = {};
  allTraps.forEach(t => { counts[t] = 0; });
  existing.forEach(row => {
    if (row.trapType && counts[row.trapType] !== undefined) {
      counts[row.trapType]++;
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
  
  // Count existing L3 cases by family in this dataset
  const existing = await prisma.l3Case.findMany({
    where: { dataset },
    select: { family: true },
  });
  
  const counts: Record<string, number> = {};
  allFamilies.forEach(f => { counts[f] = 0; });
  existing.forEach(row => {
    if (row.family && counts[row.family] !== undefined) {
      counts[row.family]++;
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

function buildL1Prompt(
  evidenceSelection: L1EvidenceSelection | null,
  validity: ValidityType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string
): string {
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

CANONICAL STRUCTURE (follow this narrative pattern):
${evidence.canonicalStructure.map(s => `  - ${s}`).join('\n')}

DESIGN NOTES (critical guidance for implementation):
${evidence.designNotes.map(n => `  - ${n}`).join('\n')}
${evidence.keySignalWords?.length ? `- KEY SIGNAL WORDS to incorporate naturally: ${evidence.keySignalWords.join(', ')}` : ''}

IMPLIED GROUND TRUTH: ${evidence.impliedGroundTruth} (this evidence type maps to groundTruth="${evidence.impliedGroundTruth}")
`
    : `
EVIDENCE TYPE:
- evidenceClass: NONE
- evidenceType: null
- This is an AMBIGUOUS case where the scenario lacks sufficient information to determine validity.
`;

  const groundTruthRules = `GROUND TRUTH + EVIDENCE RULES (MUST OBEY):
- If evidenceClass=WOLF then groundTruth MUST be "NO"
- If evidenceClass=SHEEP then groundTruth MUST be "YES"
- If groundTruth="AMBIGUOUS" then evidenceClass MUST be "NONE" and evidenceType MUST be null
`;

  const claimRule = `CLAIM LANGUAGE (L1 T3 update):
- The claim MUST use explicit causal language ("X causes Y", "X increases Y", "X leads to Y").
`;

  return `You are generating ONE T3-L1 causal reasoning case.

MANDATORY SPECIFICATIONS:
- Pearl Level: L1 (Association-level evidence, but the claim is explicitly causal)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Target: ${validity} (this must match groundTruth after applying evidence rules)

${domainContext}

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

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Scenario narrative (2-4 sentences) using inline (X),(Y),(Z) notation",
  "claim": "Explicit causal claim using 'causes/leads to/increases/decreases'",
  "groundTruth": "YES|NO|AMBIGUOUS",
  "evidenceClass": "WOLF|SHEEP|NONE",
  "evidenceType": "W1|W2|...|W10|S1|...|S8|null",
  "whyFlawedOrValid": "Why flawed/valid (60-120 words)",
  "domain": "${domain}",
  "subdomain": "${subdomain}",
  "difficulty": "easy|medium|hard",
  "variables": {
    "X": "Primary cause variable",
    "Y": "Outcome variable",
    "Z": "Optional: single additional variable (e.g., confounder/context/selection/collider) if needed"
  },
  "causalStructure": "Optional: causal edges only, e.g. 'Z -> X, Z -> Y' (null allowed)"
}

Return ONLY valid JSON.`;
}

function buildL2Prompt(
  trapType: L2TrapType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string
): string {
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

CORE HIDDEN QUESTION (this is the key ambiguity):
- Core Hidden Question: ${trapDef.coreHiddenQuestion}
- Hidden Question Pattern: "${trapDef.hiddenQuestionPattern}" (your hiddenQuestion MUST match this pattern exactly)

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

  return `You are generating ONE L2 causal reasoning case (revamped schema).

MANDATORY SPECIFICATIONS:
- Pearl Level: L2 (Intervention-level reasoning)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Trap Type: ${trapType} (${trapDef.name})

${domainContext}

L2 CASE STRUCTURE (Revamped):
- Scenario: Narrative (3-6 sentences) describing a situation with X, Y, and optionally Z clearly labeled inline as (X), (Y), (Z)
- Variables: X (exposure/intervention), Y (outcome), Z (ambiguous - could be confounder, mediator, collider, etc.)
- Hidden Question: The critical question that must be asked to resolve the ambiguity (must align with "${trapDef.hiddenQuestionPattern}")
- Answer if A: Interpretation when condition A is true (one coherent world)
- Answer if B: Interpretation when condition B is true (alternative coherent world)
- Wise Refusal: A refusal to answer definitively, explaining what information is missing and why it matters

CRITICAL REQUIREMENTS:
1. The scenario must make the causal structure PLAUSIBLE but UNRESOLVED
2. The hidden question MUST match the pattern: "${trapDef.hiddenQuestionPattern}"
3. Answer if A and Answer if B must be MUTUALLY EXCLUSIVE and COHERENT
4. The wise refusal must be a REFUSAL (not a verdict) - it should explain what's missing
5. Variables X, Y, Z must be clearly labeled in the narrative using (X), (Y), (Z) notation
6. The scenario must support TWO coherent conditional worlds (A and B)
7. Use domain-appropriate terminology from ${subdomain} to make the scenario feel authentic and grounded

${trapBlock}

${promptNotes ? `ADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}
${diversityBlock}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Narrative with X, Y, Z labeled inline as (X), (Y), (Z). Make causal structure plausible but unresolved.",
  "variables": {
    "X": "Exposure/intervention variable",
    "Y": "Outcome variable",
    "Z": "Ambiguous variable (confounder/mediator/collider/etc.)"
  },
  "annotations": {
    "trapType": "${trapType}",
    "difficulty": "easy|medium|hard",
    "causalStructure": "Causal diagram edges, e.g. 'X -> Y, Z -> X, Z -> Y' or 'X -> Z -> Y' (optional)"
  },
  "hiddenQuestion": "The critical question that must be asked (must match pattern: ${trapDef.hiddenQuestionPattern})",
  "answerIfA": "Complete interpretation when condition A is true (one coherent world)",
  "answerIfB": "Complete interpretation when condition B is true (alternative coherent world)",
  "wiseRefusal": "A refusal explaining what information is missing and why it matters (NOT a verdict)"
}

Return ONLY valid JSON.`;
}

function buildL3Prompt(
  family: L3Family,
  validity: ValidityType,
  domain: GenerationDomain,
  subdomain: string,
  recentScenarios: string[],
  promptNotes?: string
): string {
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

  return `You are generating ONE T3-L3 counterfactual reasoning case.

MANDATORY SPECIFICATIONS:
- Pearl Level: L3 (Counterfactual-level reasoning)
- Domain: ${domain}
- REQUIRED Subdomain: ${subdomain} (YOU MUST set this scenario specifically in ${subdomain} - use subdomain-specific terminology, actors, and contexts)
- Family: ${family} (${familyDef.name})
- Target Ground Truth: ${l3GroundTruth} (this must match groundTruth after applying family logic)

${domainContext}

COUNTERFACTUAL-SPECIFIC DOMAIN GUIDANCE:
When creating counterfactual scenarios in ${subdomain}, consider:
- What mechanisms or rules govern causality in this subdomain?
- What would be plausible alternative worlds given ${subdomain} constraints?
- How do invariants (rules, mechanisms, structures) apply in ${domain.toLowerCase()} contexts?
- What domain-specific terminology captures counterfactual reasoning (e.g., "would have", "had X not occurred", "alternative scenario")?

GLOBAL L3 DESIGN CONSTRAINTS (apply to all families):
1. Explicit alternative world: Every case must be evaluable via:
   - Abduction (infer latent state)
   - Action (modify X)
   - Prediction (propagate under invariants)

2. Invariant sensitivity: Labels depend on whether stated invariants pin down the counterfactual mechanism.

3. Label semantics:
   - VALID → X is counterfactually relevant to Y under stated invariants
   - INVALID → Y is invariant to X under stated invariants
   - CONDITIONAL → missing or ambiguous invariants permit multiple defensible answers

Your generator should NEVER rely on external knowledge; all causal force must be internal to the scenario text.

${familyBlock}

SCENARIO STRUCTURE (T3-L3):
- Scenario: 2-5 sentences describing what happened in World A (use inline variable notation (X), (Y), (Z) in-text)
- Counterfactual Claim: "If [X had been different], then [Y]." (explicit counterfactual language)
- Variables: X (Antecedent), Y (Consequent), Z (Mechanism/Context)
- Invariants: 1-3 bullets specifying what is held fixed across worlds (if unknown, state: "Not specified: ...")
- Ground Truth: VALID | INVALID | CONDITIONAL
- Justification: 2-4 sentences grounded in Scenario + Invariants
- Wise Response: Brief structured reasoning template

STYLE CONSTRAINTS:
- Be concise (2-5 sentences for scenario)
- Use explicit counterfactual language ("would have", "had X not occurred")
- Clearly state invariants - they determine the label
- All causal reasoning must be derivable from the scenario text
- Use domain-appropriate terminology from ${subdomain} to make the scenario feel authentic and grounded

${promptNotes ? `ADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}
${diversityBlock}

OUTPUT FORMAT (valid JSON only):
{
  "caseId": "Optional case ID",
  "domain": "${domain}",
  "family": "${family}",
  "difficulty": "easy|medium|hard",
  "scenario": "2-5 sentences: what happened in World A (use inline (X), (Y), (Z) notation)",
  "counterfactualClaim": "If [X had been different], then [Y].",
  "variables": {
    "X": "Antecedent",
    "Y": "Consequent",
    "Z": "Mechanism/Context"
  },
  "invariants": [
    "1-3 bullets; what is held fixed across worlds",
    "If unknown, state: 'Not specified: ...'"
  ],
  "groundTruth": "VALID|INVALID|CONDITIONAL",
  "justification": "2-4 sentences grounded in Scenario + Invariants",
  "wiseResponse": "Brief structured reasoning template"
}

Return ONLY valid JSON.`;
}

async function getNextGeneratedCaseId(): Promise<string> {
  const [lastQuestion, lastL1, lastL2] = await Promise.all([
    prisma.question.findFirst({
      where: { sourceCase: { startsWith: 'G.' } },
      orderBy: { sourceCase: 'desc' },
      select: { sourceCase: true },
    }),
    prisma.l1Case.findFirst({
      where: { sourceCase: { startsWith: 'G.' } },
      orderBy: { sourceCase: 'desc' },
      select: { sourceCase: true },
    }),
    prisma.l2Case.findFirst({
      where: { sourceCase: { startsWith: 'G.' } },
      orderBy: { sourceCase: 'desc' },
      select: { sourceCase: true },
    }),
  ]);

  const parseNum = (s?: string | null) => {
    if (!s) return 0;
    const n = parseInt(s.split('.')[1] || '0', 10);
    return Number.isFinite(n) ? n : 0;
  };

  const next = Math.max(
    parseNum(lastQuestion?.sourceCase),
    parseNum(lastL1?.sourceCase),
    parseNum(lastL2?.sourceCase)
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
  // L1 uses YES/NO/AMBIGUOUS
  L1?: { yes?: number; no?: number; ambiguous?: number };
  // L2 (revamped) produces ambiguous-only cases with a trap type (T1..T17)
  L2?: { ambiguous?: number };
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
      const ambiguous = Number(levelConfig.ambiguous || 0);
      for (let i = 0; i < ambiguous; i++) tasks.push({ pearlLevel: 'L2', validity: 'AMBIGUOUS' });
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

      if (trap.pearlLevel === 'L1') {
        const evidenceSelection = await selectNextL1Evidence(validity);
        console.log(
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: ${validity} - L1 - ${evidenceSelection?.evidence.code || 'NONE'} - ${currentDomain}/${currentSubdomain}`
        );
        const prompt = buildL1Prompt(evidenceSelection, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes);

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

          const generated: GeneratedL1Case = JSON.parse(content);

          // Enforce mapping: validity → evidence class → groundTruth
          const expectedClass = validityToEvidenceClass(validity);
          if (generated.evidenceClass !== expectedClass) {
            console.log(
              `[Batch ${batchId}] Skipping: evidenceClass mismatch expected=${expectedClass} got=${generated.evidenceClass}`
            );
            errorCount++;
            continue;
          }
          if (expectedClass === 'WOLF' && generated.groundTruth !== 'NO') {
            console.log(`[Batch ${batchId}] Skipping: WOLF must be NO (got ${generated.groundTruth})`);
            errorCount++;
            continue;
          }
          if (expectedClass === 'SHEEP' && generated.groundTruth !== 'YES') {
            console.log(`[Batch ${batchId}] Skipping: SHEEP must be YES (got ${generated.groundTruth})`);
            errorCount++;
            continue;
          }
          if (expectedClass === 'NONE') {
            if (generated.groundTruth !== 'AMBIGUOUS' || generated.evidenceType !== null) {
              console.log(`[Batch ${batchId}] Skipping: AMBIGUOUS must have evidenceType=null`);
              errorCount++;
              continue;
            }
          } else {
            if (!generated.evidenceType || typeof generated.evidenceType !== 'string') {
              console.log(`[Batch ${batchId}] Skipping: non-ambiguous must include evidenceType`);
              errorCount++;
              continue;
            }
            const allowed = evidenceSelection?.evidence.code;
            if (allowed && generated.evidenceType !== allowed) {
              console.log(
                `[Batch ${batchId}] Skipping: evidenceType mismatch expected=${allowed} got=${generated.evidenceType}`
              );
              errorCount++;
              continue;
            }
          }

          const caseId = await getNextGeneratedCaseId();
          const difficulty =
            (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) ||
            (evidenceSelection ? inferDifficultyForL1(evidenceSelection.evidence) : 'medium');

          // Enforce: variables.Z should be a single (optional) variable, not an array.
          // Some older prompt shapes encouraged Z: string[]; normalize to a single string.
          let variablesToStore: Record<string, unknown> | null = generated.variables || null;
          if (variablesToStore && Object.prototype.hasOwnProperty.call(variablesToStore, 'Z')) {
            const zVal = (variablesToStore as any).Z;
            if (Array.isArray(zVal)) {
              const normalized = zVal.map(v => String(v)).filter(Boolean).join('; ');
              (variablesToStore as any).Z = normalized || undefined;
            }
          }

          await prisma.l1Case.create({
            data: {
              scenario: generated.scenario,
              claim: generated.claim,
              groundTruth: generated.groundTruth,
              evidenceClass: generated.evidenceClass,
              evidenceType: generated.evidenceType,
              whyFlawedOrValid: generated.whyFlawedOrValid,
              domain: generated.domain || currentDomain,
              subdomain: generated.subdomain || currentSubdomain,
              difficulty,
              variables: variablesToStore ? JSON.stringify(variablesToStore) : null,
              causalStructure: generated.causalStructure ?? null,
              dataset,
              author: 'LLM',
              sourceCase: caseId,
              generationBatchId: batchId,
              isVerified: false,
            },
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generatedCount: successCount },
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
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: L2 (revamped) - ${selectedTrapType} - ${currentDomain}/${currentSubdomain}`
        );
        const prompt = buildL2Prompt(selectedTrapType, currentDomain, currentSubdomain, recentScenarios, promptNotes);

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You generate high-quality L2 causal reasoning cases with hidden questions and conditional answers. Follow the specifications EXACTLY. Return only valid JSON.',
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

          const generated: GeneratedL2Case = JSON.parse(content);

          // Validate required fields
          if (!generated.scenario || !generated.hiddenQuestion || !generated.answerIfA || !generated.answerIfB || !generated.wiseRefusal) {
            console.log(`[Batch ${batchId}] Skipping: missing required L2 fields`);
            errorCount++;
            continue;
          }

          // Validate trap type matches
          if (generated.annotations.trapType !== selectedTrapType) {
            console.log(`[Batch ${batchId}] Skipping: trapType mismatch expected=${selectedTrapType} got=${generated.annotations.trapType}`);
            errorCount++;
            continue;
          }

          // Validate variables
          if (!generated.variables?.X || !generated.variables?.Y) {
            console.log(`[Batch ${batchId}] Skipping: missing X or Y variables`);
            errorCount++;
            continue;
          }

          const caseId = await getNextGeneratedCaseId();
          const difficulty = (generated.annotations.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';

          await prisma.l2Case.create({
            data: {
              scenario: generated.scenario,
              variables: JSON.stringify(generated.variables),
              trapType: selectedTrapType,
              difficulty,
              causalStructure: generated.annotations.causalStructure || null,
              hiddenQuestion: generated.hiddenQuestion,
              answerIfA: generated.answerIfA,
              answerIfB: generated.answerIfB,
              wiseRefusal: generated.wiseRefusal,
              dataset,
              author: 'LLM',
              sourceCase: caseId,
              generationBatchId: batchId,
              isVerified: false,
            },
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generatedCount: successCount },
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
          `[Batch ${batchId}] Generating ${i + 1}/${totalTasks}: ${validity} - L3 (revamped) - ${selectedFamily} - ${currentDomain}/${currentSubdomain}`
        );
        const prompt = buildL3Prompt(selectedFamily, validity, currentDomain, currentSubdomain, recentScenarios, promptNotes);

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

          const generated: GeneratedL3Case = JSON.parse(content);

          // Validate required fields
          if (
            !generated.scenario ||
            !generated.counterfactualClaim ||
            !generated.variables ||
            !generated.invariants ||
            !generated.groundTruth ||
            !generated.justification ||
            !generated.wiseResponse
          ) {
            console.log(`[Batch ${batchId}] Skipping: missing required L3 fields`);
            errorCount++;
            continue;
          }

          // Validate family matches
          if (generated.family !== selectedFamily) {
            console.log(`[Batch ${batchId}] Skipping: family mismatch expected=${selectedFamily} got=${generated.family}`);
            errorCount++;
            continue;
          }

          // Validate variables
          if (!generated.variables.X || !generated.variables.Y || !generated.variables.Z) {
            console.log(`[Batch ${batchId}] Skipping: missing X, Y, or Z variables`);
            errorCount++;
            continue;
          }

          // Validate invariants is an array
          if (!Array.isArray(generated.invariants) || generated.invariants.length === 0) {
            console.log(`[Batch ${batchId}] Skipping: invariants must be a non-empty array`);
            errorCount++;
            continue;
          }

          // Validate ground truth is valid
          if (!['VALID', 'INVALID', 'CONDITIONAL'].includes(generated.groundTruth)) {
            console.log(`[Batch ${batchId}] Skipping: invalid groundTruth=${generated.groundTruth}`);
            errorCount++;
            continue;
          }

          const caseId = await getNextGeneratedCaseId();
          const difficulty = (generated.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined) || 'medium';

          await prisma.l3Case.create({
            data: {
              caseId: generated.caseId || caseId,
              domain: generated.domain || currentDomain,
              family: selectedFamily,
              difficulty,
              scenario: generated.scenario,
              counterfactualClaim: generated.counterfactualClaim,
              variables: JSON.stringify(generated.variables),
              invariants: JSON.stringify(generated.invariants),
              groundTruth: generated.groundTruth,
              justification: generated.justification,
              wiseResponse: generated.wiseResponse,
              dataset,
              author: 'LLM',
              sourceCase: caseId,
              generationBatchId: batchId,
              isVerified: false,
            },
          });

          successCount++;

          await prisma.generationBatch.update({
            where: { id: batchId },
            data: { generatedCount: successCount },
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

