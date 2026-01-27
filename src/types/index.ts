// Pearl Levels
export type PearlLevel = 'L1' | 'L2' | 'L3';

export const PEARL_LEVELS: Record<PearlLevel, string> = {
  L1: 'Association',
  L2: 'Intervention',
  L3: 'Counterfactual',
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
// YES = claim is supported as stated
// NO = claim is invalid due to violated causal/statistical assumption
// AMBIGUOUS = claim cannot be definitively evaluated given available information
export type GroundTruth = 'YES' | 'NO' | 'AMBIGUOUS';

// Quiz Configuration
export interface QuizConfig {
  numQuestions: number;
  domains: string[];
  pearlLevels: PearlLevel[];
  difficulty: Difficulty | 'all';
  includeSubtypes: boolean;
}

// Question for Quiz (matches SCHEMA.md) - Legacy format (snake_case)
export interface QuizQuestion {
  id: string;                    // Database ID
  source_case?: string;           // Original case ID (e.g., "3.43")
  scenario: string;
  claim: string;
  pearl_level: PearlLevel;
  domain: string;
  subdomain?: string;            // More specific domain (e.g., "Commodities")
  trap_type: string;
  trap_subtype: string;
  difficulty: Difficulty;
  ground_truth: GroundTruth;      // YES, NO, or AMBIGUOUS
  variables: {
    X: string;                   // Exposure/treatment variable
    Y: string;                   // Outcome variable
    Z: string[];                 // Confounders, mediators, mechanisms
  };
  causal_structure: string;       // Brief description of causal graph
  key_insight: string;            // One-line takeaway
  explanation: string;           // Ground truth reasoning
  wise_refusal: string;           // Complete answer with verdict
}

// Unified T3Case (replaces L1Case, L2Case, L3Case)
// All cases use the same unified schema structure from Appendix B, Table 9
export type PearlLevel = 'L1' | 'L2' | 'L3';

// L3 Family types
export type L3Family = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';

// Label values per level (Table 10)
export type L1Label = 'YES' | 'NO' | 'AMBIGUOUS';
export type L2Label = 'NO'; // All L2 cases must be labeled NO
export type L3Label = 'VALID' | 'INVALID' | 'CONDITIONAL';
export type T3Label = L1Label | L2Label | L3Label;

// Variables structure - X and Y can be objects or strings, Z is always an array
export type VariableValue = string | { name: string; role: string };
export interface T3Variables {
  X: VariableValue;
  Y: VariableValue;
  Z: string[]; // Always an array, even if empty
}

// Trap structure
export interface T3Trap {
  type: string; // W1–W10/S1–S8/A for L1, T1–T17 for L2, F1–F8 for L3
  type_name?: string;
  subtype?: string;
  subtype_name?: string;
}

// Unified T3Case interface matching Prisma schema (snake_case)
export interface T3Case {
  id: string;
  
  // Identity & Metadata
  case_id?: string | null;
  bucket?: string | null;
  pearl_level: PearlLevel;
  domain?: string | null;
  subdomain?: string | null;
  
  // Case Content
  scenario: string;
  claim?: string | null; // Required for L1/L2, optional for L3
  counterfactual_claim?: string | null; // For L3
  label: T3Label;
  is_ambiguous: boolean;
  
  // Variables
  variables?: T3Variables | null;
  
  // Trap Structure
  trap_type: string;
  trap_type_name?: string | null;
  trap_subtype?: string | null;
  trap_subtype_name?: string | null;
  
  // Reasoning Fields
  difficulty: Difficulty;
  causal_structure?: string | null;
  key_insight?: string | null;
  
  // Ambiguity Handling
  hidden_timestamp?: string | null;
  conditional_answers?: string | null; // JSON string
  
  // Explanations
  wise_refusal?: string | null;
  gold_rationale?: string | null;
  
  // L3-Specific Fields
  invariants?: string | null; // JSON array string (L3 only)
  
  // Assignment 2 Fields
  initial_author?: string | null;
  validator?: string | null;
  final_score?: number | null;
  
  // Metadata
  dataset: string;
  author?: string | null;
  source_case?: string | null;
  generation_batch_id?: string | null;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

// Type guards for level-specific validation
export function isL1Case(case: T3Case): case is T3Case & { pearl_level: 'L1'; label: L1Label } {
  return case.pearl_level === 'L1';
}

export function isL2Case(case: T3Case): case is T3Case & { pearl_level: 'L2'; label: L2Label } {
  return case.pearl_level === 'L2';
}

export function isL3Case(case: T3Case): case is T3Case & { pearl_level: 'L3'; label: L3Label } {
  return case.pearl_level === 'L3';
}
