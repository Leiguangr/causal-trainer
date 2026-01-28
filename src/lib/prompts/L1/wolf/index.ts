/**
 * L1 WOLF Prompts Index
 * 10 trap types for NO cases (invalid causal claims)
 */

import { PromptDefinition } from '../../types';

import { W1_SELECTION_BIAS } from './W1-selection-bias';
import { W2_SURVIVORSHIP_BIAS } from './W2-survivorship-bias';
import { W3_HEALTHY_USER_BIAS } from './W3-healthy-user-bias';
import { W4_REGRESSION_TO_MEAN } from './W4-regression-to-mean';
import { W5_ECOLOGICAL_FALLACY } from './W5-ecological-fallacy';
import { W6_BASE_RATE_NEGLECT } from './W6-base-rate-neglect';
import { W7_CONFOUNDING } from './W7-confounding';
import { W8_SIMPSONS_PARADOX } from './W8-simpsons-paradox';
import { W9_REVERSE_CAUSATION } from './W9-reverse-causation';
import { W10_POST_HOC_FALLACY } from './W10-post-hoc-fallacy';

// Export all WOLF prompts
export {
  W1_SELECTION_BIAS,
  W2_SURVIVORSHIP_BIAS,
  W3_HEALTHY_USER_BIAS,
  W4_REGRESSION_TO_MEAN,
  W5_ECOLOGICAL_FALLACY,
  W6_BASE_RATE_NEGLECT,
  W7_CONFOUNDING,
  W8_SIMPSONS_PARADOX,
  W9_REVERSE_CAUSATION,
  W10_POST_HOC_FALLACY,
};

// Map of trap ID to prompt definition
export const L1_WOLF_PROMPTS: Record<string, PromptDefinition> = {
  W1: W1_SELECTION_BIAS,
  W2: W2_SURVIVORSHIP_BIAS,
  W3: W3_HEALTHY_USER_BIAS,
  W4: W4_REGRESSION_TO_MEAN,
  W5: W5_ECOLOGICAL_FALLACY,
  W6: W6_BASE_RATE_NEGLECT,
  W7: W7_CONFOUNDING,
  W8: W8_SIMPSONS_PARADOX,
  W9: W9_REVERSE_CAUSATION,
  W10: W10_POST_HOC_FALLACY,
};

// Array of all WOLF prompts for random selection
export const L1_WOLF_PROMPT_LIST: PromptDefinition[] = Object.values(L1_WOLF_PROMPTS);

// Get a random WOLF prompt
export function getRandomWolfPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L1_WOLF_PROMPT_LIST.length);
  return L1_WOLF_PROMPT_LIST[idx];
}

// Get WOLF prompt by ID
export function getWolfPromptById(id: string): PromptDefinition | undefined {
  return L1_WOLF_PROMPTS[id];
}

