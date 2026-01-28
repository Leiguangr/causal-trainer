/**
 * Types for the modular prompt system
 */

// Scenario seed - pre-generated to ensure diversity
export interface ScenarioSeed {
  id: string;
  topic: string;
  subdomain: string;
  entities: string[]; // Companies, assets, people involved
  timeframe: string; // e.g., "Q2 2023", "2008 financial crisis"
  event: string; // The core market event
  context: string; // Additional context
  difficulty?: 'Easy' | 'Medium' | 'Hard'; // Target difficulty level (1:2:1 distribution)
}

// Base prompt definition
export interface PromptDefinition {
  // Identification
  id: string; // e.g., "L1-W1", "L2-T5", "L3-F2-VALID"
  level: 'L1' | 'L2' | 'L3';
  validity: 'YES' | 'NO' | 'AMBIGUOUS' | 'VALID' | 'INVALID' | 'CONDITIONAL';
  trapType?: string; // W1-W10, T1-T17, F1-F8
  trapName: string;
  family?: string; // For grouping related traps

  // Content
  description: string;
  coreChallenge: string;
  keyQuestion: string;
  validationChecklist: string[];

  // Example(s)
  examples: PromptExample[];

  // The actual prompt template
  buildPrompt: (seed: ScenarioSeed) => string;
}

// Example case for the prompt
export interface PromptExample {
  scenario: string;
  claim: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
  };
  groundTruth: string;
  explanation: string;
  wiseRefusal: string;
  // Ambiguous/Conditional-specific (optional)
  hiddenQuestion?: string;
  conditionalAnswers?: string[];
}

// Output format expected from LLM
export interface GeneratedCase {
  scenario: string;
  claim: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
  };
  groundTruth: string;
  trapType: string;
  trapSubtype: string;
  explanation: string;
  wiseRefusal: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  // L3-specific
  invariants?: string[];
  justification?: string;
  // Ambiguous/Conditional-specific
  hiddenQuestion?: string;
  conditionalAnswers?: string[];
}

// Registry key for looking up prompts
export type PromptKey =
  | `L1-${string}` // L1-W1, L1-S1, etc.
  | `L2-${string}` // L2-T1, L2-YES, L2-AMBIG-TIMING, etc.
  | `L3-${string}-${string}`; // L3-F1-VALID, L3-F2-INVALID, etc.

