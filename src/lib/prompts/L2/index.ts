/**
 * L2 Prompts Index
 * Intervention-level causal reasoning
 *
 * NOTE: Per revised Assignment 2 spec, ALL L2 cases are traps with label "NO".
 * L2 YES and AMBIGUOUS cases are NOT used.
 */

import { PromptDefinition } from '../types';

// Import from NO subdirectory only (per revised spec)
export * from './no';

import { L2_NO_PROMPTS, L2_NO_PROMPT_LIST, getRandomL2NoPrompt, getL2NoPromptById } from './no';

// Combined exports (only NO per revised spec)
export const L2_ALL_PROMPTS = {
  NO: L2_NO_PROMPTS,
};

// Get prompt by answer type and optional specific type
// NOTE: Only 'NO' is valid per revised Assignment 2 spec
export function getL2Prompt(
  answerType: 'NO' | 'YES' | 'AMBIGUOUS',
  specificType?: string
): PromptDefinition | undefined {
  // All L2 cases should be NO per revised spec
  if (answerType === 'NO' || answerType === 'YES' || answerType === 'AMBIGUOUS') {
    return specificType ? getL2NoPromptById(specificType) : getRandomL2NoPrompt();
  }
  return undefined;
}

// Get random L2 prompt (always NO per revised spec)
export function getRandomL2Prompt(): PromptDefinition {
  return getRandomL2NoPrompt();
}

// Summary stats
export const L2_PROMPT_COUNTS = {
  NO: L2_NO_PROMPT_LIST.length,
  TOTAL: L2_NO_PROMPT_LIST.length,
};

