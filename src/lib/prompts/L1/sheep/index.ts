/**
 * L1 SHEEP Prompts Index
 * 8 evidence types for YES cases (valid causal claims)
 */

import { PromptDefinition } from '../../types';

import { S1_RCT } from './S1-rct';
import { S2_NATURAL_EXPERIMENT } from './S2-natural-experiment';
import { S3_LOTTERY } from './S3-lottery-quasi-random';
import { S4_CONTROLLED_ABLATION } from './S4-controlled-ablation';
import { S5_MECHANISM_DOSE_RESPONSE } from './S5-mechanism-dose-response';
import { S6_INSTRUMENTAL_VARIABLE } from './S6-instrumental-variable';
import { S7_DIFFERENCE_IN_DIFFERENCES } from './S7-difference-in-differences';
import { S8_REGRESSION_DISCONTINUITY } from './S8-regression-discontinuity';

// Export all SHEEP prompts
export {
  S1_RCT,
  S2_NATURAL_EXPERIMENT,
  S3_LOTTERY,
  S4_CONTROLLED_ABLATION,
  S5_MECHANISM_DOSE_RESPONSE,
  S6_INSTRUMENTAL_VARIABLE,
  S7_DIFFERENCE_IN_DIFFERENCES,
  S8_REGRESSION_DISCONTINUITY,
};

// Map of evidence ID to prompt definition
export const L1_SHEEP_PROMPTS: Record<string, PromptDefinition> = {
  S1: S1_RCT,
  S2: S2_NATURAL_EXPERIMENT,
  S3: S3_LOTTERY,
  S4: S4_CONTROLLED_ABLATION,
  S5: S5_MECHANISM_DOSE_RESPONSE,
  S6: S6_INSTRUMENTAL_VARIABLE,
  S7: S7_DIFFERENCE_IN_DIFFERENCES,
  S8: S8_REGRESSION_DISCONTINUITY,
};

// Array of all SHEEP prompts for random selection
export const L1_SHEEP_PROMPT_LIST: PromptDefinition[] = Object.values(L1_SHEEP_PROMPTS);

// Get a random SHEEP prompt
export function getRandomSheepPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L1_SHEEP_PROMPT_LIST.length);
  return L1_SHEEP_PROMPT_LIST[idx];
}

// Get SHEEP prompt by ID
export function getSheepPromptById(id: string): PromptDefinition | undefined {
  return L1_SHEEP_PROMPTS[id];
}

