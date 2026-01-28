/**
 * L3 CONDITIONAL Prompts Index
 * Counterfactual claims that depend on unspecified invariants
 */

import { PromptDefinition } from '../../types';

import { F2_PROBABILISTIC_CONDITIONAL } from './F2-probabilistic';
import { F3_OVERDETERMINATION_CONDITIONAL } from './F3-overdetermination';
import { F4_STRUCTURAL_CONDITIONAL } from './F4-structural';
import { F5_TEMPORAL_CONDITIONAL } from './F5-temporal';
import { F6_EPISTEMIC_CONDITIONAL } from './F6-epistemic';
import { F7_ATTRIBUTION_CONDITIONAL } from './F7-attribution';
import { F8_MORAL_LEGAL_CONDITIONAL } from './F8-moral-legal';

// Note: F1 (Deterministic) does not support CONDITIONAL - deterministic cases are always VALID or INVALID

export {
  F2_PROBABILISTIC_CONDITIONAL,
  F3_OVERDETERMINATION_CONDITIONAL,
  F4_STRUCTURAL_CONDITIONAL,
  F5_TEMPORAL_CONDITIONAL,
  F6_EPISTEMIC_CONDITIONAL,
  F7_ATTRIBUTION_CONDITIONAL,
  F8_MORAL_LEGAL_CONDITIONAL,
};

export const L3_CONDITIONAL_PROMPTS: Record<string, PromptDefinition> = {
  // F1 does not support CONDITIONAL
  F2: F2_PROBABILISTIC_CONDITIONAL,
  F3: F3_OVERDETERMINATION_CONDITIONAL,
  F4: F4_STRUCTURAL_CONDITIONAL,
  F5: F5_TEMPORAL_CONDITIONAL,
  F6: F6_EPISTEMIC_CONDITIONAL,
  F7: F7_ATTRIBUTION_CONDITIONAL,
  F8: F8_MORAL_LEGAL_CONDITIONAL,
};

export const L3_CONDITIONAL_PROMPT_LIST: PromptDefinition[] = Object.values(L3_CONDITIONAL_PROMPTS);

export function getRandomL3ConditionalPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L3_CONDITIONAL_PROMPT_LIST.length);
  return L3_CONDITIONAL_PROMPT_LIST[idx];
}

export function getL3ConditionalPromptByFamily(familyId: string): PromptDefinition | undefined {
  return L3_CONDITIONAL_PROMPTS[familyId];
}

