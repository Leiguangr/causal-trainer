/**
 * Rubric Prompts for Case Quality Scoring
 * 
 * This file contains generator- and reviewer-ready rubrics for evaluating
 * the quality of causal reasoning cases at each Pearl level (L1, L2, L3).
 * These rubrics are designed for both human QA and automated/semi-automated scoring.
 */

import type { PearlLevel } from '@/types';

export interface RubricScore {
  totalScore: number;
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  rubricVersion: string;
}

export type T3CaseType = 'L1' | 'L2' | 'L3';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface T3BaseRubricPayload {
  caseType: T3CaseType;
  id: string;
  dataset: string;
  generationBatchId?: string | null;
  difficulty: Difficulty;
  scenario: string;
  variables: Record<string, unknown>;
  causalStructure?: string | null;
}

export interface L1RubricPayload extends T3BaseRubricPayload {
  caseType: 'L1';
  claim: string;
  groundTruth: 'YES' | 'NO' | 'AMBIGUOUS';
  evidenceClass: 'WOLF' | 'SHEEP' | 'NONE';
  evidenceType?: string | null;
  whyFlawedOrValid: string;
  domain?: string | null;
  subdomain?: string | null;
}

export interface L2RubricPayload extends T3BaseRubricPayload {
  caseType: 'L2';
  trapType: string; // T1..T17
  hiddenQuestion: string;
  answerIfA: string;
  answerIfB: string;
  wiseRefusal: string;
}

export interface L3RubricPayload extends T3BaseRubricPayload {
  caseType: 'L3';
  family: string; // F1..F8
  counterfactualClaim: string;
  invariants: string[];
  groundTruth: 'VALID' | 'INVALID' | 'CONDITIONAL';
  justification: string;
  wiseResponse: string;
  domain?: string | null;
}

export type T3RubricPayload = L1RubricPayload | L2RubricPayload | L3RubricPayload;

function varValueToString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v == null) return 'Not specified';
  return JSON.stringify(v);
}

function getVar(variables: Record<string, unknown>, key: string): string {
  return varValueToString(variables[key]);
}

function getVarZ(variables: Record<string, unknown>): string {
  const z = variables['Z'];
  if (Array.isArray(z)) return z.map(varValueToString).join(', ');
  return varValueToString(z);
}

function asL1GroundTruth(raw: string | null | undefined): L1RubricPayload['groundTruth'] {
  if (raw === 'YES' || raw === 'NO' || raw === 'AMBIGUOUS') return raw;
  return 'AMBIGUOUS';
}

function asL3GroundTruth(raw: string | null | undefined): L3RubricPayload['groundTruth'] {
  if (raw === 'VALID' || raw === 'INVALID' || raw === 'CONDITIONAL') return raw;
  return 'CONDITIONAL';
}

/**
 * Build the L1 Case Quality Rubric prompt
 */
export function buildL1RubricPrompt(payload: L1RubricPayload): string {
  const variables = payload.variables;
  const zStr = getVarZ(variables);

  return `You are an expert evaluator using the **L1 Case Quality Rubric** to assess the quality of an L1 causal reasoning case. This rubric evaluates whether the case text reliably elicits the correct judgment (WOLF = NO, SHEEP = YES).

---

# L1 Case Quality Rubric (Total: **10 points**)

## CASE TO EVALUATE:

**SCENARIO**: ${payload.scenario}

**CLAIM**: ${payload.claim}

**ASSIGNED LABELS**:
- Case Type: L1
- Ground Truth: ${payload.groundTruth}
- Evidence Class: ${payload.evidenceClass}
- Evidence Type: ${payload.evidenceType ?? 'Not specified'}
- Domain: ${payload.domain ?? 'Not specified'}${payload.subdomain ? ` / ${payload.subdomain}` : ''}
- Difficulty: ${payload.difficulty}

**VARIABLES**:
- X (Claimed Cause): ${getVar(variables, 'X')}
- Y (Claimed Effect): ${getVar(variables, 'Y')}
- Z (Confounder/Instrument/Stratifier): ${zStr}

**CAUSAL STRUCTURE**: ${payload.causalStructure || 'Not specified'}

**WHY FLAWED/VALID**: ${payload.whyFlawedOrValid}

---

## RUBRIC CATEGORIES:

### 1. Scenario Clarity — **2 points** *(required)*

**Goal:** The causal story is legible without ambiguity.

**What is evaluated:**
- Are the key variables clearly defined?
- Can a reader identify:
  - **X** = claimed cause
  - **Y** = claimed effect
  - **Z** = confounder / instrument / stratifier (if applicable)

**Scoring:**
- **2 points**: X, Y (and Z if relevant) are explicitly or unambiguously defined
- **1 point**: One variable is implicit but reasonably inferable
- **0 points**: Variables are unclear, overloaded, or confused

**Automatic fail conditions:**
- Multiple competing Xs or Ys
- Z introduced but not causally interpretable

---

### 2. Causal Claim Explicitness — **1 point**

**Goal:** The model is not guessing what judgment is being tested.

**What is evaluated:**
- Is there a **clear causal claim** stated in the scenario?
- Is the claim phrased as causation (not mere association)?

**Scoring:**
- **1 point**: Explicit causal claim ("X causes Y")
- **0 points**: Only correlational language or no explicit claim

> *Rationale*: L1 evaluates judgment of a claim, not inference of one.

---

### 3. Wise Refusal Quality — **2 points** *(required)*

**Goal:** The case cleanly instantiates **exactly one** causal pattern.

**What is evaluated:**
- Does the scenario follow the **correct template** for its declared subtype?
- Are **required elements present** and **forbidden elements absent**?

**Scoring:**
- **2 points**: Clean instantiation; no leakage from other types
- **1 point**: Minor noise but dominant pattern is intact
- **0 points**: Mixed signals (e.g., confounding + post hoc)

**Automatic fail conditions:**
- WOLF case includes valid causal identification
- SHEEP case contains unresolved confounding or bias

---

### 4. Ground Truth Unambiguity — **2 points**

**Goal:** The correct answer is determinable *from the text alone*.

**What is evaluated:**
- Would informed reviewers independently agree on YES/NO?
- Is any critical information missing that could flip the answer?

**Scoring:**
- **2 points**: Ground truth is unambiguous
- **1 point**: Slight ambiguity but dominant interpretation is clear
- **0 points**: Plausible disagreement among experts

**Automatic fail conditions:**
- "It depends" is a reasonable answer
- Requires external data or assumptions

---

### 5. Difficulty Calibration — **1 point** *(required)*

**Goal:** The labeled difficulty matches the inferential load.

**What is evaluated:**
- Does the stated difficulty (Easy / Medium / Hard) align with:
  - Explicitness of signals
  - Structural complexity
  - Need for inference vs. recognition

**Scoring:**
- **1 point**: Difficulty label is appropriate
- **0 points**: Case is mis-labeled (e.g., trivial but marked Hard)

---

### 6. Domain Plausibility & Realism — **1 point**

**Goal:** The case feels like something that *could actually occur*.

**What is evaluated:**
- Is the domain realistic and internally consistent?
- Are actors, behaviors, and outcomes plausible?

**Scoring:**
- **1 point**: Realistic and coherent
- **0 points**: Artificial, contrived, or implausible

> *Note*: This improves generalization and reduces pattern overfitting.

---

### 7. Noise Discipline (No Extraneous Cues) — **1 point**

**Goal:** The case tests causal reasoning, not keyword spotting.

**What is evaluated:**
- Absence of:
  - Irrelevant statistics
  - Redundant explanations
  - Meta-language ("this study proves…")
- No cues that trivially give away the answer

**Scoring:**
- **1 point**: High signal-to-noise ratio
- **0 points**: Distracting or leading information present

---

## SUMMARY TABLE

| Category                  | Points |
| ------------------------- | ------ |
| Scenario clarity          | 2      |
| Causal claim explicitness | 1      |
| Wise refusal quality      | 2      |
| Ground truth unambiguity  | 2      |
| Difficulty calibration    | 1      |
| Domain plausibility       | 1      |
| Noise discipline          | 1      |
| **Total**                 | **10** |

---

## ACCEPTANCE THRESHOLDS

- **8–10** → ACCEPT (benchmark quality)
- **6–7** → REVISE (fixable issues)
- **≤5** → REJECT (structural failure)

---

## YOUR TASK:

Evaluate the case above using this rubric. Return a JSON object with the following structure (JSON only):

\`\`\`json
{
  "categoryScores": {
    "scenarioClarity": 0-2,
    "causalClaimExplicitness": 0-1,
    "wiseRefusalQuality": 0-2,
    "groundTruthUnambiguity": 0-2,
    "difficultyCalibration": 0-1,
    "domainPlausibility": 0-1,
    "noiseDiscipline": 0-1
  },
  "categoryNotes": {
    "scenarioClarity": "Brief justification for the score...",
    "causalClaimExplicitness": "Brief justification for the score...",
    "wiseRefusalQuality": "Brief justification for the score...",
    "groundTruthUnambiguity": "Brief justification for the score...",
    "difficultyCalibration": "Brief justification for the score...",
    "domainPlausibility": "Brief justification for the score...",
    "noiseDiscipline": "Brief justification for the score..."
  },
  "totalScore": 0-10
}
\`\`\`

**Important:**
- Calculate totalScore as the sum of all categoryScores
- Provide clear, specific justifications in categoryNotes
- Be strict but fair in your evaluation`;
}

/**
 * Build the L2 Case Quality Rubric prompt
 */
export function buildL2RubricPrompt(payload: L2RubricPayload): string {
  const variables = payload.variables;

  return `You are an expert evaluator using the **T3-L2 Case Scoring Rubric** to assess the quality of an L2 causal reasoning case. This rubric evaluates whether the case text correctly handles causal ambiguity and conditional reasoning.

---

# T3-L2 Case Scoring Rubric (Total: 10 points)

## CASE TO EVALUATE:

**SCENARIO**: ${payload.scenario}

**VARIABLES**:
- X (Exposure): ${getVar(variables, 'X')}
- Y (Outcome): ${getVar(variables, 'Y')}
- Z (Ambiguous Variable): ${getVar(variables, 'Z')}

**ANNOTATIONS**:
- Case Type: L2
- Trap Type: ${payload.trapType || 'Not specified'}
- Difficulty: ${payload.difficulty}
- Causal Structure: ${payload.causalStructure || 'Not specified'}

**HIDDEN QUESTION**: ${payload.hiddenQuestion || 'Not specified'}

**CONDITIONAL ANSWERS**:
- **Answer if A**: ${payload.answerIfA || 'Not specified'}
- **Answer if B**: ${payload.answerIfB || 'Not specified'}

**WISE REFUSAL**: ${payload.wiseRefusal || 'Not specified'}

---

## RUBRIC CATEGORIES:

### 1. Scenario Clarity — **2.0 points**

**Goal:** Ensure the causal setup is legible and structurally complete.

**What to evaluate:**
- Are **X (exposure)**, **Y (outcome)**, and **Z (ambiguous variable)** explicitly identified?
- Are their roles *consistent* across the scenario, variables list, and later reasoning?
- Is the observed association between X and Y clearly stated?

**Scoring:**
- **2.0 (Full credit)**: X, Y, and Z are all explicitly named and clearly defined. Roles are unambiguous and consistent. Scenario clearly states an observed relationship between X and Y.
- **1.0 (Partial credit)**: X and Y are clear, but Z is vague, implicit, or inconsistently described. Minor confusion about roles, but intended structure is recoverable.
- **0.0 (No credit)**: One or more of X, Y, Z are missing, mislabeled, or interchangeable. Scenario does not clearly describe what is being correlated or compared.

**Common failure modes:**
- Z mentioned narratively but never defined as an explicit variable
- Multiple candidates for X or Y with no clear primary one
- Scenario reads like a conclusion rather than an observation

---

### 2. Hidden Question Quality — **2.0 points**

**Goal:** Test whether the case correctly identifies the *pivotal missing information*.

**What to evaluate:**
- Does the hidden question directly target the **core causal ambiguity** of the labeled trap type?
- Is the question **necessary and sufficient** to resolve the ambiguity?
- Is it phrased as a *structural or temporal uncertainty*, not as a demand for more data in general?

**Scoring:**
- **2.0 (Full credit)**: Precisely captures the trap's defining ambiguity. Answering would clearly distinguish between two competing causal interpretations. Aligns tightly with labeled trap type.
- **1.0 (Partial credit)**: Gestures at the right issue but is overly broad, underspecified, or slightly misaligned. Would reduce uncertainty but not fully resolve it.
- **0.0 (No credit)**: Generic ("Is there a confounder?") or irrelevant. Does not meaningfully distinguish between causal interpretations.

**Common failure modes:**
- Asking for more data instead of identifying *what kind* of data matters
- Hidden question that already assumes one answer
- Question mismatched to trap type

---

### 3. Conditional Answer A — **1.5 points**

**Goal:** Evaluate correctness and coherence under condition A.

**What to evaluate:**
- Does the answer **logically follow** if condition A is true?
- Is the causal interpretation internally consistent with the assumed structure?
- Does it clearly explain *why* X–Y appears as observed under A?

**Scoring:**
- **1.5 (Full credit)**: Logically sound, causally coherent, clearly derived from condition A. No internal contradictions.
- **0.75 (Partial credit)**: Generally correct but vague, incomplete, or weakly justified. Some causal steps implied rather than explained.
- **0.0 (No credit)**: Does not actually follow from condition A. Contains causal errors or contradicts scenario.

**Common failure modes:**
- Restating the condition instead of reasoning from it
- Sneaking in assumptions not stated in condition A
- Describing correlation rather than causal interpretation

---

### 4. Conditional Answer B — **1.5 points**

**Goal:** Ensure genuine duality and symmetry in reasoning.

**What to evaluate:**
- Is this answer **distinct from Answer A** and mutually exclusive?
- Does it follow logically from condition B?
- Does it plausibly explain the same observed data under a different causal structure?

**Scoring:**
- **1.5 (Full credit)**: Clearly different from A, logically valid, well-explained. Demonstrates a genuinely alternative causal interpretation.
- **0.75 (Partial credit)**: Correct directionally but shallow, underdeveloped, or partially redundant with A.
- **0.0 (No credit)**: Essentially repeats Answer A. Does not logically follow from condition B.

**Common failure modes:**
- "Mirror answers" with swapped labels but same logic
- One answer clearly stronger or more plausible than the other (collapsing ambiguity)

---

### 5. Wise Refusal Quality — **2.0 points**

**Goal:** Assess whether the model appropriately declines to endorse a causal claim.

**What to evaluate:**
A proper wise refusal must do **all four** of the following:
1. Identify the specific causal ambiguity
2. State what information is missing
3. Present both conditional interpretations
4. Explicitly decline to conclude or endorse causality

**Scoring:**
- **2.0 (Full credit)**: All four elements present, clearly stated, well-integrated. Tone is neutral, cautious, and non-judgmental.
- **1.0 (Partial credit)**: One element is weak, implicit, or missing. Still avoids endorsing a causal claim.
- **0.0 (No credit)**: Endorses a causal conclusion. Fails to explain ambiguity or missing information.

**Common failure modes:**
- Saying "more research is needed" without specifying what
- Choosing one interpretation as "more likely"
- Omitting one conditional interpretation

---

### 6. Difficulty Calibration — **1.0 point**

**Goal:** Ensure the labeled difficulty matches the reasoning complexity.

**What to evaluate:**
- Does the difficulty label (Easy / Medium / Hard) reflect: Number of variables, Temporal complexity, Subtlety of ambiguity, Cognitive load?

**Scoring:**
- **1.0 (Full credit)**: Difficulty label is well-calibrated and defensible.
- **0.5 (Partial credit)**: Slight mismatch (e.g., Medium labeled as Easy), but not egregious.
- **0.0 (No credit)**: Clear mislabeling (e.g., multi-stage temporal confounding labeled Easy).

**Common failure modes:**
- Overusing "Hard" to signal importance
- Labeling single-confounder cases as Hard

---

## SUMMARY TABLE

| Category                  | Points |
| ------------------------- | ------ |
| Scenario Clarity          | 2.0    |
| Hidden Question Quality   | 2.0    |
| Conditional Answer A      | 1.5    |
| Conditional Answer B      | 1.5    |
| Wise Refusal Quality      | 2.0    |
| Difficulty Calibration    | 1.0    |
| **Total**                 | **10** |

---

## ACCEPTANCE THRESHOLDS

- **≥ 8.0** → ACCEPT (High-quality case; suitable for benchmark inclusion)
- **6.0–7.5** → REVISE (Core idea is sound, but one or more components need improvement)
- **< 6.0** → REJECT (Structural or conceptual flaws undermine the case)

---

## YOUR TASK:

Evaluate the case above using this rubric. Return a JSON object with the following structure (JSON only):

\`\`\`json
{
  "categoryScores": {
    "scenarioClarity": 0-2.0,
    "hiddenQuestionQuality": 0-2.0,
    "conditionalAnswerA": 0-1.5,
    "conditionalAnswerB": 0-1.5,
    "wiseRefusalQuality": 0-2.0,
    "difficultyCalibration": 0-1.0
  },
  "categoryNotes": {
    "scenarioClarity": "Brief justification...",
    "hiddenQuestionQuality": "Brief justification...",
    "conditionalAnswerA": "Brief justification...",
    "conditionalAnswerB": "Brief justification...",
    "wiseRefusalQuality": "Brief justification...",
    "difficultyCalibration": "Brief justification..."
  },
  "totalScore": 0-10.0
}
\`\`\`

**Important:**
- Calculate totalScore as the sum of all categoryScores
- Provide clear, specific justifications in categoryNotes
- Be strict but fair in your evaluation
- Use decimal scores (0.5, 0.75, 1.5) as specified in the rubric`;
}

/**
 * Build the L3 Case Quality Rubric prompt
 */
export function buildL3RubricPrompt(payload: L3RubricPayload): string {
  const variables = payload.variables;
  const invariantsList = payload.invariants
    ? payload.invariants.map(i => `- ${i}`).join('\n')
    : 'Not specified';

  return `You are an expert evaluator using the **T3-L3 Counterfactual Case Evaluation Rubric** to assess the quality of an L3 counterfactual reasoning case. This rubric evaluates whether the case text correctly handles counterfactual logic, invariants, and causal mechanisms.

---

# T3-L3 Counterfactual Case Evaluation Rubric (Total: 10 points)

## CASE TO EVALUATE:

**SCENARIO**: ${payload.scenario}

**VARIABLES**:
- X (Antecedent): ${getVar(variables, 'X')}
- Y (Consequent): ${getVar(variables, 'Y')}
- Z (Mechanism/Context): ${getVar(variables, 'Z')}

**INVARIANTS**:
${invariantsList}

**COUNTERFACTUAL CLAIM**: ${payload.counterfactualClaim || 'Not specified'}

**ANNOTATIONS**:
- Case Type: L3
- Family: ${payload.family || 'Not specified'}
- Difficulty: ${payload.difficulty}
- Ground Truth: ${payload.groundTruth}

**JUSTIFICATION**: ${payload.justification || 'Not specified'}

**WISE RESPONSE**: ${payload.wiseResponse || 'Not specified'}

---

## RUBRIC CATEGORIES:

### 1. Self-Contained — **2.0 points**

**Requirement:** The scenario includes *all information needed* to evaluate the counterfactual under Pearl L3. No external facts, domain expertise, or unstated common knowledge are required.

**What to check:**
- Can the counterfactual be judged **using only the scenario + invariants**?
- Are all causal mechanisms either explicitly stated or explicitly marked as unknown?
- Does the justification rely on facts not present in the scenario?

**Scoring:**
- **2.0**: Fully self-contained; all causal reasoning is grounded in stated facts or explicitly missing invariants.
- **1.0**: Minor leakage (e.g., implicit real-world assumptions), but judgment is still reasonably grounded.
- **0.0**: Requires external knowledge or unstated assumptions to determine the label.

**Common failure modes:**
- "Obviously X causes Y" without explanation.
- Hidden reliance on real-world statistics, laws, or norms not stated.
- Missing key mechanism while still labeled VALID or INVALID.

---

### 2. Clarity of Variables & Invariants — **2.0 points**

**Requirement:** X (antecedent), Y (consequent), Z (mechanisms/context), and invariants are **unambiguous, separable, and coherent across worlds**.

**What to check:**
- Is X a *single, well-defined change*?
- Is Y a *clearly identifiable outcome*?
- Are invariants explicitly stated and internally consistent?
- Can the alternative world be imagined without contradiction?

**Scoring:**
- **2.0**: X, Y, Z, and invariants are explicit, precise, and non-overlapping.
- **1.0**: Mostly clear, but minor ambiguity or mild conflation exists.
- **0.0**: Ambiguous variables, shifting definitions, or unclear invariants.

**Common failure modes:**
- Multiple changes bundled into X.
- Y defined vaguely ("things would be better").
- Invariants that silently contradict the counterfactual action.

---

### 3. Counterfactual Correctness — **2.0 points**

**Requirement:** The assigned label (VALID / INVALID / CONDITIONAL) is **defensible under the stated invariants**, and the justification follows Pearl L3 logic.

**What to check:**
- Does the justification correctly apply: But-for reasoning? Overdetermination awareness? Stochastic vs deterministic logic?
- If CONDITIONAL: Are the *missing invariants explicitly identified*? Do alternative completions plausibly lead to different labels?

**Scoring:**
- **2.0**: Label is clearly correct; justification is sound and fully grounded.
- **1.0**: Label is plausible but justification is incomplete or slightly misaligned.
- **0.0**: Label is incorrect or unsupported by the scenario.

**Common failure modes:**
- Deterministic label in a stochastic scenario without justification.
- CONDITIONAL used as a hedge when the answer is actually determined.
- Ignoring backup causes or alternative paths.

---

### 4. Family Fit — **1.5 points**

**Requirement:** The case clearly tests the **intended counterfactual reasoning family (F1–F8)** and aligns with its guiding question.

**What to check:**
- Is the *core difficulty* the one defined for the assigned family?
- Would the case confuse a different family's reasoning trap?
- Does the case meaningfully exercise L3 reasoning rather than L1/L2?

**Scoring:**
- **1.5**: Strong, unambiguous fit; family assignment is clearly justified.
- **0.75**: Partial fit; case could plausibly belong to another family.
- **0.0**: Misclassified; main difficulty does not match the assigned family.

**Common failure modes:**
- Epistemic cases mislabeled as probabilistic.
- Structural cases that are really overdetermination.
- Attribution cases that reduce to simple but-for logic.

---

### 5. Novelty — **1.5 points**

**Requirement:** The case is not a trivial paraphrase or superficial variant of an existing or canonical example.

**What to check:**
- Does the case introduce a new mechanism, configuration of causes, or domain framing?
- Or is it merely re-skinning a standard example?

**Scoring:**
- **1.5**: Clearly novel structure or insight.
- **0.75**: Some novelty, but closely resembles known patterns.
- **0.0**: Trivial or formulaic variant.

**Common failure modes:**
- Renaming variables without changing structure.
- Copying classic examples (e.g., "two assassins") without new twists.

---

### 6. Realism — **1.0 point**

**Requirement:** The scenario is **plausible** as a real-world or realistic hypothetical and does not rely on contrived or incoherent setups.

**What to check:**
- Could this scenario reasonably occur?
- Do agents behave plausibly?
- Are the causal mechanisms believable within the stated world?

**Scoring:**
- **1.0**: Fully plausible and coherent.
- **0.5**: Slightly artificial but acceptable.
- **0.0**: Implausible, incoherent, or cartoonish.

**Common failure modes:**
- Physically impossible mechanisms.
- Agents with unrealistic foresight or precision.
- Contrived coincidences used to force a label.

---

## SUMMARY TABLE

| Category                  | Points |
| ------------------------- | ------ |
| Self-Contained            | 2.0    |
| Clarity of Variables      | 2.0    |
| Counterfactual Correctness| 2.0    |
| Family Fit                | 1.5    |
| Novelty                   | 1.5    |
| Realism                   | 1.0    |
| **Total**                 | **10** |

---

## ACCEPTANCE THRESHOLDS

- **9–10** → ACCEPT (Benchmark-quality L3 case)
- **7–8.5** → REVISE (Solid case; minor refinements needed)
- **5–6.5** → REJECT (Usable but flawed; revise before inclusion)
- **< 5** → REJECT (Not suitable for L3 benchmarking)

---

## YOUR TASK:

Evaluate the case above using this rubric. Return a JSON object with the following structure (JSON only):

\`\`\`json
{
  "categoryScores": {
    "selfContained": 0-2.0,
    "clarity": 0-2.0,
    "correctness": 0-2.0,
    "familyFit": 0-1.5,
    "novelty": 0-1.5,
    "realism": 0-1.0
  },
  "categoryNotes": {
    "selfContained": "Brief justification...",
    "clarity": "Brief justification...",
    "correctness": "Brief justification...",
    "familyFit": "Brief justification...",
    "novelty": "Brief justification...",
    "realism": "Brief justification..."
  },
  "totalScore": 0-10.0
}
\`\`\`

**Important:**
- Calculate totalScore as the sum of all categoryScores
- Provide clear, specific justifications in categoryNotes
- Be strict but fair in your evaluation
- Use decimal scores (0.5, 0.75, 1.5) as specified in the rubric`;
}

/**
 * Select and build the appropriate rubric prompt based on Pearl level
 */
export function buildRubricPrompt(payload: T3RubricPayload): string {
  switch (payload.caseType) {
    case 'L1':
      return buildL1RubricPrompt(payload);
    case 'L2':
      return buildL2RubricPrompt(payload);
    case 'L3':
      return buildL3RubricPrompt(payload);
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy compatibility layer (Question-based rubrics)
// ---------------------------------------------------------------------------

export interface QuestionForEvaluationLegacy {
  id: string;
  scenario: string;
  claim: string;
  pearlLevel: string;
  domain: string;
  subdomain?: string | null;
  trapType: string;
  trapSubtype: string;
  groundTruth: string;
  explanation: string;
  variables?: string | null;
  causalStructure?: string | null;
  keyInsight?: string | null;
  wiseRefusal?: string | null;
  difficulty?: string | null;
  hiddenQuestion?: string | null;
  answerIfA?: string | null;
  answerIfB?: string | null;
  counterfactualClaim?: string | null;
  invariants?: string[] | null;
  family?: string | null;
  justification?: string | null;
}

export function buildRubricPromptFromQuestion(
  question: QuestionForEvaluationLegacy,
  pearlLevel: PearlLevel
): string {
  let variables: Record<string, unknown> = {};
  try {
    if (question.variables) variables = JSON.parse(question.variables);
  } catch {
    // ignore parse errors
  }

  const difficulty = (question.difficulty?.toLowerCase() as Difficulty | undefined) || 'medium';

  if (pearlLevel === 'L1') {
    const payload: L1RubricPayload = {
      caseType: 'L1',
      id: question.id,
      dataset: 'legacy',
      generationBatchId: null,
      difficulty,
      scenario: question.scenario,
      variables,
      causalStructure: question.causalStructure ?? null,
      claim: question.claim,
      groundTruth: asL1GroundTruth(question.groundTruth),
      evidenceClass: 'NONE',
      evidenceType: question.trapType ?? null,
      whyFlawedOrValid: question.explanation,
      domain: question.domain,
      subdomain: question.subdomain ?? null,
    };
    return buildL1RubricPrompt(payload);
  }

  if (pearlLevel === 'L2') {
    const payload: L2RubricPayload = {
      caseType: 'L2',
      id: question.id,
      dataset: 'legacy',
      generationBatchId: null,
      difficulty,
      scenario: question.scenario,
      variables,
      causalStructure: question.causalStructure ?? null,
      trapType: question.trapType,
      hiddenQuestion: question.hiddenQuestion ?? 'Not specified',
      answerIfA: question.answerIfA ?? 'Not specified',
      answerIfB: question.answerIfB ?? 'Not specified',
      wiseRefusal: question.wiseRefusal ?? 'Not specified',
    };
    return buildL2RubricPrompt(payload);
  }

  const payload: L3RubricPayload = {
    caseType: 'L3',
    id: question.id,
    dataset: 'legacy',
    generationBatchId: null,
    difficulty,
    scenario: question.scenario,
    variables,
    causalStructure: question.causalStructure ?? null,
    family: question.family ?? 'Not specified',
    counterfactualClaim: question.counterfactualClaim ?? 'Not specified',
    invariants: question.invariants ?? [],
    groundTruth: asL3GroundTruth(question.groundTruth),
    justification: question.justification ?? question.explanation ?? 'Not specified',
    wiseResponse: question.wiseRefusal ?? 'Not specified',
    domain: question.domain,
  };
  return buildL3RubricPrompt(payload);
}
