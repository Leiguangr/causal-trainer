/**
 * L3 VALID Prompts Index
 * Counterfactual claims that are supported under stated invariants
 */

import { PromptDefinition } from '../../types';

import { F1_DETERMINISTIC_VALID } from './F1-deterministic';
import { F2_PROBABILISTIC_VALID } from './F2-probabilistic';
import { F3_OVERDETERMINATION_VALID } from './F3-overdetermination';
import { F4_STRUCTURAL_VALID } from './F4-structural';
import { F5_TEMPORAL_VALID } from './F5-temporal';
import { F7_ATTRIBUTION_VALID } from './F7-attribution';
import { F8_MORAL_LEGAL_VALID } from './F8-moral-legal';

// Note: F6 (Epistemic Limits) does not support VALID - only CONDITIONAL

export {
  F1_DETERMINISTIC_VALID,
  F2_PROBABILISTIC_VALID,
  F3_OVERDETERMINATION_VALID,
  F4_STRUCTURAL_VALID,
  F5_TEMPORAL_VALID,
  F7_ATTRIBUTION_VALID,
  F8_MORAL_LEGAL_VALID,
};

export const L3_VALID_PROMPTS: Record<string, PromptDefinition> = {
  F1: F1_DETERMINISTIC_VALID,
  F2: F2_PROBABILISTIC_VALID,
  F3: F3_OVERDETERMINATION_VALID,
  F4: F4_STRUCTURAL_VALID,
  F5: F5_TEMPORAL_VALID,
  // F6 does not support VALID
  F7: F7_ATTRIBUTION_VALID,
  F8: F8_MORAL_LEGAL_VALID,
};

export const L3_VALID_PROMPT_LIST: PromptDefinition[] = Object.values(L3_VALID_PROMPTS);

export function getRandomL3ValidPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L3_VALID_PROMPT_LIST.length);
  return L3_VALID_PROMPT_LIST[idx];
}

export function getL3ValidPromptByFamily(familyId: string): PromptDefinition | undefined {
  return L3_VALID_PROMPTS[familyId];
}

