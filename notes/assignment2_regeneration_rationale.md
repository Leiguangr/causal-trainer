# Assignment 2 Case Regeneration Rationale

**Date:** January 26, 2026  
**Author:** Lei Gu  
**Course:** CS372 - Artificial General Intelligence for Reasoning, Planning, and Decision Making

---

## 1. Executive Summary

During preparation for Assignment 2, we discovered significant taxonomy misalignment between the cases generated in Assignment 1 (Juli's dataset) and the requirements specified in Assignment 2. After careful analysis, we determined that regenerating 170 cases from scratch using the correct taxonomy would be more efficient and produce higher-quality results than attempting to salvage and remap the existing cases.

---

## 2. Original Goal

**Assignment 2 Objective:** Validate a peer's Assignment 1 dataset and produce 170 cases with the following distribution:
- L1 (Association): 17 cases
- L2 (Intervention): 102 cases  
- L3 (Counterfactual): 51 cases

**Original Plan:** Use Juli's Assignment 1 cases as the base, validate them according to the Assignment 2 rubric, and supplement as needed.

---

## 3. Dataset Analysis: Juli's Assignment 1 Cases

### 3.1 Overall Statistics

| Level | Count | Percentage |
|-------|-------|------------|
| L1 | 17 | 14.0% |
| L2 | 80 | 66.1% |
| L3 | 24 | 19.8% |
| **Total** | **121** | 100% |

### 3.2 L1 Taxonomy Analysis

**Assignment 2 Requirements for L1:**
- WOLF types (NO cases): W1-W10 (Selection, Survivorship, Healthy User, Regression to Mean, Ecological Fallacy, Base Rate Neglect, Confounding, Simpson's Paradox, Reverse Causation, Post Hoc)
- SHEEP types (YES cases): S1-S8 (RCT, Natural Experiment, Lottery, Controlled Ablation, Mechanism+Dose, Instrumental Variable, Diff-in-Diff, Regression Discontinuity)
- Labels: YES / NO / AMBIGUOUS

**Juli's L1 Trap Types (17 cases):**
```
COLLIDER:      2 cases
CONFOUNDING:   1 case
GOODHART:      2 cases
NONE:          5 cases (likely YES cases without SHEEP classification)
REGRESSION:    2 cases
SELECTION:     2 cases
SIMPSONS:      2 cases
SURVIVORSHIP:  1 case
```

**Issues Identified:**
1. Uses L2-style trap names (e.g., COLLIDER, GOODHART) instead of L1 W-codes
2. WOLF types should use W1-W10 naming, not descriptive names
3. 5 cases marked as "NONE" - these appear to be YES cases but lack S1-S8 SHEEP classification
4. No cases explicitly use S1-S8 SHEEP evidence type codes

### 3.3 L2 Taxonomy Analysis

**Assignment 2 Requirements for L2:**
- 17 trap types: T1-T17 organized into 6 families
- All cases labeled NO (invalid causal claims requiring disambiguation)
- Must include: hidden question, conditional answers, wise refusal

**Juli's L2 Trap Types (80 cases):**
```
NONE:               43 cases (53.8%) ← CRITICAL ISSUE
COLLIDER:            5 cases → could map to T3
CONFOUNDER_MEDIATOR: 4 cases → could map to T9
CONFOUNDING:         5 cases → could map to T7
FEEDBACK:            5 cases → could map to T11
GOODHART:            5 cases → could map to T16
REVERSE:             4 cases → could map to T10
SELECTION:           4 cases → could map to T1
SIMPSONS:            5 cases → could map to T8
```

**Issues Identified:**
1. **54% of cases (43/80) have "NONE" as trap type** - these would require manual trap type assignment
2. Trap type names use descriptive text instead of T1-T17 codes
3. Missing trap types from the 17-type taxonomy: T2 (SURVIVORSHIP), T4 (IMMORTAL TIME), T5 (REGRESSION), T6 (ECOLOGICAL), T12 (TEMPORAL), T13 (MEASUREMENT), T14 (RECALL), T15 (MECHANISM), T17 (BACKFIRE)
4. Would require significant manual review to map and verify

### 3.4 L3 Taxonomy Analysis

**Assignment 2 Requirements for L3:**
- 8 families: F1-F8 (Deterministic, Probabilistic, Overdetermination, Structural, Temporal, Epistemic, Attribution, Moral/Legal)
- Labels: VALID / INVALID / CONDITIONAL
- Must include: invariants, counterfactual claim structure

**Juli's L3 Trap Types (24 cases):**
```
NONE:               9 cases (37.5%)
PREEMPTION:         3 cases
SELECTION:          3 cases
FEEDBACK:           3 cases
CONFOUNDING:        2 cases
CONFOUNDER_MEDIATOR: 2 cases
REVERSE:            2 cases
```

**Juli's L3 Labels:**
- Uses YES / NO / AMBIGUOUS (Assignment 1 format)
- Should use VALID / INVALID / CONDITIONAL (Assignment 2 format)

**Issues Identified:**
1. **Complete taxonomy mismatch** - uses L2-style trap types instead of F1-F8 families
2. **Wrong label format** - YES/NO instead of VALID/INVALID/CONDITIONAL
3. 37.5% of cases have "NONE" trap type
4. Trap types like PREEMPTION could theoretically map to F3 (Overdetermination), but the case structure and content don't align with L3 counterfactual requirements
5. **Not salvageable** - would require complete rewrite of all 24 cases

---

## 4. Root Cause Analysis

The taxonomy mismatch stems from differences between Assignment 1 and Assignment 2 specifications:

### Assignment 1 (Original Generation)
- Used a unified trap type naming scheme across all levels
- Less structured taxonomy without explicit type codes
- L3 used same YES/NO/AMBIGUOUS labels as L1/L2

### Assignment 2 (Validation & Expansion)
- Introduced level-specific type codes:
  - L1: W1-W10 (WOLF) and S1-S8 (SHEEP)
  - L2: T1-T17 (17 trap types in 6 families)
  - L3: F1-F8 (8 counterfactual families)
- L3 uses distinct labels: VALID/INVALID/CONDITIONAL
- More rigorous structure with explicit family organization

---

## 5. Options Considered

### Option A: Salvage and Remap Juli's Cases
**Pros:**
- Preserves original work
- Fulfills validation requirement

**Cons:**
- 54% of L2 cases need manual trap type assignment
- All L1 cases need W/S code remapping
- All L3 cases need complete rewrite (taxonomy + labels)
- Estimated effort: 8-10 hours of manual review
- Risk of inconsistency and errors

### Option B: Regenerate All 170 Cases from Scratch
**Pros:**
- Guaranteed taxonomy alignment
- Consistent quality across all cases
- Automated generation is fast (~1-2 hours)
- Clean, auditable dataset

**Cons:**
- Does not directly validate Juli's cases
- Original cases are discarded

### Decision: Option B - Regenerate from Scratch

**Rationale:**
1. The taxonomy mismatch is fundamental, not superficial
2. L3 cases are completely incompatible (0% salvageable)
3. Over 50% of L2 cases lack valid trap types
4. Regeneration with correct prompts ensures 100% compliance
5. Time investment for salvage (~10 hours) exceeds regeneration (~2 hours)
6. Higher confidence in final dataset quality

---

## 6. Implementation Details

### 6.1 Generation System
- **Platform:** causal-trainer web application
- **API:** `/api/admin/generate/v2`
- **Model:** GPT-4o with taxonomy-driven prompts
- **Seed system:** Diverse scenario seeds for variety

### 6.2 Prompt Alignment
All prompts verified against Assignment 2 guidelines:

**L1 Prompts (18 total):**
- W1-W10: 10 WOLF prompts for NO cases
- S1-S8: 8 SHEEP prompts for YES cases

**L2 Prompts (17 total):**
- T1-T17: One prompt per trap type
- All organized by family (F1-F6)

**L3 Prompts (21 total):**
- F1-F8 families × VALID/INVALID/CONDITIONAL where applicable
- F1: No CONDITIONAL (deterministic)
- F6: Only CONDITIONAL (epistemic limits)

### 6.3 Distribution Targets
```
Level  | Target | Distribution
-------|--------|-------------
L1     | 17     | 10% of 170
L2     | 102    | 60% of 170
L3     | 51     | 30% of 170
Total  | 170    | 100%
```

---

## 7. Lessons Learned

1. **Taxonomy Stability:** Assignment specifications should lock down taxonomy codes early to prevent dataset incompatibility across assignments.

2. **Schema Validation:** Automated validation should check trap type codes against allowed values at generation time.

3. **Version Control:** Different assignment versions should use versioned schemas to enable compatibility checking.

4. **Documentation:** Explicit mapping tables between old and new taxonomies would help with migration if needed.

---

## 8. Appendix: Taxonomy Reference

### L1 WOLF Types (W1-W10) - NO Cases
| Code | Name | Family |
|------|------|--------|
| W1 | Selection Bias | Selection |
| W2 | Survivorship Bias | Selection |
| W3 | Healthy User Bias | Selection |
| W4 | Regression to Mean | Selection |
| W5 | Ecological Fallacy | Ecological |
| W6 | Base Rate Neglect | Ecological |
| W7 | Confounding | Confounding |
| W8 | Simpson's Paradox | Confounding |
| W9 | Reverse Causation | Direction |
| W10 | Post Hoc Fallacy | Direction |

### L1 SHEEP Types (S1-S8) - YES Cases
| Code | Name | Tier |
|------|------|------|
| S1 | Randomized Controlled Trial | Core |
| S2 | Natural Experiment | Core |
| S3 | Lottery / Quasi-Random | Core |
| S4 | Controlled Ablation | Core |
| S5 | Mechanism + Dose-Response | Core |
| S6 | Instrumental Variable | Advanced |
| S7 | Difference-in-Differences | Advanced |
| S8 | Regression Discontinuity | Advanced |

### L2 Trap Types (T1-T17)
| Code | Name | Family |
|------|------|--------|
| T1 | SELECTION | F1: Selection Effects |
| T2 | SURVIVORSHIP | F1: Selection Effects |
| T3 | COLLIDER | F1: Selection Effects |
| T4 | IMMORTAL TIME | F1: Selection Effects |
| T5 | REGRESSION | F2: Statistical Artifacts |
| T6 | ECOLOGICAL | F2: Statistical Artifacts |
| T7 | CONFOUNDER | F3: Confounding |
| T8 | SIMPSON'S | F3: Confounding |
| T9 | CONF-MED | F3: Confounding |
| T10 | REVERSE | F4: Direction Errors |
| T11 | FEEDBACK | F4: Direction Errors |
| T12 | TEMPORAL | F4: Direction Errors |
| T13 | MEASUREMENT | F5: Information Bias |
| T14 | RECALL | F5: Information Bias |
| T15 | MECHANISM | F6: Mechanism Failures |
| T16 | GOODHART | F6: Mechanism Failures |
| T17 | BACKFIRE | F6: Mechanism Failures |

### L3 Counterfactual Families (F1-F8)
| Code | Name | Valid Answers |
|------|------|---------------|
| F1 | Deterministic | VALID, INVALID |
| F2 | Probabilistic | VALID, INVALID, CONDITIONAL |
| F3 | Overdetermination | VALID, INVALID, CONDITIONAL |
| F4 | Structural vs. Contingent | VALID, INVALID, CONDITIONAL |
| F5 | Temporal and Path-Dependent | VALID, INVALID, CONDITIONAL |
| F6 | Epistemic Limits | CONDITIONAL only |
| F7 | Causal Attribution | VALID, INVALID, CONDITIONAL |
| F8 | Moral and Legal Causation | VALID, INVALID, CONDITIONAL |

---

*Document created: January 26, 2026*
*Last updated: January 26, 2026*
