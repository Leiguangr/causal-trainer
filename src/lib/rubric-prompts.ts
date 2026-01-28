/**
 * Unified Rubric Prompts for T3 Case Quality Scoring
 * 
 * This file contains the unified 10-point rubric for evaluating
 * the quality of causal reasoning cases across all Pearl levels (L1, L2, L3).
 * The rubric is standardized per Table 7 in the assignment requirements.
 */

import type { PearlLevel, T3Case } from '@/types';
import { L2_TRAP_TAXONOMY, type L2TrapType } from './l2-trap-taxonomy';

export interface RubricScore {
  totalScore: number;
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  rubricVersion: string;
}

export type T3CaseType = 'L1' | 'L2' | 'L3';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Unified rubric payload for T3Case
export interface T3RubricPayload {
  case: T3Case;
}

function varValueToString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v == null) return 'Not specified';
  if (typeof v === 'object' && 'name' in v && typeof v.name === 'string') {
    return `${v.name}${'role' in v && typeof v.role === 'string' ? ` (${v.role})` : ''}`;
  }
  return JSON.stringify(v);
}

function getVar(variables: T3Case['variables'], key: 'X' | 'Y'): string {
  if (!variables) return 'Not specified';
  return varValueToString(variables[key]);
}

function getVarZ(variables: T3Case['variables']): string {
  if (!variables || !variables.Z) return 'Not specified';
  if (Array.isArray(variables.Z)) {
    return variables.Z.length > 0 ? variables.Z.join(', ') : 'Not specified';
  }
  return varValueToString(variables.Z);
}

function parseConditionalAnswers(conditionalAnswers: string | null | undefined): { answerIfA?: string; answerIfB?: string } {
  if (!conditionalAnswers) return {};
  try {
    const parsed = typeof conditionalAnswers === 'string' ? JSON.parse(conditionalAnswers) : conditionalAnswers;
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        answerIfA: parsed.answer_if_condition_1 || parsed.answerIfA || parsed.answer_if_A || '',
        answerIfB: parsed.answer_if_condition_2 || parsed.answerIfB || parsed.answer_if_B || '',
      };
    }
  } catch {
    // If parsing fails, treat as string
    return { answerIfA: conditionalAnswers as string, answerIfB: conditionalAnswers as string };
  }
  return {};
}

/**
 * Get L2 family for a given trap type
 */
function getL2FamilyForTrapType(trapType: string | null): string | null {
  if (!trapType || !trapType.startsWith('T')) return null;
  const trap = L2_TRAP_TAXONOMY.find(t => t.code === trapType);
  return trap?.family || null;
}

/**
 * Check if L1 trap type is WOLF (W1-W10), SHEEP (S1-S8), or AMBIGUOUS (A or null)
 */
function getL1TrapCategory(trapType: string | null): 'WOLF' | 'SHEEP' | 'AMBIGUOUS' | null {
  if (!trapType) return 'AMBIGUOUS';
  if (trapType.startsWith('W') && /^W([1-9]|10)$/.test(trapType)) return 'WOLF';
  if (trapType.startsWith('S') && /^S[1-8]$/.test(trapType)) return 'SHEEP';
  if (trapType === 'A') return 'AMBIGUOUS';
  return null;
}

/**
 * Validate variables structure
 */
function validateVariablesStructure(variables: T3Case['variables']): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!variables) {
    issues.push('Variables object is missing');
    return { isValid: false, issues };
  }

  // Check X structure
  if (variables.X) {
    const xType = typeof variables.X;
    if (xType === 'object' && variables.X !== null) {
      if (!('name' in variables.X) || typeof (variables.X as any).name !== 'string') {
        issues.push('X is an object but missing required "name" field (string)');
      }
      if ('role' in variables.X && typeof (variables.X as any).role !== 'string') {
        issues.push('X has "role" field but it is not a string');
      }
    } else if (xType !== 'string') {
      issues.push('X must be either a string or an object with {name: string, role?: string}');
    }
  } else {
    issues.push('X is missing');
  }

  // Check Y structure
  if (variables.Y) {
    const yType = typeof variables.Y;
    if (yType === 'object' && variables.Y !== null) {
      if (!('name' in variables.Y) || typeof (variables.Y as any).name !== 'string') {
        issues.push('Y is an object but missing required "name" field (string)');
      }
      if ('role' in variables.Y && typeof (variables.Y as any).role !== 'string') {
        issues.push('Y has "role" field but it is not a string');
      }
    } else if (yType !== 'string') {
      issues.push('Y must be either a string or an object with {name: string, role?: string}');
    }
  } else {
    issues.push('Y is missing');
  }

  // Check Z structure - MUST be an array
  if (variables.Z !== undefined && variables.Z !== null) {
    if (!Array.isArray(variables.Z)) {
      issues.push('Z MUST be an array (even if empty or single element), not a string or object');
    } else {
      // Check array elements are strings
      const nonStringElements = variables.Z.filter(item => typeof item !== 'string');
      if (nonStringElements.length > 0) {
        issues.push('Z array contains non-string elements');
      }
    }
  }

  return { isValid: issues.length === 0, issues };
}

/**
 * Build the unified T3 Case Quality Rubric prompt (Table 7)
 * This rubric applies to all levels (L1, L2, L3) with level-specific validation rules
 */
export function buildT3RubricPrompt(payload: T3RubricPayload): string {
  const { case: c } = payload;
  const variables = c.variables;
  const zStr = getVarZ(variables);
  const conditionalAnswers = parseConditionalAnswers(c.conditional_answers);
  
  // Validate variables structure
  const varValidation = validateVariablesStructure(variables);
  const varValidationNote = varValidation.isValid 
    ? '' 
    : `\n**⚠️ VARIABLES STRUCTURE ISSUES DETECTED:** ${varValidation.issues.join('; ')}. This affects Scenario Clarity scoring.`;

  // Get L1 trap category for validation
  const l1TrapCategory = c.pearl_level === 'L1' ? getL1TrapCategory(c.trap_type) : null;
  
  // Get L2 family for validation
  const l2Family = c.pearl_level === 'L2' ? getL2FamilyForTrapType(c.trap_type) : null;

  // Level-specific trap type validation rules (Table 8)
  const trapTypeGuidelines = c.pearl_level === 'L1'
    ? `**L1 (Association) Trap Type Guidelines:**
- Trap type must be W1–W10 (Wolf types) or S1–S8 (Sheep types) for L1. Null for AMBIGUOUS cases (ambiguity is about causal graph structure, not a trap)
- **CRITICAL LABEL-TRAP TYPE MAPPING (automatic failure if violated):**
  - If trap_type is W1–W10 (WOLF), label MUST be "NO" (invalid causal claim)
  - If trap_type is S1–S8 (SHEEP), label MUST be "YES" (valid causal claim)
  - If trap_type is "A" or null (AMBIGUOUS), label MUST be "AMBIGUOUS"
- **Trap Implementation Check:**
  - For WOLF cases (W1–W10): The case should appear to support a valid causal claim, but actually contains the specified trap type. If the trap is too obvious or the case doesn't appear valid, deduct points.
  - For SHEEP cases (S1–S8): The case should have strong evidence supporting a valid causal claim. If the evidence is weak or the causal mechanism is unclear, deduct points.
- Label must correctly identify trap type
- WOLF cases should appear valid but contain traps
- SHEEP cases should have strong evidence`
    : c.pearl_level === 'L2'
    ? `**L2 (Intervention) Trap Type Guidelines:**
- Trap type must be T1–T17 (17 trap types across 6 families)
- All L2 cases must be invalid causal claims (label must be "NO")
- **CRITICAL FAMILY-TRAP TYPE MAPPING (validate trap type belongs to correct family):**
  - F1 (Selection Effects): T1 (SELECTION), T2 (SURVIVORSHIP), T3 (COLLIDER), T4 (IMMORTAL TIME)
  - F2 (Statistical Artifacts): T5 (REGRESSION TO THE MEAN), T6 (ECOLOGICAL FALLACY)
  - F3 (Confounding): T7 (CONFOUNDER), T8 (SIMPSON'S PARADOX), T9 (CONF-MED)
  - F4 (Direction Errors): T10 (REVERSE CAUSATION), T11 (FEEDBACK), T12 (TEMPORAL)
  - F5 (Information Bias): T13 (MEASUREMENT BIAS), T14 (RECALL BIAS)
  - F6 (Mechanism Failures): T15 (MECHANISM), T16 (GOODHART'S LAW), T17 (BACKFIRE)
- Trap type must match family (F1–F6) and difficulty level`
    : `**L3 (Counterfactual) Trap Type Guidelines:**
- Trap type must be F1–F8 (8 families with subtypes)
- **CRITICAL LABEL-VALIDITY MAPPING:**
  - VALID label: Counterfactual claim is valid under stated invariants
  - INVALID label: Counterfactual claim is invalid under stated invariants
  - CONDITIONAL label: Validity depends on missing or ambiguous invariants
- Label must match counterfactual validity
- Trap type must align with family classification
- **INVARIANTS VALIDATION:** For L3 cases, invariants field must be present and clearly specify what is held fixed across worlds. Missing or unclear invariants affect conditional answers and wise refusal quality.`;

  // Level-specific label validation with explicit mappings
  const labelGuidelines = c.pearl_level === 'L1'
    ? `**L1 Label Values:** YES (valid causal claim - SHEEP cases), NO (invalid causal claim with identifiable trap - WOLF cases), AMBIGUOUS (unclear causal graph structure - different interpretations of causal relationships could lead to different validities, NOT for cases with identifiable traps)

**CRITICAL L1 LABEL-TRAP TYPE VALIDATION (automatic 0.0 points if violated):**
- If trap_type is W1–W10 (WOLF), label MUST be "NO" → If label is not "NO", assign 0.0 points
- If trap_type is S1–S8 (SHEEP), label MUST be "YES" → If label is not "YES", assign 0.0 points
- If trap_type is "A" or null (AMBIGUOUS), label MUST be "AMBIGUOUS" → If label is not "AMBIGUOUS", assign 0.0 points`
    : c.pearl_level === 'L2'
    ? `**L2 Label Values:** NO (all L2 cases must be labeled NO - invalid causal claims)

**CRITICAL L2 LABEL VALIDATION (automatic 0.0 points if violated):**
- ALL L2 cases MUST have label "NO" → If label is not "NO", assign 0.0 points immediately
- This is a hard requirement: L2 cases are intervention cases that must all be invalid causal claims`
    : `**L3 Label Values:** VALID (valid counterfactual claim), INVALID (invalid counterfactual claim), CONDITIONAL (conditional validity depending on context)

**L3 LABEL-VALIDITY VALIDATION:**
- VALID: Counterfactual claim is valid under stated invariants
- INVALID: Counterfactual claim is invalid under stated invariants  
- CONDITIONAL: Validity depends on missing or ambiguous invariants
- Label must align with the counterfactual claim and invariants specified in the case`;

  return `You are an expert evaluator using the **Unified T3 Case Quality Rubric** (Table 7) to assess the quality of a ${c.pearl_level} causal reasoning case. This unified rubric evaluates cases across all Pearl levels using the same 10-point structure.

---

# Unified T3 Case Quality Rubric (Total: **10.0 points**)

## CASE TO EVALUATE:

**SCENARIO**: ${c.scenario}

${c.claim ? `**CLAIM**: ${c.claim}${c.pearl_level === 'L1' || c.pearl_level === 'L2' ? '\n**CLAIM VALIDATION:** Verify the claim is clearly stated, matches the scenario, and uses appropriate causal language for the level.' : ''}` : c.pearl_level === 'L1' || c.pearl_level === 'L2' ? '\n**⚠️ CLAIM MISSING:** L1 and L2 cases should include a claim field. This affects Scenario Clarity scoring.' : ''}
${c.counterfactual_claim ? `**COUNTERFACTUAL CLAIM**: ${c.counterfactual_claim}${c.pearl_level === 'L3' ? '\n**COUNTERFACTUAL CLAIM VALIDATION:** Verify the counterfactual claim uses proper counterfactual language ("would have", "had X not occurred"), references X and Y correctly, and aligns with the scenario and invariants.' : ''}` : c.pearl_level === 'L3' ? '\n**⚠️ COUNTERFACTUAL CLAIM MISSING:** L3 cases must include a counterfactual_claim field. This is a critical requirement.' : ''}

**ASSIGNED LABELS**:
- Pearl Level: ${c.pearl_level}
- Label: ${c.label}
- Is Ambiguous: ${c.is_ambiguous}
- Trap Type: ${c.trap_type}${c.trap_type_name ? ` (${c.trap_type_name})` : ''}${c.trap_subtype ? ` / ${c.trap_subtype}${c.trap_subtype_name ? ` (${c.trap_subtype_name})` : ''}` : ''}${l2Family ? ` [Family: ${l2Family}]` : ''}${l1TrapCategory ? ` [Category: ${l1TrapCategory}]` : ''}
- Domain: ${c.domain || 'Not specified'}${c.subdomain ? ` / ${c.subdomain}` : ''}
- Difficulty: ${c.difficulty}
${c.pearl_level === 'L2' && l2Family ? `\n**L2 FAMILY VALIDATION:** Trap type ${c.trap_type} should belong to family ${l2Family}. Verify this mapping is correct.` : ''}
${c.pearl_level === 'L1' && l1TrapCategory ? `\n**L1 TRAP CATEGORY VALIDATION:** Trap type ${c.trap_type} is ${l1TrapCategory}. Label should be ${l1TrapCategory === 'WOLF' ? '"NO"' : l1TrapCategory === 'SHEEP' ? '"YES"' : '"AMBIGUOUS"'}. Verify this mapping is correct.` : ''}
${c.pearl_level === 'L3' && c.invariants ? `\n**L3 INVARIANTS:** ${typeof c.invariants === 'string' ? c.invariants : JSON.stringify(c.invariants)}` : ''}
${c.pearl_level === 'L3' && !c.invariants ? `\n**⚠️ L3 INVARIANTS MISSING:** L3 cases should include invariants field specifying what is held fixed across worlds. This affects conditional answers and wise refusal quality.` : ''}

**VARIABLES**:
- X: ${getVar(variables, 'X')}
- Y: ${getVar(variables, 'Y')}
- Z: ${zStr}

**CAUSAL STRUCTURE**: ${c.causal_structure || 'Not specified'}
${c.key_insight ? `**KEY INSIGHT**: ${c.key_insight}` : ''}
${c.hidden_timestamp ? `**HIDDEN TIMESTAMP/QUESTION**: ${typeof c.hidden_timestamp === 'string' ? c.hidden_timestamp : JSON.stringify(c.hidden_timestamp)}` : ''}
${conditionalAnswers.answerIfA ? `**CONDITIONAL ANSWER A**: ${conditionalAnswers.answerIfA}` : ''}
${conditionalAnswers.answerIfB ? `**CONDITIONAL ANSWER B**: ${conditionalAnswers.answerIfB}` : ''}
${c.wise_refusal ? `**WISE REFUSAL**: ${c.wise_refusal}` : ''}
${c.gold_rationale ? `**GOLD RATIONALE**: ${c.gold_rationale}` : ''}
${c.invariants ? `**INVARIANTS**: ${typeof c.invariants === 'string' ? c.invariants : JSON.stringify(c.invariants)}` : ''}

---

## RUBRIC CATEGORIES (Table 7):

### 1. Scenario Clarity — **1.0 point**

**Goal:** X, Y, Z clearly defined

**What is evaluated:**
- Are the key variables clearly defined?
- Can a reader identify:
  - **X** = exposure/treatment/predictor variable
  - **Y** = outcome variable
  - **Z** = confounders, mediators, colliders, or mechanisms (array)
- **CRITICAL: Variables Structure Validation (per Section B.2):**
  - X and Y must be either:
    - String: Direct description of the variable
    - Object: \`{name: string, role: string}\` format
  - Z MUST be an array of strings (even if empty or single element) - NOT a string or object
  - If Z is not an array format, deduct points

**Scoring (Maximum: 1.0 point):**
- **1.0 point**: X, Y, and Z (if applicable) are explicitly or unambiguously defined AND variables structure is correct (X/Y are string or object, Z is array)
- **0.5 point**: One variable is implicit but reasonably inferable, OR variables are clear but structure has minor issues (e.g., Z is string instead of array)
- **0.0 points**: Variables are unclear, overloaded, or confused, OR critical structure violations (e.g., Z is not an array when it should be)

**Important:** This category is scored out of 1.0 point maximum. Do not exceed 1.0 point.${varValidationNote}

---

### 2. Hidden Question Quality — **1.0 point**

**Goal:** Identifies key ambiguity

**What is evaluated:**
- Does the hidden question/timestamp directly target the **core causal ambiguity**?
- Is the question **necessary and sufficient** to resolve the ambiguity?
- Is it phrased as a *structural or temporal uncertainty*, not as a demand for more data in general?

**Scoring (Maximum: 1.0 point):**
- **1.0 point**: 
  - For non-ambiguous cases (label is YES/VALID/NO/INVALID): If hiddenTimestamp is missing, assign full marks (1.0) as it is optional for unambiguous cases.
  - For ambiguous cases (label is AMBIGUOUS/CONDITIONAL): Precisely captures the defining ambiguity. Answering would clearly distinguish between competing causal interpretations.
- **0.5 point**: Gestures at the right issue but is overly broad or slightly misaligned (only applies to ambiguous cases with a hiddenTimestamp present).
- **0.0 points**: Generic, irrelevant, or does not meaningfully distinguish between causal interpretations (only applies to ambiguous cases with a hiddenTimestamp present).

**Important:** This category is scored out of 1.0 point maximum. Do not exceed 1.0 point.

---

### 3. Conditional Answer A — **1.5 points**

**Goal:** Logically follows from condition A

**What is evaluated:**
- Does the answer **logically follow** if condition A is true?
- Is the causal interpretation internally consistent with the assumed structure?
- Does it clearly explain *why* X–Y appears as observed under A?
- **For L3 cases:** Does the answer properly reference invariants and explain how condition A affects the counterfactual validity under those invariants?

**Scoring:**
- **1.5 points**: 
  - For non-ambiguous cases (label is YES/VALID/NO/INVALID): If conditionalAnswerA is missing, assign full marks (1.5) as it is optional for unambiguous cases.
  - For ambiguous cases (label is AMBIGUOUS/CONDITIONAL): Logically sound, causally coherent, clearly derived from condition A. No internal contradictions. For L3, properly addresses invariants.
- **0.75 points**: Generally correct but vague, incomplete, or weakly justified (only applies to ambiguous cases with conditionalAnswerA present). For L3, may not fully address invariants.
- **0.0 points**: Does not actually follow from condition A. Contains causal errors or contradicts scenario (only applies to ambiguous cases with conditionalAnswerA present). For L3, ignores invariants when critical.

---

### 4. Conditional Answer B — **1.5 points**

**Goal:** Logically follows from condition B

**What is evaluated:**
- Is this answer **distinct from Answer A** and mutually exclusive?
- Does it follow logically from condition B?
- Does it plausibly explain the same observed data under a different causal structure?
- **For L3 cases:** Does the answer properly reference invariants and explain how condition B leads to a different counterfactual validity under those invariants?

**Scoring:**
- **1.5 points**: 
  - For non-ambiguous cases (label is YES/VALID/NO/INVALID): If conditionalAnswerB is missing, assign full marks (1.5) as it is optional for unambiguous cases.
  - For ambiguous cases (label is AMBIGUOUS/CONDITIONAL): Clearly different from A, logically valid, well-explained. Demonstrates a genuinely alternative causal interpretation. For L3, properly addresses invariants with alternative interpretation.
- **0.75 points**: Correct directionally but shallow, underdeveloped, or partially redundant with A (only applies to ambiguous cases with conditionalAnswerB present). For L3, may not fully address invariants.
- **0.0 points**: Essentially repeats Answer A. Does not logically follow from condition B (only applies to ambiguous cases with conditionalAnswerB present). For L3, ignores invariants when critical.

---

### 5. Wise Refusal Quality — **2.0 points**

**Goal:** Follows template

**What is evaluated:**
A proper wise refusal must follow this **template structure** and do **all of the following**:
1. Identify the specific causal ambiguity
2. State what information is missing
3. Present both conditional interpretations (if applicable)
4. Explicitly decline to conclude or endorse causality

**For L3 cases specifically:**
- Wise refusal should reference invariants and explain how missing or ambiguous invariants affect the counterfactual validity
- Should clearly state what would need to be known about the invariants to resolve the ambiguity

**Scoring:**
- **2.0 points**: All template elements present, clearly stated, well-integrated. Tone is neutral, cautious, and non-judgmental. For L3, properly references invariants.
- **1.0 point**: One element is weak, implicit, or missing. Still avoids endorsing a causal claim. For L3, may not fully address invariants.
- **0.0 points**: Endorses a causal conclusion. Fails to explain ambiguity or missing information. For L3, ignores invariants when they are critical.

---

### 6. Difficulty Calibration — **1.0 point**

**Goal:** Label matches complexity

**What is evaluated:**
- Does the difficulty label (Easy / Medium / Hard) align with:
  - Explicitness of signals
  - Structural complexity
  - Need for inference vs. recognition
  - Number of variables and temporal complexity

**Scoring:**
- **1.0 point**: Difficulty label is well-calibrated and defensible.
- **0.5 point**: Slight mismatch, but not egregious.
- **0.0 points**: Clear mislabeling (e.g., multi-stage temporal confounding labeled Easy).

---

### 7. Final Label — **1.0 point**

**Goal:** Correct label for level

**What is evaluated:**
${labelGuidelines}

**Scoring:**
${c.pearl_level === 'L1'
  ? `- **1.0 point**: Label is correct for the assigned level, matches the case content, AND correctly maps to trap type (WOLF→NO, SHEEP→YES, AMBIGUOUS→AMBIGUOUS).
- **0.5 point**: Label is plausible but may not perfectly match level requirements or trap type mapping.
- **0.0 points**: Label is incorrect for the level, contradicts the case content, OR violates label-trap type mapping (e.g., WOLF trap with YES label, SHEEP trap with NO label).`
  : c.pearl_level === 'L2'
  ? `- **1.0 point**: Label is "NO" (required for all L2 cases) and matches the case content.
- **0.5 point**: Label is "NO" but may not perfectly match case content.
- **0.0 points**: Label is NOT "NO" (automatic failure - all L2 cases must be labeled NO).`
  : `- **1.0 point**: Label is correct for L3 (VALID/INVALID/CONDITIONAL), matches counterfactual validity, and aligns with invariants.
- **0.5 point**: Label is plausible but may not perfectly match counterfactual validity or invariants.
- **0.0 points**: Label is incorrect for L3 or contradicts the counterfactual claim and invariants.`}

---

### 8. Trap Type — **1.0 point**

**Goal:** Correct trap type classification (see Table 8)

**What is evaluated:**
${trapTypeGuidelines}

**Scoring:**
${c.pearl_level === 'L1'
  ? `- **1.0 point**: Trap type is correct (W1–W10, S1–S8, or A/null), matches the level requirements, aligns with the case structure, AND the trap is correctly implemented (WOLF cases appear valid but contain traps, SHEEP cases have strong evidence).
- **0.5 point**: Trap type is plausible but may not perfectly match level requirements, OR trap implementation is weak (e.g., WOLF trap too obvious, SHEEP evidence unclear).
- **0.0 points**: Trap type is incorrect, misclassified, does not match the case structure, OR violates label-trap type mapping (e.g., WOLF trap with YES label).`
  : c.pearl_level === 'L2'
  ? `- **1.0 point**: Trap type is correct (T1–T17), matches the level requirements, aligns with the case structure, AND belongs to the correct family (F1–F6) per the family-trap type mapping.
- **0.5 point**: Trap type is plausible but may not perfectly match family/level requirements, OR family assignment is unclear.
- **0.0 points**: Trap type is incorrect, misclassified, does not match the case structure, OR trap type does not belong to the correct family (e.g., T1 should be F1, T7 should be F3).`
  : `- **1.0 point**: Trap type is correct (F1–F8), matches the level requirements, aligns with the case structure, AND label matches counterfactual validity under stated invariants.
- **0.5 point**: Trap type is plausible but may not perfectly match family classification or counterfactual validity.
- **0.0 points**: Trap type is incorrect, misclassified, or does not match the case structure or counterfactual validity.`}

---

## SUMMARY TABLE (Table 7)

| Criterion | Points |
|-----------|--------|
| Scenario clarity | 1.0 |
| Hidden question quality | 1.0 |
| Conditional answer A | 1.5 |
| Conditional answer B | 1.5 |
| Wise refusal quality | 2.0 |
| Difficulty calibration | 1.0 |
| Final label | 1.0 |
| Trap type | 1.0 |
| **Total** | **10.0** |

---

## ACCEPTANCE THRESHOLDS (Unified for all Pearl Levels)

Per Section A.3 of the assignment requirements:
- **≥ 8.0** → ACCEPT (High-quality case; suitable for benchmark inclusion)
- **6.0–7.0** → REVISE (Core idea is sound, but one or more components need improvement)
- **< 6.0** → REJECT (Structural or conceptual flaws undermine the case; must be regenerated and re-scored)

**Note:** Cases scoring 6.0–7.0 (inclusive) should be revised. Cases scoring below 6.0 should be rejected, regenerated, and re-scored.

---

## YOUR TASK:

Evaluate the case above using this unified rubric. Return a JSON object with the following structure (JSON only, using snake_case for all keys):

\`\`\`json
{
  "category_scores": {
    "scenario_clarity": 0-1.0,
    "hidden_question_quality": 0-1.0,
    "conditional_answer_a": 0-1.5,
    "conditional_answer_b": 0-1.5,
    "wise_refusal_quality": 0-2.0,
    "difficulty_calibration": 0-1.0,
    "final_label": 0-1.0,
    "trap_type": 0-1.0
  },
  "category_notes": {
    "scenario_clarity": "Brief justification for the score...",
    "hidden_question_quality": "Brief justification for the score...",
    "conditional_answer_a": "Brief justification for the score...",
    "conditional_answer_b": "Brief justification for the score...",
    "wise_refusal_quality": "Brief justification for the score...",
    "difficulty_calibration": "Brief justification for the score...",
    "final_label": "Brief justification for the score...",
    "trap_type": "Brief justification for the score..."
  },
  "total_score": 0-10.0
}
\`\`\`

**Important:**
- Calculate total_score as the sum of all category_scores
- Provide clear, specific justifications in category_notes
- Be strict but fair in your evaluation
- Use decimal scores (0.5, 0.75, 1.5) as specified in the rubric
- **CRITICAL:** Each category has a maximum score. Do not exceed:
  - scenario_clarity: Maximum 1.0 point
  - hidden_question_quality: Maximum 1.0 point
  - conditional_answer_a: Maximum 1.5 points
  - conditional_answer_b: Maximum 1.5 points
  - wise_refusal_quality: Maximum 2.0 points
  - difficulty_calibration: Maximum 1.0 point
  - final_label: Maximum 1.0 point
  - trap_type: Maximum 1.0 point
- Pay special attention to level-specific requirements for Final Label and Trap Type categories
- For non-ambiguous cases (YES/VALID/NO/INVALID labels), assign full marks to optional fields (hidden_question_quality, conditional_answer_a, conditional_answer_b) if they are missing
- **CRITICAL VALIDATION CHECKS:**
  ${c.pearl_level === 'L1' ? `- L1: Verify label-trap type mapping (WOLF→NO, SHEEP→YES, AMBIGUOUS→AMBIGUOUS). If violated, assign 0.0 to final_label and trap_type.
  - L1: Verify trap implementation (WOLF cases should appear valid but contain traps, SHEEP cases should have strong evidence).` : ''}
  ${c.pearl_level === 'L2' ? `- L2: Verify label is "NO" (all L2 cases must be NO). If not "NO", assign 0.0 to final_label immediately.
  - L2: Verify trap type belongs to correct family (T1-T4→F1, T5-T6→F2, T7-T9→F3, T10-T12→F4, T13-T14→F5, T15-T17→F6).` : ''}
  ${c.pearl_level === 'L3' ? `- L3: Verify invariants are present and clearly specified. Missing invariants affect conditional answers and wise refusal.
  - L3: Verify counterfactual claim uses proper language and aligns with scenario and invariants.
  - L3: Verify label matches counterfactual validity under stated invariants.` : ''}
- **Variables Structure:** Verify X/Y are string or object, Z is array. Structure violations affect scenario_clarity scoring.`;
}

/**
 * Legacy compatibility: Build rubric prompt from T3Case
 * This is the main entry point for the unified rubric
 */
export function buildRubricPrompt(payload: T3RubricPayload): string {
  return buildT3RubricPrompt(payload);
}

// ---------------------------------------------------------------------------
// Legacy compatibility layer (Question-based rubrics)
// ---------------------------------------------------------------------------

export interface QuestionForEvaluationLegacy {
  id: string;
  scenario: string;
  claim: string;
  pearl_level: string;
  domain: string;
  subdomain?: string | null;
  trap_type: string;
  trap_subtype: string;
  ground_truth: string;
  explanation: string;
  variables?: string | null;
  causal_structure?: string | null;
  key_insight?: string | null;
  wise_refusal?: string | null;
  difficulty?: string | null;
  hidden_timestamp?: string | null;
  conditional_answers?: string | null;
  counterfactual_claim?: string | null;
  invariants?: string[] | null;
  family?: string | null;
  justification?: string | null;
}

export function buildRubricPromptFromQuestion(
  question: QuestionForEvaluationLegacy,
  pearlLevel: PearlLevel
): string {
  let variables: T3Case['variables'] = null;
  try {
    if (question.variables) {
      const parsed = JSON.parse(question.variables);
      if (parsed && typeof parsed === 'object') {
        variables = {
          X: parsed.X || '',
          Y: parsed.Y || '',
          Z: Array.isArray(parsed.Z) ? parsed.Z : parsed.Z ? [parsed.Z] : [],
        };
      }
    }
  } catch {
    // ignore parse errors
  }

  const difficulty = (question.difficulty?.toLowerCase() as Difficulty | undefined) || 'medium';

  // Parse conditional_answers if present
  let answerIfA: string | null = null;
  let answerIfB: string | null = null;
  if (question.conditional_answers) {
    try {
      const parsed = JSON.parse(question.conditional_answers);
      answerIfA = parsed.answer_if_condition_1 || parsed.answerIfA || null;
      answerIfB = parsed.answer_if_condition_2 || parsed.answerIfB || null;
    } catch {
      // ignore
    }
  }

  // Construct a T3Case-like object for the rubric (using snake_case to match T3Case interface)
  const t3Case: T3Case = {
    id: question.id,
    case_id: null,
    bucket: null,
    pearl_level: pearlLevel,
    domain: question.domain,
    subdomain: question.subdomain ?? null,
    scenario: question.scenario,
    claim: question.claim,
    counterfactual_claim: question.counterfactual_claim ?? null,
    label: (question.ground_truth as T3Case['label']) || (pearlLevel === 'L2' ? 'NO' : pearlLevel === 'L3' ? 'CONDITIONAL' : 'AMBIGUOUS'),
    is_ambiguous: question.ground_truth === 'AMBIGUOUS' || question.ground_truth === 'CONDITIONAL',
    variables,
    trap_type: question.trap_type,
    trap_type_name: null,
    trap_subtype: question.trap_subtype || null,
    trap_subtype_name: null,
    difficulty,
    causal_structure: question.causal_structure ?? null,
    key_insight: question.key_insight ?? null,
    hidden_timestamp: question.hidden_timestamp ?? null,
    conditional_answers: answerIfA && answerIfB
      ? JSON.stringify({ answer_if_condition_1: answerIfA, answer_if_condition_2: answerIfB })
      : null,
    wise_refusal: question.wise_refusal ?? null,
    gold_rationale: question.explanation ?? question.justification ?? null,
    invariants: question.invariants ? JSON.stringify(question.invariants) : null,
    initial_author: null,
    validator: null,
    final_score: null,
    dataset: 'legacy',
    author: null,
    source_case: null,
    generation_batch_id: null,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  return buildT3RubricPrompt({ case: t3Case });
}
