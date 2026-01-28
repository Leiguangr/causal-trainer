/**
 * L3 Prompts Index
 * Counterfactual-level causal reasoning
 */

import { PromptDefinition } from '../types';

// Import from subdirectories
export * from './valid';
export * from './invalid';
export * from './conditional';

import { L3_VALID_PROMPTS, L3_VALID_PROMPT_LIST, getRandomL3ValidPrompt, getL3ValidPromptByFamily } from './valid';
import {
  L3_INVALID_PROMPTS,
  L3_INVALID_PROMPT_LIST,
  getRandomL3InvalidPrompt,
  getL3InvalidPromptByFamily,
} from './invalid';
import {
  L3_CONDITIONAL_PROMPTS,
  L3_CONDITIONAL_PROMPT_LIST,
  getRandomL3ConditionalPrompt,
  getL3ConditionalPromptByFamily,
} from './conditional';

// Combined exports
export const L3_ALL_PROMPTS = {
  VALID: L3_VALID_PROMPTS,
  INVALID: L3_INVALID_PROMPTS,
  CONDITIONAL: L3_CONDITIONAL_PROMPTS,
};

// Get prompt by answer type and optional family
export function getL3Prompt(
  answerType: 'VALID' | 'INVALID' | 'CONDITIONAL',
  familyId?: string
): PromptDefinition | undefined {
  if (answerType === 'VALID') {
    return familyId ? getL3ValidPromptByFamily(familyId) : getRandomL3ValidPrompt();
  } else if (answerType === 'INVALID') {
    return familyId ? getL3InvalidPromptByFamily(familyId) : getRandomL3InvalidPrompt();
  } else if (answerType === 'CONDITIONAL') {
    return familyId ? getL3ConditionalPromptByFamily(familyId) : getRandomL3ConditionalPrompt();
  }
  return undefined;
}

// Get random L3 prompt of any type
export function getRandomL3Prompt(): PromptDefinition {
  const allPrompts = [...L3_VALID_PROMPT_LIST, ...L3_INVALID_PROMPT_LIST, ...L3_CONDITIONAL_PROMPT_LIST];
  const idx = Math.floor(Math.random() * allPrompts.length);
  return allPrompts[idx];
}

// Summary stats
export const L3_PROMPT_COUNTS = {
  VALID: L3_VALID_PROMPT_LIST.length,
  INVALID: L3_INVALID_PROMPT_LIST.length,
  CONDITIONAL: L3_CONDITIONAL_PROMPT_LIST.length,
  TOTAL: L3_VALID_PROMPT_LIST.length + L3_INVALID_PROMPT_LIST.length + L3_CONDITIONAL_PROMPT_LIST.length,
};

