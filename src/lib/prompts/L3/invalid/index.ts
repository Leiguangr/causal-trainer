/**
 * L3 INVALID Prompts Index
 * Counterfactual claims that are NOT supported under stated invariants
 */

import { PromptDefinition } from '../../types';

import { F1_DETERMINISTIC_INVALID } from './F1-deterministic';
import { F2_PROBABILISTIC_INVALID } from './F2-probabilistic';
import { F3_OVERDETERMINATION_INVALID } from './F3-overdetermination';
import { F4_STRUCTURAL_INVALID } from './F4-structural';
import { F5_TEMPORAL_INVALID } from './F5-temporal';
import { F7_ATTRIBUTION_INVALID } from './F7-attribution';
import { F8_MORAL_LEGAL_INVALID } from './F8-moral-legal';

// Note: F6 (Epistemic Limits) does not support INVALID - only CONDITIONAL

export {
  F1_DETERMINISTIC_INVALID,
  F2_PROBABILISTIC_INVALID,
  F3_OVERDETERMINATION_INVALID,
  F4_STRUCTURAL_INVALID,
  F5_TEMPORAL_INVALID,
  F7_ATTRIBUTION_INVALID,
  F8_MORAL_LEGAL_INVALID,
};

export const L3_INVALID_PROMPTS: Record<string, PromptDefinition> = {
  F1: F1_DETERMINISTIC_INVALID,
  F2: F2_PROBABILISTIC_INVALID,
  F3: F3_OVERDETERMINATION_INVALID,
  F4: F4_STRUCTURAL_INVALID,
  F5: F5_TEMPORAL_INVALID,
  // F6 does not support INVALID
  F7: F7_ATTRIBUTION_INVALID,
  F8: F8_MORAL_LEGAL_INVALID,
};

export const L3_INVALID_PROMPT_LIST: PromptDefinition[] = Object.values(L3_INVALID_PROMPTS);

export function getRandomL3InvalidPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L3_INVALID_PROMPT_LIST.length);
  return L3_INVALID_PROMPT_LIST[idx];
}

export function getL3InvalidPromptByFamily(familyId: string): PromptDefinition | undefined {
  return L3_INVALID_PROMPTS[familyId];
}

