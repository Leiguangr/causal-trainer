# Question Schema for Causal Trainer

This document defines the standard schema for quiz questions derived from BucketLarge-G and similar sources. All new questions must adhere to this schema.

## JSON Schema

```json
{
  "sourceCase": "string (required)",
  "scenario": "string (required)",
  "claim": "string (required)",
  "pearlLevel": "L1 | L2 | L3 (required)",
  "domain": "string (required)",
  "subdomain": "string (optional)",
  "trapType": "string (required)",
  "trapSubtype": "string (required)",
  "difficulty": "easy | medium | hard (required)",
  "groundTruth": "VALID | INVALID | CONDITIONAL (required)",
  "variables": {
    "X": "string (required) - The exposure/treatment/predictor variable",
    "Y": "string (required) - The outcome variable",
    "Z": "string[] (required) - Confounders, mediators, colliders, or mechanisms"
  },
  "causalStructure": "string (required) - Brief description of the causal graph",
  "keyInsight": "string (required) - One-line memorable takeaway",
  "explanation": "string (required) - Why this is the identified trap",
  "wiseRefusal": "string (required) - Complete answer with reasoning"
}
```

## Field Definitions

### `sourceCase` (string, required)
- Format: `"X.Y"` where X is the section number and Y is the question number
- Example: `"3.15"`, `"3.43"`
- Purpose: Traceability back to original benchmark document (Case ID in PDF)

### `scenario` (string, required)
- A real-world situation describing the observed correlation or pattern
- Should be 1-3 sentences
- Must NOT reveal the trap type or answer
- Should be domain-specific and concrete
- Example: *"A severe drought hit the Wheat Belt (X). Wheat prices soared to $12/bushel (Y)."*

### `claim` (string, required)
- The causal claim being evaluated (may be valid, invalid, or conditional)
- Should be a clear, testable counterfactual or causal statement
- Format: "If [X'] then [Y']" or "[X] causes [Y]"
- Example: *"If it had rained normally (X'), wheat prices would be lower (Y')."*

### `pearlLevel` (enum, required)
- `"L1"` - Association (observational data, correlations)
- `"L2"` - Intervention (do-calculus, experimental reasoning)
- `"L3"` - Counterfactual (what-if reasoning, alternate worlds)

### `domain` (string, required)
Valid domains (D1-D11):
- `"Markets"` (D3) - Financial markets, trading, investing
- `"Medicine"` (D2) - Healthcare, drugs, treatments
- `"Economics"` (D4) - Policy, macroeconomics
- `"Technology"` (D5) - Tech industry, software, AI
- `"Sports"` (D6) - Athletics, performance
- `"Education"` (D7) - Learning, schools, academic outcomes
- `"Environment"` (D8) - Climate, ecology
- `"Psychology"` (D9) - Behavior, cognition
- `"Social"` (D10) - Society, demographics
- `"Business"` (D11) - Corporate, management
- `"Politics"` (D1) - Government, elections

### `subdomain` (string, optional)
More specific category within the domain.
- Examples: `"Commodities"`, `"Macroeconomics"`, `"Crypto"`, `"Oncology"`

### `trapType` (string, required)
The primary causal trap category. Valid values:

**BucketG Types:**
- `"SPURIOUS"` - Coincidental correlation, no causal link
- `"REVERSE"` - Direction of causation is backwards
- `"SELECTION"` - Sample is not representative
- `"REGRESSION"` - Regression to the mean
- `"COLLIDER"` - Conditioning on a common effect
- `"CONF-MED"` - Confounder-mediator confusion
- `"PROXY"` - Using proxy instead of true cause
- `"SELF-FULFILL"` - Self-fulfilling prophecy
- `"MECHANISM"` - Misunderstanding causal mechanism
- `"COUNTERFACTUAL"` - Counterfactual reasoning (valid, invalid, or conditional)

### `trapSubtype` (string, required)
A more specific classification within the trap type.
- Should be descriptive and indicate the specific fallacy or mechanism
- Examples: `"Physical Supply Chain"`, `"Structural vs Liquidity"`, `"Supply vs Demand"`

### `difficulty` (enum, required)
- `"easy"` - Clear-cut cases, obvious once explained
- `"medium"` - Requires some causal reasoning
- `"hard"` - Subtle, requires deep understanding

### `groundTruth` (enum, required)
The answer to whether the causal claim is correct:
- `"VALID"` - The causal claim is correct
- `"INVALID"` - The causal claim is incorrect (there's a trap)
- `"CONDITIONAL"` - The claim is partially true or depends on conditions

### `variables` (object, required)
Causal diagram components:

- **`X`** (string): The exposure, treatment, or predictor
  - Format: `"Variable Name (Role)"`
  - Example: `"Drought (Supply Shock)"`

- **`Y`** (string): The outcome
  - Format: `"Variable Name (Role)"`
  - Example: `"High Price (Outcome)"`

- **`Z`** (string[]): Array of other relevant variables
  - Confounders, mediators, colliders, mechanisms
  - Format: `["Variable (Role)", "Another Variable (Role)"]`
  - Example: `["Supply/Demand Elasticity (Mechanism)"]`

### `causalStructure` (string, required)
Brief description of the causal graph or relationships.
- Example: *"Weather affects supply; supply affects price"*
- Example: *"Reserves delay but don't prevent structural adjustment"*

### `keyInsight` (string, required)
One-line memorable takeaway or principle.
- Example: *"Basic supply and demand mechanics"*
- Example: *"Liquidity can delay but not prevent structural problems"*

### `explanation` (string, required)
- 1-2 sentences explaining the ground truth answer
- From the "Ground Truth" section in the PDF
- Example: *"Agricultural pricing is supply-driven. Rain increases yield, increasing supply. Increased supply mechanically lowers price assuming constant demand."*

### `wiseRefusal` (string, required)
Complete answer that includes:
1. The verdict (VALID/INVALID/CONDITIONAL)
2. The reasoning referencing X, Y, Z variables
3. The causal mechanism

Example: *"The counterfactual claim is VALID. Agricultural pricing is supply-driven. Rain (X') increases yield, increasing supply (Z). Increased supply mechanically lowers price (Y') assuming constant demand."*

## Example Questions

### Example 1: L3 Counterfactual - VALID

```json
{
  "sourceCase": "3.43",
  "scenario": "A severe drought hit the Wheat Belt (X). Wheat prices soared to $12/bushel (Y).",
  "claim": "If it had rained normally (X'), wheat prices would be lower (Y').",
  "pearlLevel": "L3",
  "domain": "Markets",
  "subdomain": "Commodities",
  "trapType": "COUNTERFACTUAL",
  "trapSubtype": "Physical Supply Chain",
  "difficulty": "medium",
  "groundTruth": "VALID",
  "variables": {
    "X": "Drought (Supply Shock)",
    "Y": "High Price (Outcome)",
    "Z": ["Supply/Demand Elasticity (Mechanism)"]
  },
  "causalStructure": "Weather affects supply; supply affects price",
  "keyInsight": "Basic supply and demand mechanics",
  "explanation": "Agricultural pricing is supply-driven. Rain increases yield, increasing supply. Increased supply mechanically lowers price assuming constant demand.",
  "wiseRefusal": "The counterfactual claim is VALID. Agricultural pricing is supply-driven. Rain (X') increases yield, increasing supply (Z). Increased supply mechanically lowers price (Y') assuming constant demand."
}
```

### Example 2: L3 Counterfactual - CONDITIONAL

```json
{
  "sourceCase": "3.44",
  "scenario": "Thailand's central bank ran out of reserves (X) defending the baht. The currency crashed (Y), triggering the Asian Financial Crisis.",
  "claim": "If the IMF had provided unlimited reserves (X'), the peg would have held (Y').",
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
    "Z": ["Structural Trade Deficit (Root Cause)"]
  },
  "causalStructure": "Reserves delay but don't prevent structural adjustment",
  "keyInsight": "Liquidity can delay but not prevent structural problems",
  "explanation": "Central bank interventions can maintain pegs temporarily, but the underlying pressure from trade deficits and capital outflows would likely have forced a break eventually. The timing might differ, but the outcome was structurally inevitable.",
  "wiseRefusal": "The counterfactual claim is CONDITIONAL. Central bank interventions can maintain pegs temporarily, but the underlying pressure from trade deficits and capital outflows (Z) would likely have forced a break eventually. The timing might differ, but the outcome was structurally inevitable."
}
```

### Example 3: L1 Association - INVALID (Reverse Causation)

```json
{
  "sourceCase": "3.2",
  "scenario": "Historical data suggests that when small 'odd lot' retail investors buy heavily, the market tops out and crashes. A trader sees retail buying and sells immediately.",
  "claim": "Retail buying causes the market to crash.",
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
    "Z": ["Late-Cycle Euphoria (Latent Cause)"]
  },
  "causalStructure": "Euphoria causes both retail buying and eventual crash",
  "keyInsight": "Retail buying is a sign of euphoria, not the cause of the crash",
  "explanation": "Retail buying does not mechanically cause a crash. Heavy retail participation is an indicator of late-stage market euphoria. The market crashes because valuations are unsustainable.",
  "wiseRefusal": "The causal claim is INVALID. Retail buying (X) does not mechanically cause a crash. Instead, heavy retail participation is an indicator of late-stage market euphoria (Z). The market crashes because valuations are unsustainable, not because small investors are buying."
}
```

## Validation Rules

1. All required fields must be present - no null or undefined values
2. `pearlLevel` must be exactly `"L1"`, `"L2"`, or `"L3"`
3. `difficulty` must be exactly `"easy"`, `"medium"`, or `"hard"` (note: PDF uses "Medium" but normalize to lowercase)
4. `groundTruth` must be exactly `"VALID"`, `"INVALID"`, or `"CONDITIONAL"`
5. `variables.Z` must be an array (even if single element)
6. `sourceCase` should be unique across the dataset
7. `scenario` should not contain the answer or trap type name
8. `claim` should be a testable causal or counterfactual statement
9. `wiseRefusal` must start with "The [counterfactual/causal] claim is [VALID/INVALID/CONDITIONAL]."
10. `subdomain` is optional but recommended for specificity

