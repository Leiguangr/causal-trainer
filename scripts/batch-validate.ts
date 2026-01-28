#!/usr/bin/env npx ts-node

/**
 * T³ Batch Validation using OpenAI Batch API
 * 
 * This script uses OpenAI's Batch API to validate hundreds of cases efficiently.
 * The Batch API is 50% cheaper and has no rate limits.
 * 
 * Usage:
 *   # Step 1: Prepare batch and submit to OpenAI
 *   npx ts-node scripts/batch-validate.ts prepare
 * 
 *   # Step 2: Check batch status
 *   npx ts-node scripts/batch-validate.ts status <batch_id>
 * 
 *   # Step 3: Process results when batch is complete
 *   npx ts-node scripts/batch-validate.ts process <batch_id>
 * 
 *   # Or do it all at once (will poll until complete):
 *   npx ts-node scripts/batch-validate.ts run
 */

import * as fs from 'fs';
import * as path from 'path';
import { Blob } from 'node:buffer';
import { PrismaClient } from '@prisma/client';
import OpenAI, { toFile } from 'openai';

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

// Polyfill File for older Node versions
if (typeof globalThis.File === 'undefined') {
  // @ts-ignore
  globalThis.File = class File extends Blob {
    name: string;
    lastModified: number;
    constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options?.lastModified || Date.now();
    }
  };
}

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_FILE_PATH = path.join(__dirname, '../data/batch-validation-input.jsonl');
const RESULTS_FILE_PATH = path.join(__dirname, '../data/batch-validation-results.json');

// ============== Types ==============

interface QuestionData {
  id: string;
  scenario: string;
  claim: string | null;
  pearlLevel: string;
  groundTruth: string;
  variables: string | null;
  trapType: string;
  explanation: string | null;
  wiseRefusal: string | null;
  hiddenTimestamp: string | null;
  conditionalAnswers: string | null;
  difficulty: string | null;
}

interface RubricScores {
  scenarioClarityScore: number;
  hiddenQuestionScore: number;
  conditionalAnswerAScore: number;
  conditionalAnswerBScore: number;
  wiseRefusalScore: number;
  difficultyCalibrationScore: number;
  finalLabelScore: number;
  trapTypeScore: number;
  finalScore: number;
  validatorNotes: string;
}

// ============== Prompt Builder ==============

function buildRubricPrompt(question: QuestionData): string {
  const isAmbiguous = question.groundTruth === 'AMBIGUOUS' || question.groundTruth === 'CONDITIONAL';
  
  const validLabels: Record<string, string[]> = {
    'L1': ['YES', 'NO', 'AMBIGUOUS'],
    'L2': ['NO'],
    'L3': ['VALID', 'INVALID', 'CONDITIONAL'],
  };

  return `You are evaluating a causal reasoning case for the T³ (Trap, Trick, and Trace) benchmark dataset.

ABOUT THIS DATASET:
T³ is a benchmark designed to test LLM causal reasoning abilities across Pearl's Ladder of Causation:
- L1 (Association): Can the model correctly identify correlational vs causal claims from observational data?
- L2 (Intervention): Can the model recognize when interventional conclusions cannot be drawn without experiments?
- L3 (Counterfactual): Can the model evaluate counterfactual claims requiring structural causal knowledge?

Each case contains a "trap" — a plausible-sounding scenario where naive causal reasoning leads to wrong conclusions.
A good case should be realistic enough that a model without careful causal reasoning would answer incorrectly.

Use the REVISED Assignment 2 rubric (Table 7) for scoring.

CASE TO EVALUATE:
- Pearl Level: ${question.pearlLevel}
- Ground Truth Label: ${question.groundTruth}
- Trap Type: ${question.trapType}

SCENARIO:
${question.scenario}

CLAIM:
${question.claim || 'N/A'}

VARIABLES:
${question.variables || 'N/A'}

EXPLANATION:
${question.explanation || 'N/A'}

WISE REFUSAL (Model's expected answer):
${question.wiseRefusal || 'N/A'}

${isAmbiguous ? `HIDDEN TIMESTAMP QUESTION:
${question.hiddenTimestamp || 'N/A'}

CONDITIONAL ANSWERS:
${question.conditionalAnswers || 'N/A'}` : ''}

DIFFICULTY CLAIMED: ${question.difficulty || 'medium'}

---

SCORING RUBRIC (Table 7 - Revised Assignment 2) - 10 points total:

1. SCENARIO CLARITY (0-1 point):
   - Are X, Y, Z variables clearly defined and distinguishable?
   - Is the scenario concise (2-5 sentences, 40-80 words)?
   - Is the causal setup clear without being overly verbose?
   Score 1: Excellent clarity, Score 0.5: Minor issues, Score 0: Confusing/unclear

2. HIDDEN QUESTION QUALITY (0-1 point):
   ${isAmbiguous ? `- Does the hidden question reveal the key missing information?
   - Would answering it disambiguate the case?
   Score 1: Excellent disambiguating question, Score 0.5: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case (not AMBIGUOUS/CONDITIONAL), so this gets full score (1.0)`}

3. CONDITIONAL ANSWER A (0-1.5 points):
   ${isAmbiguous ? `- Is the first conditional answer logically sound?
   - Does it properly address one resolution of the ambiguity?
   Score 1.5: Complete and correct, Score 0.75: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case, so this gets full score (1.5)`}

4. CONDITIONAL ANSWER B (0-1.5 points):
   ${isAmbiguous ? `- Is the second conditional answer logically sound?
   - Does it properly address the alternative resolution?
   Score 1.5: Complete and correct, Score 0.75: Partial, Score 0: Poor/missing` :
   `- This is a ${question.groundTruth} case, so this gets full score (1.5)`}

5. WISE REFUSAL QUALITY (0-2 points):
   - Does it correctly state the verdict?
   - Does it explain WHY with clear causal reasoning?
   - Does it identify the specific trap (for NO/INVALID cases) or missing info (for AMBIGUOUS/CONDITIONAL)?
   Score 2: Complete and insightful, Score 1: Correct but incomplete, Score 0: Wrong or missing

6. DIFFICULTY CALIBRATION (0-1 point):
   - Does the claimed difficulty match the actual complexity?
   - Easy: Obvious trap, common scenario
   - Medium: Requires careful reading, subtle trap
   - Hard: Multiple interacting factors, expert knowledge needed
   Score 1: Well calibrated, Score 0.5: Slightly off, Score 0: Miscalibrated

7. FINAL LABEL (0-1 point):
   - Is the label correct for this Pearl level?
   - L1: Valid labels are YES, NO, AMBIGUOUS
   - L2: MUST be NO (all L2 cases are traps)
   - L3: Valid labels are VALID, INVALID, CONDITIONAL
   Current: Pearl Level = ${question.pearlLevel}, Label = ${question.groundTruth}
   Valid labels for ${question.pearlLevel}: ${validLabels[question.pearlLevel]?.join(', ') || 'unknown'}
   Score 1: Correct label, Score 0: Incorrect label

8. TRAP TYPE / FAMILY (0-1 point):
   - Is the trap type (L1/L2) or family (L3) correctly classified for the scenario?

   For L1 (Association):
   - Common trap types: CONFOUNDING, REVERSE, SELECTION, NONE (for valid/ambiguous)
   - NONE is valid for YES (valid association) or AMBIGUOUS cases

   For L2 (Intervention):
   - Common trap types: CONFOUNDING, REVERSE, SELECTION, COLLIDER, SIMPSONS, GOODHART, FEEDBACK, MEDIATOR, CONFOUNDER_MEDIATOR, etc.
   - All L2 cases are traps, so trap type should NOT be NONE

   For L3 (Counterfactual) - uses FAMILY instead of trap type:
   - F1: Deterministic Counterfactuals
   - F2: Probabilistic Counterfactuals
   - F3: Overdetermination / Preemption
   - F4: Structural vs Contingent Causes
   - F5: Temporal Counterfactuals
   - F6: Epistemic Limits (CONDITIONAL only)
   - F7: Attribution
   - F8: Moral and Legal Causation
   - NONE is also valid for L3 if no specific family applies

   Current trap type/family: ${question.trapType}
   Score 1: Correctly matches the scenario's causal pattern, Score 0.5: Partially correct, Score 0: Incorrect

---

Return your evaluation as JSON:
{
  "scenarioClarityScore": <0-1>,
  "wiseRefusalScore": <0-2>,
  "difficultyCalibrationScore": <0-1>,
  "finalLabelScore": <0-1>,
  "trapTypeScore": <0-1>,
  ${isAmbiguous ? `"hiddenQuestionScore": <0-1>,
  "conditionalAnswerAScore": <0-1.5>,
  "conditionalAnswerBScore": <0-1.5>,` : ''}
  "notes": "<Brief explanation of scores, max 100 words>"
}

Return ONLY valid JSON.`;
}

// ============== Step 1: Prepare Batch ==============

async function prepareBatch(): Promise<string> {
  console.log('📦 Preparing batch validation...\n');

  // Fetch all pending cases
  const questions = await prisma.question.findMany({
    where: { 
      dataset: 'cs372-assignment2',
      validationStatus: 'pending',
    },
    select: {
      id: true, scenario: true, claim: true, pearlLevel: true,
      groundTruth: true, variables: true, trapType: true,
      explanation: true, wiseRefusal: true, hiddenTimestamp: true,
      conditionalAnswers: true, difficulty: true,
    },
  });

  console.log(`Found ${questions.length} cases to validate\n`);

  if (questions.length === 0) {
    console.log('No pending cases found. Nothing to do.');
    process.exit(0);
  }

  // Build JSONL file for batch API
  const batchRequests: string[] = [];

  for (const q of questions) {
    const prompt = buildRubricPrompt(q);
    
    const request = {
      custom_id: q.id,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_completion_tokens: 500,
      }
    };

    batchRequests.push(JSON.stringify(request));
  }

  // Ensure data directory exists
  const dataDir = path.dirname(BATCH_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write JSONL file
  fs.writeFileSync(BATCH_FILE_PATH, batchRequests.join('\n'));
  console.log(`✅ Created batch file: ${BATCH_FILE_PATH}`);
  console.log(`   Total requests: ${batchRequests.length}\n`);

  // Upload file to OpenAI
  console.log('📤 Uploading batch file to OpenAI...');
  const fileContent = fs.readFileSync(BATCH_FILE_PATH);
  const file = await openai.files.create({
    file: await toFile(fileContent, 'batch-validation-input.jsonl'),
    purpose: 'batch',
  });
  console.log(`✅ File uploaded: ${file.id}\n`);

  // Create batch
  console.log('🚀 Creating batch job...');
  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
    metadata: {
      description: 'T3 benchmark validation',
      dataset: 'cs372-assignment2',
      case_count: String(questions.length),
    }
  });

  console.log(`✅ Batch created!`);
  console.log(`   Batch ID: ${batch.id}`);
  console.log(`   Status: ${batch.status}`);
  console.log(`   Created: ${new Date(batch.created_at * 1000).toISOString()}\n`);

  console.log('📋 Next steps:');
  console.log(`   1. Check status: npx ts-node scripts/batch-validate.ts status ${batch.id}`);
  console.log(`   2. Process results: npx ts-node scripts/batch-validate.ts process ${batch.id}\n`);

  // Save batch ID for later
  const stateFile = path.join(__dirname, '../data/batch-state.json');
  fs.writeFileSync(stateFile, JSON.stringify({
    batch_id: batch.id,
    file_id: file.id,
    created_at: new Date().toISOString(),
    case_count: questions.length,
  }, null, 2));

  return batch.id;
}

// ============== Step 2: Check Status ==============

async function checkStatus(batchId: string): Promise<OpenAI.Batches.Batch> {
  console.log(`🔍 Checking batch status: ${batchId}\n`);

  const batch = await openai.batches.retrieve(batchId);

  console.log('📊 Batch Status:');
  console.log(`   ID: ${batch.id}`);
  console.log(`   Status: ${batch.status}`);
  console.log(`   Created: ${new Date(batch.created_at * 1000).toISOString()}`);
  
  if (batch.request_counts) {
    console.log(`   Total requests: ${batch.request_counts.total}`);
    console.log(`   Completed: ${batch.request_counts.completed}`);
    console.log(`   Failed: ${batch.request_counts.failed}`);
  }

  if (batch.completed_at) {
    console.log(`   Completed at: ${new Date(batch.completed_at * 1000).toISOString()}`);
  }

  if (batch.output_file_id) {
    console.log(`   Output file: ${batch.output_file_id}`);
  }

  if (batch.error_file_id) {
    console.log(`   Error file: ${batch.error_file_id}`);
  }

  console.log();

  return batch;
}

// ============== Step 3: Process Results ==============

async function processResults(batchId: string): Promise<void> {
  console.log(`📥 Processing results for batch: ${batchId}\n`);

  const batch = await openai.batches.retrieve(batchId);

  if (batch.status !== 'completed') {
    console.log(`❌ Batch is not complete yet. Status: ${batch.status}`);
    console.log('   Please wait for the batch to complete and try again.\n');
    return;
  }

  if (!batch.output_file_id) {
    console.log('❌ No output file found for this batch.');
    return;
  }

  // Download output file
  console.log('📥 Downloading results...');
  const fileResponse = await openai.files.content(batch.output_file_id);
  const fileContent = await fileResponse.text();
  
  // Parse JSONL results
  const lines = fileContent.trim().split('\n');
  console.log(`   Got ${lines.length} results\n`);

  const results: Array<{
    id: string;
    scores: RubricScores;
    error?: string;
  }> = [];

  let successCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    try {
      const result = JSON.parse(line);
      const customId = result.custom_id;
      
      if (result.error) {
        console.log(`   ❌ Error for ${customId}: ${result.error.message}`);
        errorCount++;
        results.push({ id: customId, scores: {} as RubricScores, error: result.error.message });
        continue;
      }

      const content = result.response?.body?.choices?.[0]?.message?.content;
      if (!content) {
        console.log(`   ❌ No content for ${customId}`);
        errorCount++;
        continue;
      }

      const evaluation = JSON.parse(content);
      
      // Fetch question to determine if ambiguous
      const question = await prisma.question.findUnique({
        where: { id: customId },
        select: { groundTruth: true }
      });
      
      const isAmbiguous = question?.groundTruth === 'AMBIGUOUS' || question?.groundTruth === 'CONDITIONAL';
      const defaultHiddenScore = isAmbiguous ? 0 : 1;
      const defaultCondAScore = isAmbiguous ? 0 : 1.5;
      const defaultCondBScore = isAmbiguous ? 0 : 1.5;

      // Calculate scores
      const scenarioClarity = Math.min(1, Math.max(0, evaluation.scenarioClarityScore || 0));
      const wiseRefusal = Math.min(2, Math.max(0, evaluation.wiseRefusalScore || 0));
      const difficultyCalibration = Math.min(1, Math.max(0, evaluation.difficultyCalibrationScore || 0));
      const finalLabel = Math.min(1, Math.max(0, evaluation.finalLabelScore || 0));
      const trapType = Math.min(1, Math.max(0, evaluation.trapTypeScore || 0));

      const hiddenQuestion = isAmbiguous
        ? Math.min(1, Math.max(0, evaluation.hiddenQuestionScore || 0))
        : defaultHiddenScore;
      const condA = isAmbiguous
        ? Math.min(1.5, Math.max(0, evaluation.conditionalAnswerAScore || 0))
        : defaultCondAScore;
      const condB = isAmbiguous
        ? Math.min(1.5, Math.max(0, evaluation.conditionalAnswerBScore || 0))
        : defaultCondBScore;

      const total = scenarioClarity + hiddenQuestion + condA + condB + wiseRefusal +
                    difficultyCalibration + finalLabel + trapType;

      const scores: RubricScores = {
        scenarioClarityScore: scenarioClarity,
        hiddenQuestionScore: hiddenQuestion,
        conditionalAnswerAScore: condA,
        conditionalAnswerBScore: condB,
        wiseRefusalScore: wiseRefusal,
        difficultyCalibrationScore: difficultyCalibration,
        finalLabelScore: finalLabel,
        trapTypeScore: trapType,
        finalScore: Math.round(total * 10) / 10,
        validatorNotes: `[Batch-scored] ${evaluation.notes || ''}`,
      };

      results.push({ id: customId, scores });
      successCount++;

    } catch (err) {
      console.log(`   ❌ Parse error: ${err}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Processing Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}\n`);

  // Save results to file
  fs.writeFileSync(RESULTS_FILE_PATH, JSON.stringify(results, null, 2));
  console.log(`✅ Results saved to: ${RESULTS_FILE_PATH}\n`);

  // Update database
  console.log('💾 Updating database...');
  let updateCount = 0;
  
  for (const r of results) {
    if (r.error) continue;
    
    try {
      await prisma.question.update({
        where: { id: r.id },
        data: {
          validator: 'batch-validator',
          validationStatus: 'scored',
          ...r.scores,
        },
      });
      updateCount++;
    } catch (err) {
      console.log(`   ❌ Failed to update ${r.id}: ${err}`);
    }
  }

  console.log(`✅ Updated ${updateCount} cases in database\n`);

  // Print score distribution
  const validScores = results.filter(r => !r.error && r.scores.finalScore !== undefined);
  if (validScores.length > 0) {
    const accepted = validScores.filter(r => r.scores.finalScore >= 8).length;
    const needsRevision = validScores.filter(r => r.scores.finalScore >= 6 && r.scores.finalScore < 8).length;
    const rejected = validScores.filter(r => r.scores.finalScore < 6).length;
    const avgScore = validScores.reduce((sum, r) => sum + r.scores.finalScore, 0) / validScores.length;

    console.log('📈 Score Distribution:');
    console.log(`   Accepted (≥8): ${accepted} (${(accepted / validScores.length * 100).toFixed(1)}%)`);
    console.log(`   Needs revision (6-7): ${needsRevision} (${(needsRevision / validScores.length * 100).toFixed(1)}%)`);
    console.log(`   Rejected (<6): ${rejected} (${(rejected / validScores.length * 100).toFixed(1)}%)`);
    console.log(`   Average score: ${avgScore.toFixed(2)}\n`);
  }
}

// ============== Run All (with polling) ==============

async function runAll(): Promise<void> {
  console.log('🚀 Running full batch validation pipeline...\n');

  // Step 1: Prepare and submit batch
  const batchId = await prepareBatch();

  // Step 2: Poll for completion
  console.log('⏳ Waiting for batch to complete...\n');
  
  let batch = await openai.batches.retrieve(batchId);
  let pollCount = 0;
  const maxPolls = 720; // 6 hours with 30s intervals
  
  while (batch.status !== 'completed' && batch.status !== 'failed' && batch.status !== 'expired') {
    pollCount++;
    
    if (pollCount > maxPolls) {
      console.log('❌ Timeout waiting for batch to complete.');
      console.log(`   Batch ID: ${batchId}`);
      console.log('   You can check status later with: npx ts-node scripts/batch-validate.ts status ' + batchId);
      return;
    }

    // Progress indicator
    const completed = batch.request_counts?.completed || 0;
    const total = batch.request_counts?.total || 0;
    const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    
    process.stdout.write(`\r   Status: ${batch.status} | Progress: ${completed}/${total} (${pct}%) | Polls: ${pollCount}    `);

    // Wait 30 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    batch = await openai.batches.retrieve(batchId);
  }

  console.log('\n');

  if (batch.status === 'failed') {
    console.log('❌ Batch failed!');
    if (batch.error_file_id) {
      const errorFile = await openai.files.content(batch.error_file_id);
      console.log('Errors:', await errorFile.text());
    }
    return;
  }

  if (batch.status === 'expired') {
    console.log('❌ Batch expired before completion.');
    return;
  }

  // Step 3: Process results
  await processResults(batchId);

  console.log('✅ Batch validation complete!\n');
}

// ============== Main ==============

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('T³ Batch Validation (OpenAI Batch API)');
  console.log('======================================\n');

  try {
    switch (command) {
      case 'prepare':
        await prepareBatch();
        break;
      
      case 'status':
        if (!arg) {
          // Try to load from state file
          const stateFile = path.join(__dirname, '../data/batch-state.json');
          if (fs.existsSync(stateFile)) {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            await checkStatus(state.batch_id);
          } else {
            console.log('Usage: npx ts-node scripts/batch-validate.ts status <batch_id>');
          }
        } else {
          await checkStatus(arg);
        }
        break;
      
      case 'process':
        if (!arg) {
          const stateFile = path.join(__dirname, '../data/batch-state.json');
          if (fs.existsSync(stateFile)) {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            await processResults(state.batch_id);
          } else {
            console.log('Usage: npx ts-node scripts/batch-validate.ts process <batch_id>');
          }
        } else {
          await processResults(arg);
        }
        break;
      
      case 'run':
        await runAll();
        break;
      
      default:
        console.log('Usage:');
        console.log('  npx ts-node scripts/batch-validate.ts prepare   - Prepare and submit batch');
        console.log('  npx ts-node scripts/batch-validate.ts status    - Check batch status');
        console.log('  npx ts-node scripts/batch-validate.ts process   - Process completed results');
        console.log('  npx ts-node scripts/batch-validate.ts run       - Run full pipeline with polling');
        console.log();
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
