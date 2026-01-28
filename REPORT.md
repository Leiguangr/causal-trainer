# CS372 Assignment 2: T³ Benchmark Expansion
## Analysis Report

**Group:** G (Markets)  
**Student:** Lei Gu (lgren007@stanford.edu)  
**Date:** January 27, 2026

---

## 1. Summary of Unvalidated vs. Validated Dataset

### Overview

| Metric | Unvalidated | Validated (≥8) |
|--------|-------------|----------------|
| **Total Cases** | 944 | 552 |
| **Acceptance Rate** | - | 58.5% |

### Data Sources

| Source | Cases | Accepted | Acceptance Rate |
|--------|-------|----------|-----------------|
| New Generation (GPT-5.2) | 493 | 456 | 92.5% |
| Assignment 1 Import (All Authors) | 451 | 212 | 47.0% |

### Key Improvements During Validation

1. **Quality Filtering**: Removed cases scoring below 8/10 on the rubric
2. **Format Standardization**: Converted Assignment 1 format to Assignment 2 schema
3. **Trap Type Mapping**: Mapped legacy trap names (e.g., "CONFOUNDING") to new codes (e.g., "W7", "T7")
4. **Difficulty Distribution**: Implemented 1:2:1 (Easy:Medium:Hard) ratio in new generation
5. **Schema Compliance**: Ensured all cases include required fields (initial_author, validator, final_score)

### Current Dataset Composition

After filtering to keep only:
- All cases by lgren007@stanford.edu
- Juli's 36 accepted cases (julih@stanford.edu)

| Author | Total | Accepted |
|--------|-------|----------|
| lgren007@stanford.edu | 608 | 516 |
| julih@stanford.edu | 36 | 36 |
| **Total** | **644** | **552** |

---

## 2. Pearl Level Distribution

### Current Distribution

| Pearl Level | Total Cases | Accepted (≥8) | Target Ratio |
|-------------|-------------|---------------|--------------|
| **L1** (Association) | 72 | 52 | 10% |
| **L2** (Intervention) | 393 | 358 | 60% |
| **L3** (Counterfactual) | 179 | 142 | 30% |
| **Total** | **644** | **552** | 100% |

### Percentage Comparison

| Level | Current % | Target % | Status |
|-------|-----------|----------|--------|
| L1 | 11.2% | 10% | ✓ Close |
| L2 | 61.0% | 60% | ✓ On target |
| L3 | 27.8% | 30% | ✓ Close |

### Comparison: Before vs After Validation

| Level | Before Validation | After Validation | Change |
|-------|-------------------|------------------|--------|
| L1 | 72 | 52 | -28% |
| L2 | 393 | 358 | -9% |
| L3 | 179 | 142 | -21% |

---

## 3. Label Distribution

### L1 (Association) Labels

| Label | Count | Description |
|-------|-------|-------------|
| **NO** (WOLF) | 37 | Invalid causal claims with traps |
| **YES** (SHEEP) | 31 | Valid causal claims with evidence |
| **AMBIGUOUS** | 4 | Conditional on missing information |
| **Total** | **72** | |

### L2 (Intervention) Labels

| Label | Count | Notes |
|-------|-------|-------|
| **NO** | 363 | Per spec: all L2 cases are traps |
| YES | 24 | Legacy cases (should be NO) |
| AMBIGUOUS | 6 | Legacy cases |
| **Total** | **393** | |

*Note: 30 L2 cases from Assignment 1 imports have non-standard labels (YES/AMBIGUOUS). Per Assignment 2 spec, all L2 cases should be labeled NO as they represent intervention traps.*

### L3 (Counterfactual) Labels

| Label | Count | % |
|-------|-------|---|
| **INVALID** | 71 | 39.7% |
| **CONDITIONAL** | 55 | 30.7% |
| **VALID** | 53 | 29.6% |
| **Total** | **179** | 100% |

---

## 4. Trap Type Distribution

### L1: WOLF Types (NO Cases)

| Code | Name | Count |
|------|------|-------|
| W1 | Selection Bias | 6 |
| W2 | Survivorship Bias | 3 |
| W3 | Healthy User Bias | 2 |
| W4 | Regression to Mean | 4 |
| W5 | Ecological Fallacy | 3 |
| W6 | Base Rate Neglect | 2 |
| W7 | Confounding | 5 |
| W8 | Simpson's Paradox | 3 |
| W9 | Reverse Causation | 5 |
| W10 | Post Hoc Fallacy | 2 |
| **Total WOLF** | | **35** |

### L1: SHEEP Types (YES Cases)

| Code | Name | Count |
|------|------|-------|
| S1 | RCT | 14 |
| S2 | Natural Experiment | 4 |
| S3 | Lottery/Quasi-Random | 3 |
| S4 | Controlled Ablation | 3 |
| S5 | Mechanism + Dose | 3 |
| S6 | Instrumental Variable | 2 |
| S7 | Diff-in-Diff | 3 |
| S8 | Regression Discontinuity | 3 |
| **Total SHEEP** | | **35** |

### L2: Trap Types (T1-T17)

| Code | Name | Count |
|------|------|-------|
| T1 | Selection | 25 |
| T2 | Survivorship | 18 |
| T3 | Collider | 26 |
| T4 | Immortal Time | 17 |
| T5 | Regression | 18 |
| T6 | Ecological | 17 |
| T7 | Confounder | 33 |
| T8 | Simpson's | 25 |
| T9 | Conf-Med | 17 |
| T10 | Reverse | 28 |
| T11 | Feedback | 25 |
| T12 | Temporal | 17 |
| T13 | Measurement | 18 |
| T14 | Recall | 17 |
| T15 | Mechanism | 18 |
| T16 | Goodhart | 27 |
| T17 | Backfire | 17 |

*Note: Some legacy cases mapped to non-standard codes*

### L3: Family Distribution (F1-F8)

| Code | Name | Count |
|------|------|-------|
| F1 | Deterministic | 14 |
| F2 | Probabilistic | 19 |
| F3 | Overdetermination | 19 |
| F4 | Structural | 19 |
| F5 | Temporal | 19 |
| F6 | Epistemic | 19 |
| F7 | Attribution | 19 |
| F8 | Moral/Legal | 18 |

---

## 5. Difficulty Level Distribution

### Overall Distribution

| Difficulty | Count | Percentage | Target |
|------------|-------|------------|--------|
| **Easy** | 119 | 18.5% | 25% |
| **Medium** | 393 | 61.0% | 50% |
| **Hard** | 132 | 20.5% | 25% |
| **Total** | **644** | 100% | |

### By Pearl Level

| Level | Easy | Medium | Hard | Total |
|-------|------|--------|------|-------|
| L1 | 12 (17%) | 45 (63%) | 15 (21%) | 72 |
| L2 | 74 (19%) | 235 (60%) | 84 (21%) | 393 |
| L3 | 33 (18%) | 113 (63%) | 33 (18%) | 179 |

### Comparison: New vs Legacy Cases

| Source | Easy | Medium | Hard | Ratio |
|--------|------|--------|------|-------|
| New (GPT-5.2) | 115 (23%) | 248 (50%) | 130 (26%) | ~1:2:1 ✓ |
| Assignment 1 | 4 (3%) | 145 (96%) | 2 (1%) | Skewed |

*The new generation follows the 1:2:1 target ratio. Assignment 1 cases were predominantly Medium difficulty.*

---

## 6. Score Summary

### Score Statistics

| Metric | Value |
|--------|-------|
| **Average Score** | 9.03 |
| **Minimum Score** | 3.0 |
| **Maximum Score** | 10.0 |
| **Median Score** | ~9.5 |

### Score Distribution

| Score Range | Count | % | Status |
|-------------|-------|---|--------|
| **10.0** | ~150 | 23% | Accepted |
| **9.0-9.5** | ~280 | 43% | Accepted |
| **8.0-8.5** | ~122 | 19% | Accepted |
| **6.0-7.5** | 73 | 11% | Needs Revision |
| **< 6.0** | 19 | 3% | Rejected |

### Acceptance by Source

| Source | Accepted | Revision | Rejected | Accept Rate |
|--------|----------|----------|----------|-------------|
| New (GPT-5.2) | 456 | 35 | 2 | **92.5%** |
| Assignment 1 | 212 | 158 | 81 | **47.0%** |

### Rubric Criteria (10-Point Scale)

| Criterion | Points | Description |
|-----------|--------|-------------|
| Scenario Clarity | 1.0 | X, Y, Z clearly defined |
| Hidden Question Quality | 1.0 | Identifies key ambiguity |
| Conditional Answer A | 1.5 | Logically follows from condition A |
| Conditional Answer B | 1.5 | Logically follows from condition B |
| Wise Refusal Quality | 2.0 | Complete answer with verdict |
| Difficulty Calibration | 1.0 | Label matches complexity |
| Final Label | 1.0 | Correct label for Pearl level |
| Trap Type | 1.0 | Correctly classified trap type |
| **Total** | **10.0** | |

---

## 7. Prompt Setup

### LLM Configuration

| Parameter | Value |
|-----------|-------|
| **Model** | GPT-5.2 |
| **Temperature** | 0.85 |
| **Response Format** | JSON |
| **API Method** | OpenAI Batch API |

### Generation Methodology

#### Hierarchical Sampling Approach

1. **Level 1: Pearl Level Selection**
   - Target distribution: 10% L1, 60% L2, 30% L3
   - Weighted sampling based on remaining needs

2. **Level 2: Answer Type Selection**
   - L1: YES (50%) / NO (40%) / AMBIGUOUS (10%)
   - L2: Always NO (per spec - all are traps)
   - L3: VALID (35%) / INVALID (25%) / CONDITIONAL (40%)

3. **Level 3: Difficulty Selection**
   - 1:2:1 ratio (Easy:Medium:Hard)
   - 25% Easy, 50% Medium, 25% Hard

4. **Level 4: Specific Type Selection**
   - L1: WOLF type (W1-W10) or SHEEP type (S1-S8)
   - L2: Trap type (T1-T17)
   - L3: Family (F1-F8)

#### Prompt Engineering Approach

1. **Modular Prompt System**: Separate prompt templates for each Pearl level and trap type
2. **Scenario Seeding**: Pre-generated seeds with entities, timeframes, events, and contexts
3. **Domain Focus**: All cases in the Markets domain with diverse subdomains
4. **Quality Checklist**: Embedded validation criteria in prompts
5. **Difficulty Guidance**: Explicit instructions for each difficulty level

#### Key Prompt Components

- **Output Format**: Structured JSON schema with all required fields
- **Trap Type Definitions**: Detailed descriptions and validation checklists
- **Example Cases**: High-quality examples for each trap type
- **Wise Refusal Templates**: Format guidance for YES/NO/AMBIGUOUS responses
- **Difficulty Definitions**:
  - Easy: Obvious trap, common scenario
  - Medium: Requires careful reading, subtle trap
  - Hard: Multiple factors, expert knowledge needed

### Quality Control Measures

1. **Automated Validation**: GPT-5.2 batch validation with 10-point rubric
2. **Schema Validation**: JSON schema compliance checking
3. **Distribution Monitoring**: Real-time tracking of Pearl level and trap type coverage
4. **Score Thresholds**: Accept (≥8), Revise (6-7), Reject (<6)

---

## 8. Example Case

### L2 (Intervention) - Selection Bias (T1)

```json
{
  "id": "T3-Markets-L2-T1-001",
  "pearl_level": "L2",
  "domain": "Markets",
  "subdomain": "Risk management and hedging",
  "scenario": "In Q3 2024, after a major policy shift triggered a regulatory change, Bank ABC piloted a new FX-hedging rule: automatically add 3-month USD call options when Credit Agency flags 'high risk.' The pilot was run only on ABC's top-tier corporate clients who already buy hedges through Insurance Corp. Over the quarter, this group's reported earnings volatility fell 25%, and ABC proposed rolling it out to all corporate clients.",
  "claim": "Rolling out Bank ABC's automatic 3-month USD call-option hedging rule to all corporate clients causes a 25% reduction in reported earnings volatility.",
  "label": "NO",
  "variables": {
    "X": {
      "name": "Automatic 3-month USD call-option hedging rule applied",
      "role": "exposure"
    },
    "Y": {
      "name": "Reported earnings volatility over the quarter",
      "role": "outcome"
    },
    "Z": ["Client inclusion in pilot (top-tier clients already using Insurance Corp hedges / higher hedging sophistication)"]
  },
  "trap": {
    "type": "T1",
    "type_name": "Selection",
    "subtype": "Non-representative sample",
    "subtype_name": "Selection Bias"
  },
  "difficulty": "Easy",
  "causal_structure": "Selection into the pilot (Z) depends on client sophistication and prior hedging infrastructure, which also affects earnings volatility (Y); the observed X→Y reduction is estimated only within a non-representative selected group, so it may not generalize to all clients.",
  "key_insight": "An intervention's apparent benefit in a hand-picked subgroup doesn't identify its effect in the full population.",
  "hidden_timestamp": null,
  "conditional_answers": {
    "answer_if_condition_1": null,
    "answer_if_condition_2": null
  },
  "wise_refusal": "NO. This is a selection-bias problem: the intervention was evaluated on a non-representative subset that is systematically different from the target population. The scenario says the pilot was run only on 'top-tier corporate clients who already buy hedges through Insurance Corp,' who are likely more hedging-savvy and better governed. Because that selection is related to earnings volatility, the 25% drop in this group does not justify claiming the same causal effect for all corporate clients.",
  "gold_rationale": "The intervention was tested only on a selected subset: 'top-tier corporate clients who already buy hedges through Insurance Corp.' That selection is related to the outcome because sophisticated clients with established hedging programs typically have lower and more controllable volatility. Therefore, the 25% reduction observed in the pilot is not a valid estimate for all clients.",
  "initial_author": "lgren007@stanford.edu",
  "validator": "batch-validator",
  "final_score": 10.0
}
```

### Why This Case Demonstrates Good Quality

1. **Clear Scenario**: Specific details (Q3 2024, Bank ABC, 3-month USD calls, 25% reduction)
2. **Well-Defined Variables**: X (hedging rule), Y (volatility), Z (client selection)
3. **Correct Trap Identification**: Selection bias (T1) - pilot on non-representative sample
4. **Strong Wise Refusal**: Starts with verdict (NO), identifies the trap, quotes scenario evidence
5. **Appropriate Difficulty**: Easy - the selection bias is explicitly stated in the scenario
6. **Complete Metadata**: All required fields present with proper formatting

---

## Appendix: File Deliverables

### 1. Schema File: `groupG_LeiGu_schema.json`
- JSON schema defining all case fields
- Type definitions and validation rules

### 2. Score File: `groupG_LeiGu_score.json`
- Quality scores for validated cases
- Rubric breakdown for each case

### 3. Dataset File: `groupG_LeiGu_dataset.json`
- Final validated dataset with 170+ cases
- All required fields per Assignment 2 spec

### 4. Coding Pipeline
- `/scripts/batch-generate.ts` - Batch case generation
- `/scripts/batch-validate.ts` - Automated validation
- `/src/lib/prompts/` - Modular prompt system
- `/src/lib/assignment2-taxonomy.ts` - Trap type definitions
