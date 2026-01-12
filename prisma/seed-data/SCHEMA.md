# Question Schema for Causal Trainer

This document defines the **unified question schema** for generation, storage, review, and export. All new questions (LLM‑generated and hand‑authored) should use this shape.

Legacy columns/fields like `claim` and `explanation` may still exist in the database for backward compatibility, but they are **logically deprecated** and should not be used for new content.

## JSON Schema (Unified)

```jsonc
{
  "sourceCase": "string (required)",

  // Single field containing both setup AND causal claim with inline tags
  // Use (X), (Y), (Z) to mark variables in text; can reference X', Y' for counterfactuals
  "scenario": "string (required)",

  "pearlLevel": "L1 | L2 | L3 (required)",
  "domain": "string (required)",
  "subdomain": "string (required) - short phrase summarizing topic within domain",

  "trapType": "string (required) - exactly one primary trap type",
  "trapSubtype": "string (optional) - more specific subtype, or empty if none fits",

  "difficulty": "easy | medium | hard (required)",
  "groundTruth": "VALID | INVALID | CONDITIONAL (required)",

  "variables": {
    "X": "string (required) - exposure/treatment",
    "Y": "string (required) - outcome",
    "Z": "string (required) - single key additional variable (confounder/mediator/collider/mechanism)"
  },

  "causalStructure": "string (required) - explicit description of causal relations (e.g., 'Z -> Y; Z -> X')",
  "keyInsight": "string (required) - one-line memorable takeaway",

  // Optional, only when temporal ordering of Z and X matters
  "hiddenTimestamp": {
    "condition1": "string (required) - case where Z occurs BEFORE X",
    "condition2": "string (required) - case where X occurs BEFORE Z"
  },

  // Single explanation field for reasoning
  "wiseRefusal": "string (required) - full answer, including verdict and explicit references to X, Y, Z"
}
```

### Deprecated Fields (DB‑only)

The database may still contain legacy columns:

- `claim`: previous separate claim field (now folded into `scenario`)
- `explanation`: previous short explanation field

They should be treated as **read‑only legacy data**. New generators and editors should **not rely on them**.

---

## Field Definitions

### `sourceCase` (string, required)
- Format: `"X.Y"` where X is the section number and Y is the question number
- Example: `"3.15"`, `"3.43"`
- Purpose: Traceability back to original benchmark document (Case ID in PDF)

### `scenario` (string, required)
- Single field containing **both**:
  - The setup/observed situation, and
  - The causal claim / conclusion to be evaluated
- Uses inline tags `(X)`, `(Y)`, `(Z)` to mark variables in the text
  - `X` – treatment / exposure
  - `Y` – outcome
  - `Z` – single key extra variable (confounder, mediator, collider, mechanism)
- Can reference counterfactuals using `X'`, `Y'` **in plain text** (no special tag)
- Style:
  - 2–4 sentences
  - Domain‑specific and concrete
  - Includes the human conclusion **in the same field**

Example (Markets / L3):

> "Senator X bought Defense Stock (X) one day before a major Spending Bill (Z) passed. The stock rose 20% (Y). The Senator concludes their trade (X) caused the stock to rise." 

### `pearlLevel` (enum, required)

- `"L1"` – Association (observational data, correlations)
- `"L2"` – Intervention (effects of actions/policies)
- `"L3"` – Counterfactual (what‑if / alternate world reasoning)

See **Pearl Level Metadata** below for structured definitions and examples.

### `domain` (string, required)
High‑level topic area. Recommended values (but not enforced by schema):

- `"Markets"` – Financial markets, trading, investing
- `"Medicine"` – Healthcare, drugs, treatments
- `"Economics"` – Policy, macroeconomics
- `"Technology"` – Tech industry, software, AI
- `"Sports"` – Athletics, performance
- `"Education"` – Learning, schools, academic outcomes
- `"Environment"` – Climate, ecology
- `"Psychology"` – Behavior, cognition
- `"Social"` – Society, demographics
- `"Business"` – Corporate, management
- `"Politics"` – Government, elections

### `subdomain` (string, required)
Short phrase summarizing the specific topic **within** the domain.

- Examples:
  - Markets → `"Behavioral Finance"`, `"Market Microstructure"`, `"Calendar Effects"`
  - Medicine → `"Oncology"`, `"Public Health"`
  - Economics → `"Macroeconomics"`, `"Labor"`

### `trapType` (string, required)

Exactly one primary causal trap type for **NO** cases (where a trap is present).

Examples (not exhaustive):

- `"SPURIOUS"` – Coincidental correlation, no causal link
- `"REVERSE"` – Direction of causation is backwards
- `"SELECTION"` – Selection bias / unrepresentative sample
- `"REGRESSION"` – Regression to the mean
- `"COLLIDER"` – Conditioning on a common effect
- `"CONF-MED"` – Confounder–mediator confusion
- `"PROXY"` – Acting on a proxy instead of true cause
- `"SELF-FULFILL"` – Self‑fulfilling prophecy
- `"MECHANISM"` – Misunderstood mechanism
- `"COUNTERFACTUAL"` – Counterfactual reasoning pitfalls

### `trapSubtype` (string, optional)

More specific classification **after** the primary trap type is fixed.

- Leave empty (`""`) if no subtype clearly fits
- Examples: `"Physical Supply Chain"`, `"Structural vs Liquidity"`, `"Sentiment Indicator"`

### `difficulty` (enum, required)

- `"easy"` – Clear‑cut, obvious once explained
- `"medium"` – Requires some causal reasoning
- `"hard"` – Subtle, requires deep understanding

### `groundTruth` (enum, required)

The answer to whether the causal claim is correct:

- `"VALID"` – The causal claim is correct
- `"INVALID"` – The causal claim is incorrect (there is a trap)
- `"CONDITIONAL"` – The claim holds only under additional conditions

### `variables` (object, required)

Single‑Z variable block:

- **`X`** (string) – Exposure, treatment, or predictor
  - Format: `"Variable Name (Role)"`
  - Example: `"Drought (Supply Shock)"`

- **`Y`** (string) – Outcome
  - Format: `"Variable Name (Role)"`
  - Example: `"High Price (Outcome)"`

- **`Z`** (string) – Single **key additional variable**
  - Confounder, mediator, collider, or mechanism
  - Choose the **most important** Z to reason about
  - Example: `"Structural Trade Deficit (Root Cause)"`

### `causalStructure` (string, required)

Explicit description of the causal relations, ideally using DAG‑style arrows.

- Example: `"Weather (Z) affects supply; supply affects price (Y)"`
- Example: `"Z -> Y (Bill causes Rise); Z -> X (Bill knowledge causes Trade)"`

### `keyInsight` (string, required)

One‑line memorable takeaway/principle.

- Examples:
  - `"Basic supply and demand mechanics"`
  - `"Liquidity can delay but not prevent structural problems"`
  - `"Conditioning on a collider can create spurious correlations"`

### `hiddenTimestamp` (object, optional)

Used **only when temporal order matters**, typically for questions where the effect of the trap flips depending on whether Z happens before or after X.

Structure:

- `condition1`: describes the world where **Z occurs before X**
- `condition2`: describes the world where **X occurs before Z**

Both should be short, concrete descriptions of the relevant setup.

Example usage (Market Microstructure / timing):

```jsonc
"hiddenTimestamp": {
  "condition1": "Spending Bill (Z) is leaked days before the Senator trades (X)",
  "condition2": "Senator trades (X) far in advance; Bill (Z) is uncertain and later fails"
}
```

### `wiseRefusal` (string, required)

**Single explanation field** that contains the full answer and justification. It should:

1. Start with an explicit verdict, e.g. `"The counterfactual claim is INVALID."`
2. Clearly justify the chosen `groundTruth`.
3. Explicitly reference **X, Y, and Z**.
4. Explain the relevant causal mechanism / trap.

Example:

> "The counterfactual claim is INVALID. The Spending Bill (Z) caused the stock to rise (Y). The Senator’s trade (X) was a symptom of their foreknowledge, not the cause. If the Senator had abstained (X′), the Bill (Z) still would have passed, and the stock still would have risen (Y)."

---

## Example Questions (Unified Schema)

### Example 1: L3 Counterfactual – VALID (with hiddenTimestamp)

```json
{
  "sourceCase": "3.36",
  "scenario": "A trader executes a massive $4B block sell order (X) in 20 minutes when order book liquidity (Z) is thin. The market crashes 9% (Y). Regulators claim that if the order had been sliced gradually, the crash would not have happened.",
  "pearlLevel": "L3",
  "domain": "Markets",
  "subdomain": "Market Microstructure",
  "trapType": "COUNTERFACTUAL",
  "trapSubtype": "Market Impact / Liquidity Constraint",
  "difficulty": "medium",
  "groundTruth": "VALID",
  "variables": {
    "X": "Block Sell Order (Intervention)",
    "Y": "Market Crash (Outcome)",
    "Z": "Order Book Liquidity Depth (Constraint)"
  },
  "causalStructure": "Execution speed relative to liquidity (Z) drives price dislocation (Y) when executing X.",
  "keyInsight": "Market impact is a function of volume relative to liquidity.",
  "hiddenTimestamp": {
    "condition1": "Liquidity (Z) is already thin before the trader executes the block order (X).",
    "condition2": "Trader schedules the order (X) over a period when fresh liquidity (Z) will arrive from other participants."
  },
  "wiseRefusal": "The counterfactual claim is VALID. Market impact models show that execution speed relative to available liquidity (Z) drives extreme price moves (Y). By slicing the $4B order (X) over time, the trader would have allowed new liquidity (Z) to replenish the book, preventing the 9% crash (Y)."
}
```

### Example 2: L3 Counterfactual – CONDITIONAL

```json
{
  "sourceCase": "3.44",
  "scenario": "Thailand's central bank runs out of reserves (X) defending the baht while a structural trade deficit (Z) persists. The currency crashes (Y), triggering the Asian Financial Crisis. Commentators argue that if the IMF had provided unlimited reserves, the peg would have held.",
  "pearlLevel": "L3",
  "domain": "Markets",
  "subdomain": "Macroeconomics",
  "trapType": "COUNTERFACTUAL",
  "trapSubtype": "Structural vs Liquidity",
  "difficulty": "hard",
  "groundTruth": "CONDITIONAL",
  "variables": {
    "X": "Reserve Depletion (Trigger)",
    "Y": "Currency Crash (Outcome)",
    "Z": "Structural Trade Deficit (Root Cause)"
  },
  "causalStructure": "Persistent trade deficit (Z) creates pressure on the peg; reserve policy (X) can delay but not fully remove this pressure, which drives the crash (Y).",
  "keyInsight": "Liquidity support can delay, but not eliminate, adjustment to structural imbalances.",
  "wiseRefusal": "The counterfactual claim is CONDITIONAL. Unlimited reserves (a change to X) could have delayed the crash (Y), but the structural trade deficit (Z) would still exert pressure on the currency. If global conditions improved or the deficit (Z) narrowed, the peg might have held; otherwise, the crisis would likely have occurred later or in a different form."
}
```

### Example 3: L1 Association – INVALID (Reverse Causation)

```json
{
  "sourceCase": "3.2",
  "scenario": "Historical data suggests that when small 'odd lot' retail investors buy heavily (X), the market soon crashes (Y). A trader sees a surge in retail buying (X) late in a bull market driven by euphoria (Z) and sells immediately, claiming retail buying causes crashes.",
  "pearlLevel": "L1",
  "domain": "Markets",
  "subdomain": "Behavioral Finance",
  "trapType": "REVERSE",
  "trapSubtype": "Sentiment Indicator",
  "difficulty": "medium",
  "groundTruth": "INVALID",
  "variables": {
    "X": "Retail Buying (Indicator)",
    "Y": "Market Crash (Outcome)",
    "Z": "Late-Cycle Euphoria (Latent Cause)"
  },
  "causalStructure": "Euphoria (Z) drives both heavy retail buying (X) and unsustainable valuations that eventually crash (Y).",
  "keyInsight": "Retail buying is a symptom of euphoria, not the cause of the crash.",
  "wiseRefusal": "The causal claim is INVALID. Retail buying (X) does not mechanically cause crashes (Y). Instead, late-cycle euphoria (Z) drives both heavy retail participation (X) and the eventual correction (Y). Treating the indicator (X) as the cause mistakes a symptom of Z for the mechanism."
}
```

---

## Pearl Level Metadata

To improve labeling quality and prompt clarity, we maintain structured metadata for Pearl levels in TypeScript (`PEARL_LEVELS`), but the conceptual definitions are:

### L1 – Association (Observational / Correlational)

- Focus: Patterns and correlations in observed data.
- Typical questions: "Does X correlate with Y after accounting for Z?" (no interventions).
- Common traps: confounding, reverse causation, selection bias, Simpson’s paradox.

Canonical sketches:

- "People who drink more coffee (X) have higher rates of heart disease (Y) in observational surveys."
- "Cities with more police officers (X) report more crime (Y)."

### L2 – Intervention (Causal Effects of Actions)

- Focus: Effects of doing X (policies, treatments, interventions).
- Typical questions: "What happens to Y if we implement policy X?" (do‑operator).
- Common traps: unblocked backdoor paths, bad controls, conditioning on mediators or colliders, feedback loops.

Canonical sketches:

- "A hospital introduces a new triage protocol (X) and mortality (Y) falls, but case mix (Z) also changes."
- "A central bank cuts rates (X) and stock prices (Y) rise, while risk appetite (Z) also shifts."

### L3 – Counterfactual (What‑If / Alternate Worlds)

- Focus: Statements about what **would have happened** under different actions.
- Typical questions: "If X had not happened, would Y still have occurred?" across worlds.
- Common traps: preemption, cross‑world confounding, inconsistent/ill‑posed counterfactuals, dynamic divergence.

Canonical sketches:

- "If the Senator had not traded (X′), the stock (Y) would not have risen despite the Bill (Z)."
- "If we had deployed earlier (X′), the outage (Y) would have been avoided, given existing safeguards (Z)."

These definitions (plus short examples) are surfaced in:

- LLM prompts (both generators) to guide question creation.
- Admin UI (tooltips / info boxes) next to the Pearl Level selector.

---

## Annotation Workflow (Admins)

To standardize labeling and match the schema, admins should follow this 3‑step workflow when annotating or reviewing questions:

1. **Step 1 – Pearl Level**
   - Decide whether the reasoning is about:
     - **L1** – Associations in observed data
     - **L2** – Effects of interventions/policies
     - **L3** – Counterfactual what‑ifs between worlds

2. **Step 2 – Ground Truth**
   - Assign `groundTruth` as exactly one of:
     - `VALID` – The embedded causal claim in the scenario is correct.
     - `INVALID` – The claim is wrong due to a trap.
     - `CONDITIONAL` – The claim holds only under additional assumptions.

3. **Step 3 – Trap Type & Subtype**
   - Choose **exactly one** `trapType` for NO cases (trap present).
   - Set `trapSubtype` only **after** the trap type is chosen.
   - Leave `trapSubtype` empty if no subtype fits cleanly.

Admins should be able to edit **all fields** of each example:

- `scenario` (with inline X/Y/Z tags)
- `variables.X`, `variables.Y`, `variables.Z`
- `pearlLevel`, `groundTruth`
- `trapType`, `trapSubtype`
- `domain`, `subdomain`, `difficulty`
- `causalStructure`, `keyInsight`, `hiddenTimestamp`
- `wiseRefusal` (full explanation)

This workflow is surfaced in the Admin UI and baked into the LLM prompts for both generators.

---

## Validation Rules

1. All required fields must be present – no `null` / `undefined`.
2. `pearlLevel` must be exactly `"L1"`, `"L2"`, or `"L3"`.
3. `difficulty` must be exactly `"easy"`, `"medium"`, or `"hard"` (normalize to lowercase).
4. `groundTruth` must be exactly `"VALID"`, `"INVALID"`, or `"CONDITIONAL"`.
5. `variables.Z` must be a **single string**, even if multiple conceptual factors are described.
6. `sourceCase` should be unique across the dataset.
7. `scenario` should not contain the trap type name (e.g., "collider", "confounding").
8. `scenario` must contain both the setup and the conclusion/claim; there is no separate `claim` field.
9. `wiseRefusal` should start with an explicit verdict, e.g. `"The [counterfactual/causal] claim is [VALID/INVALID/CONDITIONAL]."`
10. `hiddenTimestamp` is optional and should only be used when the ordering of Z and X is conceptually important.
