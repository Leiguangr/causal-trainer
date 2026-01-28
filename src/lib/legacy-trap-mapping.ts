/**
 * Legacy trap_type (Question table) → T3Case taxonomy mapping.
 * Used by "Copy Approved Legacy Cases" to assign correct trap_type per Pearl level.
 * Legacy uses names like CONFOUNDING, REVERSE; T3Case uses W1–W10/S1–S8 (L1), T1–T17 (L2), F1–F8 (L3).
 */

export type PearlLevel = 'L1' | 'L2' | 'L3';

/** L1 evidence codes: W1–W10 (WOLF), S1–S8 (SHEEP), null for AMBIGUOUS */
export type L1Code = string | null;
/** L2 trap codes T1–T17 */
export type L2Code = string;
/** L3 family codes F1–F8 */
export type L3Code = string;

const LEGACY_TO_L1: Record<string, L1Code> = {
  CONFOUNDING: 'W7',
  REVERSE: 'W9',
  SELECTION: 'W1',
  SURVIVORSHIP: 'W2',
  REGRESSION: 'W4',
  'REGRESSION TO THE MEAN': 'W4',
  'ECOLOGICAL FALLACY': 'W5',
  'BASE RATE': 'W6',
  "SIMPSON'S PARADOX": 'W8',
  SIMPSONS: 'W8',
  'POST HOC': 'W10',
  COLLIDER: null, // L1 has no collider; LLM infers from scenario (e.g. selection-like) or use AMBIGUOUS
  'HEALTHY USER': 'W3',
  RCT: 'S1',
  'NATURAL EXPERIMENT': 'S2',
  LOTTERY: 'S3',
  ABLATION: 'S4',
  'DOSE-RESPONSE': 'S5',
  IV: 'S6',
  'INSTRUMENTAL VARIABLE': 'S6',
  DID: 'S7',
  'DIFFERENCE-IN-DIFFERENCES': 'S7',
  RD: 'S8',
  'REGRESSION DISCONTINUITY': 'S8',
  SPURIOUS: 'W7',
  'CONF-MED': null, // Confounder–mediator ambiguity; L1 has no exact match
  PROXY: null,
  'SELF-FULFILL': null,
  GOODHART: null,
  COUNTERFACTUAL: null,
};

const LEGACY_TO_L2: Record<string, L2Code> = {
  CONFOUNDING: 'T7',
  REVERSE: 'T10',
  SELECTION: 'T1',
  SURVIVORSHIP: 'T2',
  COLLIDER: 'T3',
  'IMMORTAL TIME': 'T4',
  REGRESSION: 'T5',
  'REGRESSION TO THE MEAN': 'T5',
  'ECOLOGICAL FALLACY': 'T6',
  "SIMPSON'S PARADOX": 'T8',
  SIMPSONS: 'T8',
  'CONF-MED': 'T9',
  FEEDBACK: 'T11',
  TEMPORAL: 'T12',
  'MEASUREMENT BIAS': 'T13',
  'RECALL BIAS': 'T14',
  MECHANISM: 'T15',
  GOODHART: 'T16',
  'GOODHART\'S LAW': 'T16',
  BACKFIRE: 'T17',
  SPURIOUS: 'T7',
  PROXY: 'T15',
  'SELF-FULFILL': 'T15',
  'BASE RATE': 'T5', // approximate
  COUNTERFACTUAL: 'T15', // approximate; L3 is primary
};

const LEGACY_TO_L3: Record<string, L3Code> = {
  COUNTERFACTUAL: 'F1',
  DETERMINISTIC: 'F1',
  PROBABILISTIC: 'F2',
  OVERDETERMINATION: 'F3',
  STRUCTURAL: 'F4',
  TEMPORAL: 'F5',
  EPISTEMIC: 'F6',
  ATTRIBUTION: 'F7',
  MORAL: 'F8',
  LEGAL: 'F8',
  CONFOUNDING: 'F1', // generic fallback
};

function normalizeLegacy(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return '';
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Map legacy trap_type to L1 evidence code (W1–W10, S1–S8, or null for AMBIGUOUS).
 */
export function mapLegacyToL1(legacyTrap: string | null | undefined): L1Code {
  const n = normalizeLegacy(legacyTrap);
  if (!n) return null;
  return LEGACY_TO_L1[n] ?? null;
}

/**
 * Map legacy trap_type to L2 trap code (T1–T17).
 */
export function mapLegacyToL2(legacyTrap: string | null | undefined): L2Code {
  const n = normalizeLegacy(legacyTrap);
  if (!n) return 'T1';
  return LEGACY_TO_L2[n] ?? 'T1';
}

/**
 * Map legacy trap_type or family to L3 family code (F1–F8).
 */
export function mapLegacyToL3(legacyTrap: string | null | undefined): L3Code {
  const n = normalizeLegacy(legacyTrap);
  if (!n) return 'F1';
  return LEGACY_TO_L3[n] ?? 'F1';
}

/**
 * Get suggested taxonomy code for a legacy case by pearl level.
 */
export function mapLegacyToTaxonomy(
  pearlLevel: PearlLevel,
  legacyTrap: string | null | undefined
): string | null {
  if (pearlLevel === 'L1') return mapLegacyToL1(legacyTrap);
  if (pearlLevel === 'L2') return mapLegacyToL2(legacyTrap);
  return mapLegacyToL3(legacyTrap);
}
