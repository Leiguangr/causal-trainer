/**
 * L2 NO Prompts Index
 * 17 trap types for NO cases (invalid intervention claims)
 */

import { PromptDefinition } from '../../types';

import { T1_SELECTION } from './T1-selection';
import { T2_SURVIVORSHIP } from './T2-survivorship';
import { T3_COLLIDER } from './T3-collider';
import { T4_IMMORTAL_TIME } from './T4-immortal-time';
import { T5_REGRESSION } from './T5-regression';
import { T6_ECOLOGICAL } from './T6-ecological';
import { T7_CONFOUNDER } from './T7-confounder';
import { T8_SIMPSONS } from './T8-simpsons';
import { T9_CONF_MED } from './T9-conf-med';
import { T10_REVERSE } from './T10-reverse';
import { T11_FEEDBACK } from './T11-feedback';
import { T12_TEMPORAL } from './T12-temporal';
import { T13_MEASUREMENT } from './T13-measurement';
import { T14_RECALL } from './T14-recall';
import { T15_MECHANISM } from './T15-mechanism';
import { T16_GOODHART } from './T16-goodhart';
import { T17_BACKFIRE } from './T17-backfire';

// Export all NO prompts
export {
  T1_SELECTION,
  T2_SURVIVORSHIP,
  T3_COLLIDER,
  T4_IMMORTAL_TIME,
  T5_REGRESSION,
  T6_ECOLOGICAL,
  T7_CONFOUNDER,
  T8_SIMPSONS,
  T9_CONF_MED,
  T10_REVERSE,
  T11_FEEDBACK,
  T12_TEMPORAL,
  T13_MEASUREMENT,
  T14_RECALL,
  T15_MECHANISM,
  T16_GOODHART,
  T17_BACKFIRE,
};

// Map of trap ID to prompt definition
export const L2_NO_PROMPTS: Record<string, PromptDefinition> = {
  T1: T1_SELECTION,
  T2: T2_SURVIVORSHIP,
  T3: T3_COLLIDER,
  T4: T4_IMMORTAL_TIME,
  T5: T5_REGRESSION,
  T6: T6_ECOLOGICAL,
  T7: T7_CONFOUNDER,
  T8: T8_SIMPSONS,
  T9: T9_CONF_MED,
  T10: T10_REVERSE,
  T11: T11_FEEDBACK,
  T12: T12_TEMPORAL,
  T13: T13_MEASUREMENT,
  T14: T14_RECALL,
  T15: T15_MECHANISM,
  T16: T16_GOODHART,
  T17: T17_BACKFIRE,
};

// Array of all NO prompts for random selection
export const L2_NO_PROMPT_LIST: PromptDefinition[] = Object.values(L2_NO_PROMPTS);

// Get a random NO prompt
export function getRandomL2NoPrompt(): PromptDefinition {
  const idx = Math.floor(Math.random() * L2_NO_PROMPT_LIST.length);
  return L2_NO_PROMPT_LIST[idx];
}

// Get NO prompt by ID
export function getL2NoPromptById(id: string): PromptDefinition | undefined {
  return L2_NO_PROMPTS[id];
}

// Prompts grouped by family
export const L2_NO_BY_FAMILY = {
  F1_SELECTION: [T1_SELECTION, T2_SURVIVORSHIP, T3_COLLIDER, T4_IMMORTAL_TIME],
  F2_STATISTICAL: [T5_REGRESSION, T6_ECOLOGICAL],
  F3_CONFOUNDING: [T7_CONFOUNDER, T8_SIMPSONS, T9_CONF_MED],
  F4_DIRECTION: [T10_REVERSE, T11_FEEDBACK, T12_TEMPORAL],
  F5_INFORMATION: [T13_MEASUREMENT, T14_RECALL],
  F6_MECHANISM: [T15_MECHANISM, T16_GOODHART, T17_BACKFIRE],
};

