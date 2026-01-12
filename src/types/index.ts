// Pearl Levels
export type PearlLevel = 'L1' | 'L2' | 'L3';

// Structured Pearl level metadata used in prompts & UI
export interface PearlLevelMeta {
  id: PearlLevel;
  name: string;          // Human-readable name
  description: string;   // What this level means
  examples: string[];    // 1–3 short canonical question sketches
}

export const PEARL_LEVELS: Record<PearlLevel, PearlLevelMeta> = {
  L1: {
    id: 'L1',
    name: 'Association',
    description:
      'Association-level questions are about patterns and correlations in observed data without explicit interventions. The focus is on whether X and Y move together once we account for Z.',
    examples: [
      'People who drink more coffee (X) have higher rates of heart disease (Y) in observational surveys.',
      'Cities with more police officers (X) report more crime (Y).',
    ],
  },
  L2: {
    id: 'L2',
    name: 'Intervention',
    description:
      'Intervention-level questions ask about the causal effect of doing X on Y (policies, treatments, actions). The focus is on do-operator reasoning and blocked/backdoor paths.',
    examples: [
      'A hospital introduces a new triage protocol (X) and mortality (Y) falls, while case mix (Z) also changes.',
      'A central bank cuts rates (X) and stock prices (Y) rise, while risk appetite (Z) also shifts.',
    ],
  },
  L3: {
    id: 'L3',
    name: 'Counterfactual',
    description:
      'Counterfactual-level questions compare what actually happened with what would have happened under a different action X′, often across possible worlds.',
    examples: [
      'If the Senator had not traded (X′), the stock (Y) would not have risen despite the Spending Bill (Z).',
      'If we had deployed earlier (X′), the outage (Y) would have been avoided, given existing safeguards (Z).',
    ],
  },
};

// Convenience mapping for simple label display (e.g., dropdowns)
export const PEARL_LEVEL_LABELS: Record<PearlLevel, string> = {
  L1: PEARL_LEVELS.L1.name,
  L2: PEARL_LEVELS.L2.name,
  L3: PEARL_LEVELS.L3.name,
};

// =============================================================================
// BUCKETG TAXONOMY (used for existing quiz questions from assignment)
// =============================================================================

// BucketG Trap Types - from BucketLarge-G assignment data
export const BUCKETG_TRAP_TYPES = [
  'SPURIOUS',
  'REVERSE',
  'SELECTION',
  'REGRESSION',
  'COLLIDER',
  'CONF-MED',
  'PROXY',
  'SELF-FULFILL',
  'MECHANISM',
  'COUNTERFACTUAL',
] as const;

export type BucketGTrapType = typeof BUCKETG_TRAP_TYPES[number];

export const BUCKETG_TRAP_TYPE_LABELS: Record<BucketGTrapType, string> = {
  SPURIOUS: 'Spurious Correlation',
  REVERSE: 'Reverse Causation',
  SELECTION: 'Selection Bias',
  REGRESSION: 'Regression to Mean',
  COLLIDER: 'Collider Bias',
  'CONF-MED': 'Confounder-Mediator',
  PROXY: 'Proxy Error',
  'SELF-FULFILL': 'Self-Fulfilling Prophecy',
  MECHANISM: 'Valid Mechanism',
  COUNTERFACTUAL: 'Counterfactual Error',
};

// =============================================================================
// CHEATSHEET TAXONOMY (used for generating new questions)
// =============================================================================

// Cheatsheet Trap Types - canonical list from CS372 cheatsheet
export const CHEATSHEET_TRAP_TYPES = [
  'CONFOUNDING',
  'REVERSE',
  'SELECTION',
  'COLLIDER',
  'SIMPSONS',
  'REGRESSION',
  'SURVIVORSHIP',
  'BASE_RATE',
  'GOODHART',
  'FEEDBACK',
  'PREEMPTION',
  'CONFOUNDER_MEDIATOR',
] as const;

export type CheatsheetTrapType = typeof CHEATSHEET_TRAP_TYPES[number];

export const CHEATSHEET_TRAP_TYPE_LABELS: Record<CheatsheetTrapType, string> = {
  CONFOUNDING: 'Confounding',
  REVERSE: 'Reverse Causation',
  SELECTION: 'Selection Bias',
  COLLIDER: 'Collider Bias',
  SIMPSONS: "Simpson's Paradox",
  REGRESSION: 'Regression to Mean',
  SURVIVORSHIP: 'Survivorship Bias',
  BASE_RATE: 'Base-rate Neglect',
  GOODHART: "Goodhart's Law",
  FEEDBACK: 'Feedback Loops',
  PREEMPTION: 'Preemption',
  CONFOUNDER_MEDIATOR: 'Confounder-Mediator Error',
};

// Cheatsheet Subtypes by Trap Type - organized by Pearl Level
export const CHEATSHEET_SUBTYPES: Record<CheatsheetTrapType, { level: PearlLevel; subtypes: string[] }[]> = {
  CONFOUNDING: [
    { level: 'L1', subtypes: ['Confounding_by_Indication', 'Omitted_Variable', 'Socioeconomic'] },
    { level: 'L2', subtypes: ['Unblocked_Backdoor', 'Time-varying_Confounding'] },
    { level: 'L3', subtypes: ['Cross-world_Confounder'] },
  ],
  REVERSE: [
    { level: 'L1', subtypes: ['Outcome-driven_Selection', 'Policy_Endogeneity'] },
    { level: 'L2', subtypes: ['Reactive_Intervention'] },
    { level: 'L3', subtypes: ['Outcome-dependent_Worlds'] },
  ],
  SELECTION: [
    { level: 'L1', subtypes: ['Sampling-on-the-Outcome', 'Attrition_Bias', 'Conditioning_on_Participation'] },
    { level: 'L2', subtypes: ['Post-intervention_Selection'] },
    { level: 'L3', subtypes: ['Counterfactual_Conditioning'] },
  ],
  COLLIDER: [
    { level: 'L1', subtypes: ['Case-Control_Sampling'] },
    { level: 'L2', subtypes: ['Conditioning_on_Compliance'] },
  ],
  SIMPSONS: [
    { level: 'L1', subtypes: ['Aggregation_Bias', 'Imbalanced_Group_Composition'] },
    { level: 'L2', subtypes: ['Stratified_Intervention_Reversal'] },
  ],
  REGRESSION: [
    { level: 'L1', subtypes: ['Extreme-Group_Selection', 'Noise-Induced_Extremes'] },
  ],
  SURVIVORSHIP: [
    { level: 'L1', subtypes: ['Selective_Observation', 'Historical_Filtering'] },
  ],
  BASE_RATE: [
    { level: 'L1', subtypes: ['Prior_Ignorance', 'Conditional_Fallacy'] },
  ],
  GOODHART: [
    { level: 'L1', subtypes: ['Static_Metric_Gaming', 'Proxy_Drift'] },
    { level: 'L2', subtypes: ['Policy_Target_Gaming'] },
  ],
  FEEDBACK: [
    { level: 'L2', subtypes: ['Policy-Response_Loop'] },
    { level: 'L3', subtypes: ['Dynamic_World_Divergence'] },
  ],
  PREEMPTION: [
    { level: 'L3', subtypes: ['Early_Preemption', 'Late_Preemption'] },
  ],
  CONFOUNDER_MEDIATOR: [
    { level: 'L2', subtypes: ['Mediator_Adjustment_Error'] },
    { level: 'L3', subtypes: ['Mediator_Fixing_Error'] },
  ],
};

// =============================================================================
// UNIFIED TYPES (for app compatibility - union of both taxonomies)
// =============================================================================

// Combined trap types for quiz display (accepts any type from either taxonomy)
export const TRAP_TYPES = [
  ...BUCKETG_TRAP_TYPES,
  ...CHEATSHEET_TRAP_TYPES.filter(t => !BUCKETG_TRAP_TYPES.includes(t as unknown as BucketGTrapType)),
] as const;
export type TrapType = BucketGTrapType | CheatsheetTrapType;

// Combined labels
export const TRAP_TYPE_LABELS: Record<string, string> = {
  ...BUCKETG_TRAP_TYPE_LABELS,
  ...CHEATSHEET_TRAP_TYPE_LABELS,
};

// Trap type descriptions for tooltips
export const TRAP_TYPE_DESCRIPTIONS: Record<string, string> = {
  // BucketG types
  SPURIOUS: 'Two variables appear correlated but have no causal relationship - often due to a hidden common cause.',
  REVERSE: 'The assumed direction of causation is backwards: Y causes X, not X causes Y.',
  SELECTION: 'The sample is not representative of the population due to selection on outcome or exposure.',
  REGRESSION: 'Extreme observations tend to be followed by less extreme ones due to random variation.',
  COLLIDER: 'Conditioning on a common effect of X and Y induces spurious association between them.',
  'CONF-MED': 'Incorrectly treating a mediator as a confounder or vice versa, leading to wrong adjustments.',
  PROXY: 'Using a proxy variable instead of the true causal variable, introducing measurement bias.',
  'SELF-FULFILL': 'A prediction or belief influences behavior in ways that make the prediction come true.',
  MECHANISM: 'Misunderstanding or ignoring the causal mechanism through which X affects Y.',
  COUNTERFACTUAL: 'Errors in reasoning about what would have happened under alternative conditions.',
  // Cheatsheet types (some overlap, prioritize more detailed)
  CONFOUNDING: 'A hidden variable Z causes both X and Y, making X and Y appear related when they are not causally linked.',
  SIMPSONS: 'A trend appears in aggregated data but reverses when data is stratified by a confounding variable.',
  SURVIVORSHIP: 'Only surviving or successful cases are observed, hiding failures from analysis.',
  BASE_RATE: 'Ignoring the prior probability of an event when interpreting conditional probabilities.',
  GOODHART: 'When a measure becomes a target, it ceases to be a good measure.',
  FEEDBACK: 'Bidirectional causation where X affects Y and Y affects X, creating dynamic cycles.',
  PREEMPTION: 'One cause preempts another from having its effect, complicating counterfactual analysis.',
  CONFOUNDER_MEDIATOR: 'Incorrectly treating a mediator as a confounder or vice versa.',
};

// Legacy subtypes export for backward compatibility
export const TRAP_SUBTYPES: Record<string, string[]> = Object.fromEntries(
  Object.entries(CHEATSHEET_SUBTYPES).map(([type, levels]) => [
    type,
    levels.flatMap(l => l.subtypes),
  ])
);

// Domains
export const DOMAINS = [
  'Markets',
  'Medicine', 
  'Economics',
  'Law',
  'Sports',
  'Daily Life',
  'History',
  'Environment',
  'AI & Tech',
  'Social Science',
] as const;

export type Domain = typeof DOMAINS[number];

// Difficulty Levels
export type Difficulty = 'easy' | 'medium' | 'hard';

// Ground Truth for answers
export type GroundTruth = 'VALID' | 'INVALID' | 'CONDITIONAL';

// Quiz Configuration
export interface QuizConfig {
  numQuestions: number;
  domains: string[];
  pearlLevels: PearlLevel[];
  difficulty: Difficulty | 'all';
  includeSubtypes: boolean;
}

// Question for Quiz (matches SCHEMA.md)
// QuizQuestion mirrors the unified schema used throughout the app.
// NOTE: Some properties (claim, explanation, variables.Z as array) are kept
// optional for backward compatibility with legacy data.
export interface QuizQuestion {
  id: string;                      // Database ID
  sourceCase?: string;             // Original case ID (e.g., "3.43")

  // Single unified scenario containing setup + causal claim with inline tags
  scenario: string;

  /**
   * @deprecated
   * Legacy separate claim field. New questions should embed the claim inside
   * `scenario` and leave this undefined.
   */
  claim?: string;

  pearlLevel: PearlLevel;
  domain: string;
  subdomain?: string;              // More specific domain (e.g., "Commodities")
  trapType: string;
  trapSubtype: string;
  difficulty: Difficulty;
  groundTruth: GroundTruth;        // VALID, INVALID, or CONDITIONAL

  // Variables now use a single-Z representation, but we accept arrays for Z
  // from legacy rows and normalize at the edge of the app.
  variables?: {
    X: string;                     // Exposure/treatment variable
    Y: string;                     // Outcome variable
    Z: string | string[];          // Single key variable (new) or array (legacy)
  };

  causalStructure?: string;        // Brief description of causal graph
  keyInsight?: string;             // One-line takeaway

  /**
   * @deprecated
   * Legacy short explanation field. Canonical reasoning now lives in
   * `wiseRefusal`. This may be present for older questions but should not
   * be required for new ones.
   */
  explanation?: string;

  wiseRefusal: string;             // Complete answer with verdict + reasoning

  // Optional temporal metadata when order of Z vs X matters
  hiddenTimestamp?: {
    condition1: string;            // Z occurs before X
    condition2: string;            // X occurs before Z
  };
}
