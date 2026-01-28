/**
 * T³ Benchmark Prompts - Master Index
 *
 * Provides unified access to all prompt definitions across levels
 */

import { PromptDefinition } from './types';

// Re-export types
export * from './types';
export * from './shared';
export * from './seeding';

// Re-export L1
export * from './L1';
import { L1_WOLF_PROMPTS, L1_SHEEP_PROMPTS, getL1Prompt, L1_PROMPT_COUNTS } from './L1';

// Re-export L2
export * from './L2';
import { L2_ALL_PROMPTS, getL2Prompt, L2_PROMPT_COUNTS } from './L2';

// Re-export L3
export * from './L3';
import { L3_ALL_PROMPTS, getL3Prompt, L3_PROMPT_COUNTS } from './L3';

// =============================================================================
// UNIFIED ACCESS
// =============================================================================

/**
 * Get a prompt for the given level and answer type
 */
export function getPrompt(
  level: 'L1' | 'L2' | 'L3',
  answerType: string,
  specificType?: string
): PromptDefinition | undefined {
  if (level === 'L1') {
    return getL1Prompt(answerType as 'NO' | 'YES' | 'AMBIGUOUS', specificType);
  } else if (level === 'L2') {
    return getL2Prompt(answerType as 'NO' | 'YES' | 'AMBIGUOUS', specificType);
  } else if (level === 'L3') {
    return getL3Prompt(answerType as 'VALID' | 'INVALID' | 'CONDITIONAL', specificType);
  }
  return undefined;
}

/**
 * Get a prompt from a sampling result (from hierarchicalSample)
 */
export function getPromptFromSample(sample: {
  pearlLevel: 'L1' | 'L2' | 'L3';
  answerType: string;
  trapType?: { id: string };
  sheepType?: { id: string };
  l3Family?: { id: string };
  ambiguityType?: { type: string };
}): PromptDefinition | undefined {
  const { pearlLevel, answerType, trapType, sheepType, l3Family, ambiguityType } = sample;

  if (pearlLevel === 'L1') {
    if (answerType === 'NO' && trapType) {
      return getL1Prompt('NO', trapType.id);
    } else if (answerType === 'YES' && sheepType) {
      return getL1Prompt('YES', sheepType.id);
    } else if (answerType === 'AMBIGUOUS' && ambiguityType) {
      return getL1Prompt('AMBIGUOUS', ambiguityType.type);
    }
  } else if (pearlLevel === 'L2') {
    if (answerType === 'NO' && trapType) {
      return getL2Prompt('NO', trapType.id);
    } else if (answerType === 'YES') {
      return getL2Prompt('YES');
    } else if (answerType === 'AMBIGUOUS' && ambiguityType) {
      return getL2Prompt('AMBIGUOUS', ambiguityType.type);
    }
  } else if (pearlLevel === 'L3') {
    if (l3Family) {
      return getL3Prompt(answerType as 'VALID' | 'INVALID' | 'CONDITIONAL', l3Family.id);
    }
  }

  // Fallback to random prompt for the level
  return getPrompt(pearlLevel, answerType);
}

// =============================================================================
// SUMMARY STATISTICS
// =============================================================================

export const PROMPT_COUNTS = {
  L1: L1_PROMPT_COUNTS,
  L2: L2_PROMPT_COUNTS,
  L3: L3_PROMPT_COUNTS,
  TOTAL: L1_PROMPT_COUNTS.TOTAL + L2_PROMPT_COUNTS.TOTAL + L3_PROMPT_COUNTS.TOTAL,
};

// =============================================================================
// ALL PROMPTS REGISTRY
// =============================================================================

export const ALL_PROMPTS = {
  L1: {
    WOLF: L1_WOLF_PROMPTS,
    SHEEP: L1_SHEEP_PROMPTS,
  },
  L2: L2_ALL_PROMPTS,
  L3: L3_ALL_PROMPTS,
};

