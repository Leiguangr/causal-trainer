#!/usr/bin/env npx tsx
/**
 * AI-Assisted Annotation Review Script
 *
 * Uses GPT-5.2 to do a first-pass review of generated questions,
 * approving well-formed ones and leaving detailed review notes for issues.
 *
 * Usage: npx tsx scripts/review-annotations.ts [options]
 *   --dataset <name>    Filter by dataset name
 *   --limit <n>         Max questions to review (default: 50)
 *   --dry-run           Preview without saving changes
 *   --force             Review questions even if they already have review notes
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Parse command line args
const args = process.argv.slice(2);
const getArg = (name: string, defaultVal: string = ''): string => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};
const dryRun = args.includes('--dry-run');
const forceReview = args.includes('--force');  // Override existing reviews
const dataset = getArg('dataset');
const limit = parseInt(getArg('limit', '50'));

// The comprehensive review prompt with all context
const REVIEW_SYSTEM_PROMPT = `You are an expert reviewer for a causal reasoning training dataset based on Pearl's Ladder of Causation. Your task is to evaluate AI-generated questions for quality, correctness, and pedagogical value.

## Pearl's Ladder of Causation

**L1 - Association (Seeing)**: Observational data only. "What is the probability of Y given X?"
- Can observe correlations but CANNOT intervene
- Traps: confounding, reverse causation, selection bias, collider bias

**L2 - Intervention (Doing)**: Causal effects of actions. "What happens if I do X?"
- Uses do-calculus: P(Y|do(X)) 
- Traps: mediator adjustment, proxy intervention, mechanism errors

**L3 - Counterfactual (Imagining)**: What-if reasoning. "What would Y have been if X were different?"
- Requires structural equations and cross-world comparison
- Traps: cross-world confounding, preemption, overdetermination

## Key Trap Types

1. **CONFOUNDING**: Hidden variable Z causes both X and Y (Z→X, Z→Y)
2. **REVERSE**: Causal direction is backwards (Y→X, not X→Y)  
3. **SELECTION**: Conditioning on a collider or selected sample
4. **COLLIDER**: Conditioning on common effect creates spurious association
5. **MEDIATOR**: Incorrectly adjusting for mediator (overcontrol)
6. **SELF-FULFILLING**: Prediction causes the predicted outcome
7. **MECHANISM**: Confusing mechanism with root cause
8. **PROXY**: Intervening on symptom instead of cause

## Ground Truth Labels

- **YES**: The causal claim IS supported by valid reasoning
- **NO**: The causal claim is INVALID due to a specific trap
- **AMBIGUOUS**: Missing information (timing, mechanism) makes verdict uncertain

## Review Criteria

1. **Scenario Quality**
   - Is it realistic and domain-appropriate?
   - Are variables (X, Y, Z) clearly identifiable in the text?
   - Is it concise (2-4 sentences)?

2. **Pearl Level Accuracy**
   IMPORTANT: Evaluate Pearl level by considering BOTH the scenario AND the claim together.
   The key phrases that determine the level are often in the CLAIM, not the scenario.

   - L1 (Association): Observational data, correlations, predictions.
     Claim phrases: "is associated with", "predicts", "correlates with", "observed that"
   - L2 (Intervention): Actions, policies, experiments with causal claims.
     Claim phrases: "causes", "leads to", "if we do X", "implementing X will", "the effect of doing"
   - L3 (Counterfactual): What-if reasoning about alternative histories.
     Claim phrases: "would have been", "had X not happened", "if X had been different", "would have caused"

3. **Trap Type Correctness**
   - Does the scenario actually exhibit this trap?
   - Is the subtype appropriate?
   - For YES cases: the reasoning should AVOID the trap correctly

4. **Ground Truth Accuracy**
   - YES: Claim genuinely follows from the evidence
   - NO: There's a clear causal fallacy
   - AMBIGUOUS: Missing info genuinely prevents verdict

5. **Explanation Quality**
   - Does it correctly explain why the claim is YES/NO/AMBIGUOUS?
   - Is the causal structure accurately described?

6. **Wise Refusal Quality**
   - Does it model good causal thinking?
   - Would a student learn the right lesson?`;

const REVIEW_USER_PROMPT = (question: any) => `## Question to Review

**Scenario**: ${question.scenario}

**Claim**: ${question.claim}

**Combined Context** (for Pearl level evaluation): "${question.scenario} ${question.claim}"

**Variables**: ${question.variables || 'Not specified'}

**Annotations**:
- Pearl Level: ${question.pearlLevel}
- Domain: ${question.domain} / ${question.subdomain || 'N/A'}
- Trap Type: ${question.trapType}
- Trap Subtype: ${question.trapSubtype}
- Ground Truth: ${question.groundTruth}
- Difficulty: ${question.difficulty}

**Causal Structure**: ${question.causalStructure || 'Not specified'}

**Explanation**: ${question.explanation}

**Key Insight**: ${question.keyInsight || 'Not specified'}

**Wise Refusal**: ${question.wiseRefusal || 'Not specified'}

---

## Your Task

Evaluate this question and provide your assessment in JSON format:

\`\`\`json
{
  "verdict": "APPROVE" | "NEEDS_REVISION" | "REJECT",
  "confidence": 0.0-1.0,
  "reviewNotes": "Detailed explanation of your decision...",
  "issues": [
    {
      "category": "scenario|pearlLevel|trapType|groundTruth|explanation|wiseRefusal",
      "severity": "minor|major|critical",
      "description": "What's wrong",
      "suggestion": "How to fix it"
    }
  ],
  "suggestedChanges": {
    // Only include fields that need changes
    "groundTruth": "YES|NO|AMBIGUOUS",
    "trapType": "...",
    "trapSubtype": "...",
    "pearlLevel": "L1|L2|L3"
  }
}
\`\`\`

**Decision Guidelines**:
- **APPROVE**: Question is well-formed, pedagogically valuable, annotations are correct
- **NEEDS_REVISION**: Fixable issues (minor corrections needed)
- **REJECT**: Fundamentally flawed scenario or major logical errors

Respond with ONLY the JSON object.`;

interface ReviewResult {
  verdict: 'APPROVE' | 'NEEDS_REVISION' | 'REJECT';
  confidence: number;
  reviewNotes: string;
  issues?: Array<{
    category: string;
    severity: 'minor' | 'major' | 'critical';
    description: string;
    suggestion: string;
  }>;
  suggestedChanges?: Record<string, string>;
}

async function reviewQuestion(question: any): Promise<ReviewResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',  // Using the more powerful model
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: REVIEW_USER_PROMPT(question) },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from model');
  }

  return JSON.parse(content) as ReviewResult;
}

async function main() {
  console.log('🔍 AI Annotation Review Script');
  console.log('================================');
  console.log(`Model: gpt-5.2`);
  console.log(`Dataset filter: ${dataset || 'all'}`);
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force re-review: ${forceReview}`);
  console.log('');

  // Fetch unverified questions
  const where: any = { isVerified: false };
  if (dataset) {
    where.dataset = dataset;
  }
  // Skip questions that already have review notes (unless --force)
  if (!forceReview) {
    where.OR = [
      { reviewNotes: null },
      { reviewNotes: '' },
    ];
  }

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const skippedCount = forceReview ? 0 : await prisma.question.count({
    where: {
      isVerified: false,
      reviewNotes: { not: null },
      NOT: { reviewNotes: '' },
      ...(dataset ? { dataset } : {}),
    },
  });

  console.log(`Found ${questions.length} unverified questions to review`);
  if (skippedCount > 0) {
    console.log(`Skipping ${skippedCount} questions with existing reviews (use --force to override)`);
  }
  console.log('');

  let approved = 0;
  let needsRevision = 0;
  let rejected = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`[${i + 1}/${questions.length}] Reviewing: ${q.scenario.substring(0, 60)}...`);

    try {
      const result = await reviewQuestion(q);

      // Build review notes
      const notes = [
        `[AI Review - gpt-5.2]`,
        `Verdict: ${result.verdict} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
        ``,
        result.reviewNotes,
      ];

      if (result.issues && result.issues.length > 0) {
        notes.push('', 'Issues found:');
        for (const issue of result.issues) {
          notes.push(`- [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`);
          if (issue.suggestion) {
            notes.push(`  → Suggestion: ${issue.suggestion}`);
          }
        }
      }

      if (result.suggestedChanges && Object.keys(result.suggestedChanges).length > 0) {
        notes.push('', 'Suggested changes:');
        for (const [field, value] of Object.entries(result.suggestedChanges)) {
          notes.push(`- ${field}: ${value}`);
        }
      }

      const reviewNotes = notes.join('\n');

      // Determine if we should mark as verified
      const shouldVerify = result.verdict === 'APPROVE' && result.confidence >= 0.85;

      console.log(`   → ${result.verdict} (${(result.confidence * 100).toFixed(0)}% confidence)`);
      if (result.issues?.length) {
        console.log(`   → ${result.issues.length} issue(s) found`);
      }

      // Update the database
      if (!dryRun) {
        await prisma.question.update({
          where: { id: q.id },
          data: {
            reviewNotes,
            isVerified: shouldVerify,
          },
        });
      }

      // Track stats
      if (result.verdict === 'APPROVE') approved++;
      else if (result.verdict === 'NEEDS_REVISION') needsRevision++;
      else rejected++;

    } catch (error) {
      console.error(`   ✗ Error reviewing: ${error}`);
    }

    // Rate limiting - avoid hitting API limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n================================');
  console.log('Review Summary:');
  console.log(`  ✓ Approved: ${approved}`);
  console.log(`  ⚠ Needs Revision: ${needsRevision}`);
  console.log(`  ✗ Rejected: ${rejected}`);
  console.log(`  Total: ${questions.length}`);

  if (dryRun) {
    console.log('\n(Dry run - no changes saved)');
  }

  await prisma.$disconnect();
}

main().catch(console.error);

