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
1. Select which Pearl levels to include
2. Choose "Verified only" (recommended)
3. Click "Preview" to see sample
4. Review metadata and sample questions
5. Click "Download JSON" to get full export

#### Export Format:
```json
{
  "metadata": {
    "exportDate": "2026-01-11T...",
    "totalQuestions": 450,
    "distribution": { "L1": 50, "L2": 297, "L3": 103 },
    "version": "1.0"
  },
  "questions": [
    {
      "caseId": "3.46",
      "scenario": "...",
      "claim": "...",
      "variables": { "X": "...", "Y": "...", "Z": "..." },
      "annotations": {
        "pearlLevel": "L2",
        "domain": "Markets",
        "subdomain": "Commodities",
        "trapType": "CONFOUNDING",
        "trapSubtype": "Spurious Correlation",
        "difficulty": "Medium",
        "causalStructure": "Z → X, Z → Y",
        "keyInsight": "..."
      },
      "groundTruth": "INVALID",
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
- ✅ Clear causal claim to evaluate
- ✅ Correct Pearl level classification
- ✅ Appropriate trap type and subtype
- ✅ Educational explanation
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

## API Endpoints (for developers)
- `POST /api/admin/generate` - Generate questions
- `GET /api/admin/stats` - Get progress statistics
- `GET /api/admin/questions/unverified` - List unverified questions
- `PATCH /api/admin/questions/:id` - Update question
- `DELETE /api/admin/questions/:id` - Delete question
- `GET /api/admin/export` - Export questions

## Support
For issues or questions, check the console logs or contact the development team.

