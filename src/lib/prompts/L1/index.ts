/**
 * L1 Prompts Index
 * Association-level causal reasoning
 */

import { PromptDefinition } from '../types';

// Re-export from subdirectories
export * from './wolf';
export * from './sheep';

import { L1_WOLF_PROMPTS, L1_WOLF_PROMPT_LIST, getRandomWolfPrompt, getWolfPromptById } from './wolf';
import { L1_SHEEP_PROMPTS, L1_SHEEP_PROMPT_LIST, getRandomSheepPrompt, getSheepPromptById } from './sheep';

// Re-export for convenience
export { L1_WOLF_PROMPTS, L1_SHEEP_PROMPTS };

// Combined exports
export const L1_ALL_PROMPTS = {
  NO: L1_WOLF_PROMPTS,
  YES: L1_SHEEP_PROMPTS,
};

// Get prompt by answer type and optional specific type
export function getL1Prompt(
  answerType: 'NO' | 'YES' | 'AMBIGUOUS',
  specificType?: string
): PromptDefinition | undefined {
  if (answerType === 'NO') {
    return specificType ? getWolfPromptById(specificType) : getRandomWolfPrompt();
  } else if (answerType === 'YES') {
    return specificType ? getSheepPromptById(specificType) : getRandomSheepPrompt();
  } else if (answerType === 'AMBIGUOUS') {
    // For ambiguous L1 cases, we can use wolf prompts with modifications
    // or create dedicated ambiguous prompts later
    return getRandomWolfPrompt();
  }
  return undefined;
}

// Get random L1 prompt of any type
export function getRandomL1Prompt(): PromptDefinition {
  const allPrompts = [...L1_WOLF_PROMPT_LIST, ...L1_SHEEP_PROMPT_LIST];
  const idx = Math.floor(Math.random() * allPrompts.length);
  return allPrompts[idx];
}

// Summary stats
export const L1_PROMPT_COUNTS = {
  NO: L1_WOLF_PROMPT_LIST.length,
  YES: L1_SHEEP_PROMPT_LIST.length,
  TOTAL: L1_WOLF_PROMPT_LIST.length + L1_SHEEP_PROMPT_LIST.length,
};

