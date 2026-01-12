# Question Generation System Guide

## Overview
This system allows you to generate 450 diverse causal reasoning questions using AI (GPT-4), review them, and export them in JSON format.

## Target Distribution
- **L1 (Association)**: 50 questions (11%)
- **L2 (Intervention)**: 297 questions (66%)
- **L3 (Counterfactual)**: 103 questions (22%)
- **Total**: 450 questions

## Getting Started

### 1. Access Admin Dashboard
Navigate to `/admin` (you must be logged in as an admin user)

Default admin credentials:
- Email: `admin@causaltrainer.com`
- Password: `admin123`

### 2. Generate Questions (`/admin/generate`)

#### Features:
- **Pearl Level Selection**: Choose L1, L2, L3, or mixed
- **Domain Focus**: Select one domain at a time (Markets, Medicine, Law, Technology, Education)
- **Batch Size**: Generate 1-50 questions at once (recommended: 10-25 for quality control)
- **Custom Instructions**: Provide specific guidance to the AI

#### Workflow:
1. Select your target Pearl level
2. Choose a domain (focus on one domain at a time)
3. Set batch size (start with 10-25)
4. Add custom instructions if needed (e.g., "Focus on recent events", "Include more numerical data")
5. Click "Generate Batch"
6. Wait for generation to complete (may take 1-2 minutes)
7. Review the results

#### Tips:
- Start with smaller batches (10-15) to test quality
- If quality is poor, use custom instructions to guide the AI
- Click "Generate Another Batch" if you're not satisfied with results
- The system automatically avoids duplicating recent scenarios

### 3. Review Questions (`/admin/review`)

#### Features:
- **Queue System**: Shows all unverified questions
- **Filter by Level**: Review L1, L2, or L3 questions separately
- **Side-by-side View**: See original and edit simultaneously
- **Navigation**: Move between questions easily

#### Workflow:
1. Select a Pearl level filter (or "All Levels")
2. Review the scenario and claim
3. Check all annotations:
   - Pearl Level (L1/L2/L3)
   - Domain and Subdomain
   - Trap Type and Subtype
   - Difficulty (easy/medium/hard)
   - Ground Truth (VALID/INVALID/CONDITIONAL)
   - Variables (JSON format)
   - Causal Structure
   - Key Insight
   - Explanation
   - Wise Refusal
4. Edit any incorrect fields
5. Add review notes if needed
6. Choose action:
   - **❌ Reject & Delete**: Remove poor quality questions
   - **💾 Save Draft**: Save edits but keep as unverified
   - **✅ Approve & Next**: Mark as verified and move to next

#### Tips:
- Use keyboard shortcuts: Previous/Next buttons for navigation
- Review 10-20 questions at a time to avoid fatigue
- Be strict on quality - it's better to reject and regenerate
- Check that variables are in valid JSON format
- Ensure explanations are clear and educational

### 4. Export Questions (`/admin/export`)

#### Features:
- **Filter by Level**: Choose which Pearl levels to include
- **Verified Only**: Option to export only approved questions
- **Preview**: See sample before downloading
- **JSON Format**: Standard format matching the specification

#### Workflow:
#### Export Format (Unified Question Schema)

Exports follow the unified question schema (single `scenario`, single-Z `variables`, and `wiseRefusal` as the only explanation field).

```jsonc
{
  "metadata": {
    "exportDate": "2026-01-11T...",
    "totalQuestions": 450,
    "distribution": { "L1": 50, "L2": 297, "L3": 103 },
    "version": "2.0"
  },
  "questions": [
    {
      "caseId": "3.46",                    // Same as sourceCase when present
      "scenario": "Full scenario containing both setup and causal claim, with (X)/(Y)/(Z) tags embedded.",
      "variables": {
        "X": "Exposure/treatment variable (string)",
        "Y": "Outcome variable (string)",
        "Z": "Single key additional variable (string)"
      },
      "annotations": {
        "pearlLevel": "L1 | L2 | L3",
        "domain": "Markets | Medicine | ...",
        "subdomain": "Short phrase like 'Behavioral Finance'",
        "trapType": "Primary trap type (e.g., CONFOUNDING, COLLIDER)",
        "trapSubtype": "Optional subtype (or empty)",
        "difficulty": "easy | medium | hard",
        "causalStructure": "Explicit description of causal relations (e.g., 'Z -> X, Z -> Y')",
        "keyInsight": "One-line takeaway",
        "hiddenTimestamp": {
          "condition1": "Optional – case where Z occurs BEFORE X",
          "condition2": "Optional – case where X occurs BEFORE Z"
        }
      },
      "groundTruth": "VALID | INVALID | CONDITIONAL",
      "wiseRefusal": "Full answer that starts with the verdict and explicitly references X, Y, and Z."
    }
  ]
}
```
      "explanation": "...",
      "wiseRefusal": "The claim is INVALID because..."
    }
  ]
}
```

## Best Practices

### Generation Strategy
1. **Focus on one domain at a time** - This ensures consistency and depth
2. **Generate in small batches** - 10-25 questions for better quality control
3. **Use custom instructions** - Guide the AI with specific requirements
4. **Iterate on prompts** - If quality is poor, regenerate with better instructions

### Review Strategy
1. **Review immediately after generation** - Fresh context helps
2. **Check for duplicates** - Even if scenarios differ, concepts should be unique
3. **Verify JSON format** - Variables must be valid JSON
4. **Ensure educational value** - Explanations should teach, not just answer

### Quality Criteria
- ✅ Realistic, specific scenarios with numbers/context
- ✅ Clear causal claim embedded **inside the scenario** (no separate `claim` field)
- ✅ Correct Pearl level classification
- ✅ Appropriate trap type and subtype
- ✅ Educational explanation fully captured in `wiseRefusal`
- ✅ Valid JSON for variables
- ✅ Clear causal structure description

## Troubleshooting

### Generation Issues
- **Low quality output**: Add more specific custom instructions
- **Duplicates**: System checks recent questions, but manual review needed
- **Wrong Pearl level**: Regenerate with explicit level requirement

### Review Issues
- **Can't save**: Check that all required fields are filled
- **JSON errors**: Ensure variables field has valid JSON syntax
- **Lost progress**: Use "Save Draft" frequently

## Progress Tracking
- Dashboard shows overall progress toward 450 questions
- Track completion by Pearl level
- Monitor verified vs unverified questions

## Annotation Workflow & Pearl Levels (for Admins & Prompts)

To keep annotations consistent, both the Admin UI and LLM prompts follow a shared workflow and Pearl level definitions.

### 3-Step Annotation Workflow

1. **Step 1 – Pearl Level**  
   Decide whether the reasoning is about:
   - **L1** – Associations in observed data (correlations)
   - **L2** – Effects of interventions/policies (do-operator)
   - **L3** – Counterfactual what-ifs between worlds

2. **Step 2 – Ground Truth**  
   Set `groundTruth` to exactly one of:
   - `VALID` – The embedded causal claim in the scenario is correct
   - `INVALID` – The claim is wrong due to a trap
   - `CONDITIONAL` – The claim holds only under additional assumptions

3. **Step 3 – Trap Type & Subtype**  
   - Choose **exactly one** `trapType` for NO cases (trap present).
   - Set `trapSubtype` only **after** the trap type is fixed.
   - Leave `trapSubtype` empty if no subtype fits cleanly.

Admins can edit all unified fields for each example: `scenario`, `variables.X/Y/Z`, `pearlLevel`, `groundTruth`, `trapType/subtype`, `domain/subdomain`, `difficulty`, `causalStructure`, `keyInsight`, optional `hiddenTimestamp`, and `wiseRefusal`.

### Pearl Level Reference (Used in Prompts & UI)

Pearl level metadata is implemented in TypeScript as `PEARL_LEVELS` and injected into generation prompts and admin tooltips.

- **L1 – Association**  
  *Description*: Patterns and correlations in observational data; no explicit interventions.  
  *Examples*:  
  - "People who drink more coffee (X) have higher rates of heart disease (Y) in observational surveys."  
  - "Cities with more police officers (X) report more crime (Y)."

- **L2 – Intervention**  
  *Description*: Causal effects of doing X (policies, treatments, actions).  
  *Examples*:  
  - "A hospital introduces a new triage protocol (X) and mortality (Y) falls, while case mix (Z) also changes."  
  - "A central bank cuts rates (X) and stock prices (Y) rise, while risk appetite (Z) also shifts."

- **L3 – Counterfactual**  
  *Description*: What **would have happened** under alternative actions X′, often across possible worlds.  
  *Examples*:  
  - "If the Senator had not traded (X′), the stock (Y) would not have risen despite the Spending Bill (Z)."  
  - "If we had deployed earlier (X′), the outage (Y) would have been avoided, given existing safeguards (Z)."

These descriptions and examples appear in:

- Admin generation prompts (`/api/admin/generate`)
- Cheatsheet-based generator prompts (`/api/generate`)
- Pearl level tooltips in Admin UI and the developer generator

## API Endpoints (for developers)
- `POST /api/admin/generate` - Generate questions
- `GET /api/admin/stats` - Get progress statistics
- `GET /api/admin/questions/unverified` - List unverified questions
- `PATCH /api/admin/questions/:id` - Update question
- `DELETE /api/admin/questions/:id` - Delete question
- `GET /api/admin/export` - Export questions

## Support
For issues or questions, check the console logs or contact the development team.
