/**
 * CS372 Assignment 2 - Hierarchical Case Generation API (v2)
 *
 * Uses the new modular prompt system with topic seeding:
 * 1. Generate diverse scenario seeds
 * 2. Assign seeds to (Level, Validity, TrapType) buckets
 * 3. Use bucket-specific prompt with assigned seed
 * 4. Generate with focused prompt for that specific bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import {
  hierarchicalSample,
  DistributionNeeds,
  SamplingResult,
} from '@/lib/assignment2-taxonomy';
import { getTrapTypeString, DOMAIN_MARKETS } from '@/lib/assignment2-prompts';
import {
  getPromptFromSample,
  ScenarioSeed,
  createDiversityTracker,
  buildSeedGenerationPrompt,
  updateTracker,
  parseSeedsFromResponse,
  DOMAIN_MARKETS as PROMPT_DOMAIN,
} from '@/lib/prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Target distribution for CS372 Assignment 2 (Revised: 170 cases, L1:L2:L3 = 1:6:3)
const TARGETS = {
  total: 170,
  L1: 17,
  L2: 102,
  L3: 51,
};

interface GenerateV2Request {
  count?: number; // Number of questions to generate (ignored if distribution provided)
  dataset?: string; // Dataset name (default: cs372-assignment2)
  author?: string; // Author email
  distribution?: { // Explicit distribution (overrides count and auto-sampling)
    L1?: number;
    L2?: number;
    L3?: number;
  };
  pearlLevel?: string; // Force specific Pearl level (L1, L2, L3)
  answerType?: string; // Force specific answer type (YES, NO, AMBIGUOUS, VALID, INVALID, CONDITIONAL)
}

// Note: The actual generated response is parsed inline with explicit type
// to match the OUTPUT_FORMAT templates in shared.ts

/**
 * Get current distribution from database
 */
async function getCurrentDistribution(dataset: string): Promise<DistributionNeeds> {
  const questions = await prisma.question.findMany({
    where: { dataset },
    select: { pearlLevel: true },
  });

  const counts = { L1: 0, L2: 0, L3: 0 };
  questions.forEach((q) => {
    if (q.pearlLevel && counts[q.pearlLevel as keyof typeof counts] !== undefined) {
      counts[q.pearlLevel as keyof typeof counts]++;
    }
  });

  return {
    L1: { needed: TARGETS.L1, current: counts.L1 },
    L2: { needed: TARGETS.L2, current: counts.L2 },
    L3: { needed: TARGETS.L3, current: counts.L3 },
  };
}

/**
 * Generate a single question using new modular prompt system with seed
 */
async function generateSingleQuestion(
  sample: SamplingResult,
  seed: ScenarioSeed,
  dataset: string,
  author: string
): Promise<{ success: boolean; question?: unknown; error?: string }> {
  // Get the appropriate prompt definition for this sample
  const promptDef = getPromptFromSample(sample);

  if (!promptDef) {
    console.error(`No prompt found for sample: ${sample.pearlLevel} ${sample.answerType}`);
    return { success: false, error: 'No prompt definition found for this sample type' };
  }

  // Build the prompt with the scenario seed
  const prompt = promptDef.buildPrompt(seed);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate training questions for the T³ benchmark. Follow specifications EXACTLY. Always respond with valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    const generated = JSON.parse(content) as {
      scenario: string;
      claim?: string;
      causalClaim?: string;
      counterfactualClaim?: string;
      variables?: { X?: string; Y?: string; Z?: string };
      groundTruth: string;
      trapType?: string;
      trapSubtype?: string;
      causalStructure?: string;  // Description of causal graph
      keyInsight?: string;       // One-line memorable takeaway
      hiddenQuestion?: string;
      hiddenTimestamp?: string;  // LLM outputs this field name per OUTPUT_FORMAT
      conditionalAnswers?: string[] | { answer_if_condition_1?: string; answer_if_condition_2?: string };
      wiseRefusal?: string;
      goldRationale?: string;    // Complete explanation
      difficulty?: string;
      explanation?: string;
      justification?: string;
      invariants?: string[] | string;
    };

    // Keep L3 answer types as-is (VALID/INVALID/CONDITIONAL)
    // Keep L1/L2 answer types as-is (YES/NO/AMBIGUOUS)
    const groundTruth = generated.groundTruth;

    // Build claim string from the generated content
    // Priority: claim field (from OUTPUT_FORMAT) > legacy fields > fallback
    const claim = generated.claim || generated.causalClaim || generated.counterfactualClaim ||
      `Does ${generated.variables?.X || 'X'} cause ${generated.variables?.Y || 'Y'}?`;

    // Build conditional_answers - always ensure at least 2 elements for schema consistency
    // LLM may output as object {answer_if_condition_1, answer_if_condition_2} or array
    let conditionalAnswersValue: string;
    if (groundTruth === 'AMBIGUOUS' || groundTruth === 'CONDITIONAL') {
      const rawAnswers = generated.conditionalAnswers;
      let answers: (string | null)[];
      
      if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
        // Object format from OUTPUT_FORMAT
        answers = [
          rawAnswers.answer_if_condition_1 || null,
          rawAnswers.answer_if_condition_2 || null
        ];
      } else if (Array.isArray(rawAnswers)) {
        answers = rawAnswers;
      } else {
        answers = [null, null];
      }
      
      // Ensure at least 2 elements
      while (answers.length < 2) {
        answers.push(null);
      }
      conditionalAnswersValue = JSON.stringify(answers);
    } else {
      // Non-ambiguous/conditional: use null values but maintain 2-element structure
      conditionalAnswersValue = JSON.stringify([null, null]);
    }

    // Create question in database (id is auto-generated)
    const question = await prisma.question.create({
      data: {
        scenario: generated.scenario,
        claim,
        pearlLevel: sample.pearlLevel,
        domain: DOMAIN_MARKETS.name,
        subdomain: seed.subdomain,
        trapType: getTrapTypeString(sample),
        trapSubtype: generated.trapSubtype || sample.trapType?.name || sample.sheepType?.name || sample.l3Family?.name || '',
        groundTruth,
        causalStructure: generated.causalStructure || null,
        keyInsight: generated.keyInsight || null,
        explanation: generated.explanation || generated.goldRationale || generated.wiseRefusal || '',
        // For ambiguous/conditional cases, use generated values; otherwise use null
        // Check both field names since OUTPUT_FORMAT uses hiddenTimestamp but interface had hiddenQuestion
        hiddenTimestamp: (groundTruth === 'AMBIGUOUS' || groundTruth === 'CONDITIONAL') 
          ? (generated.hiddenTimestamp || generated.hiddenQuestion || null)
          : null,
        conditionalAnswers: conditionalAnswersValue,
        wiseRefusal: generated.wiseRefusal,
        variables: generated.variables ? JSON.stringify(generated.variables) : null,
        dataset,
        difficulty: generated.difficulty || 'Medium',
        author,
        isVerified: false,
        isLLMGenerated: true,
        // Validation fields for CS372 Assignment 2
        initialAuthor: author,
        validationStatus: 'pending',
      },
    });

    return { success: true, question };
  } catch (error) {
    console.error('Generation error:', error);
    return { success: false, error: String(error) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateV2Request = await req.json();
    const { 
      dataset = 'cs372-assignment2', 
      author = 'lgren007@stanford.edu', 
      distribution,
      pearlLevel: forcedPearlLevel,
      answerType: forcedAnswerType 
    } = body;

    // Build task queue based on distribution or count
    type TaskLevel = 'L1' | 'L2' | 'L3';
    const taskQueue: TaskLevel[] = [];

    if (distribution) {
      // Use explicit distribution
      const l1Count = distribution.L1 || 0;
      const l2Count = distribution.L2 || 0;
      const l3Count = distribution.L3 || 0;
      const totalCount = l1Count + l2Count + l3Count;

      if (totalCount < 1 || totalCount > 200) {
        return NextResponse.json({ error: 'Total distribution count must be between 1 and 200' }, { status: 400 });
      }

      // Add tasks for each level
      for (let i = 0; i < l1Count; i++) taskQueue.push('L1');
      for (let i = 0; i < l2Count; i++) taskQueue.push('L2');
      for (let i = 0; i < l3Count; i++) taskQueue.push('L3');

      // Shuffle to interleave levels
      for (let i = taskQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [taskQueue[i], taskQueue[j]] = [taskQueue[j], taskQueue[i]];
      }

      console.log(`[V2 Gen] Using explicit distribution: L1=${l1Count}, L2=${l2Count}, L3=${l3Count}`);
    } else {
      // Use count with auto-sampling
      const count = body.count || 10;
      if (count < 1 || count > 50) {
        return NextResponse.json({ error: 'Count must be between 1 and 50' }, { status: 400 });
      }
      // Fill with placeholder - will use hierarchicalSample
      for (let i = 0; i < count; i++) taskQueue.push('L1'); // Placeholder, will be overwritten
    }

    const totalTasks = taskQueue.length;

    // Get current distribution for sampling (used when no explicit distribution)
    const needs = await getCurrentDistribution(dataset);

    // Phase 1: Generate diverse scenario seeds
    console.log(`[V2 Gen] Generating ${totalTasks} diverse scenario seeds...`);
    const tracker = createDiversityTracker();
    const seeds: ScenarioSeed[] = [];

    // Generate seeds in batches
    const batchSize = 20;
    const numBatches = Math.ceil(totalTasks / batchSize);

    for (let batch = 0; batch < numBatches; batch++) {
      const remaining = totalTasks - seeds.length;
      const currentBatchSize = Math.min(batchSize, remaining);

      if (currentBatchSize <= 0) break;

      const seedPrompt = buildSeedGenerationPrompt(currentBatchSize, tracker, batch);

      try {
        const seedCompletion = await openai.chat.completions.create({
          model: 'gpt-5.2',
          messages: [{ role: 'user', content: seedPrompt }],
          temperature: 0.9,
          max_completion_tokens: 4000,
        });

        const seedResponse = seedCompletion.choices[0]?.message?.content || '';
        const newSeeds = parseSeedsFromResponse(seedResponse);

        if (newSeeds.length > 0) {
          newSeeds.forEach((seed, idx) => {
            seed.id = `seed-${seeds.length + idx + 1}`;
          });
          updateTracker(tracker, newSeeds);
          seeds.push(...newSeeds);
        }
      } catch (seedError) {
        console.error('Seed generation error:', seedError);
        // Continue with fallback seeds if needed
      }

      if (batch < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Ensure we have enough seeds (fallback to basic seeds if needed)
    while (seeds.length < totalTasks) {
      const idx = seeds.length;
      seeds.push({
        id: `seed-fallback-${idx}`,
        topic: `Market Event ${idx + 1}`,
        subdomain: PROMPT_DOMAIN.subdomains[idx % PROMPT_DOMAIN.subdomains.length],
        entities: [`Company ${idx + 1}`, `Fund ${idx + 1}`],
        timeframe: 'Q1 2024',
        event: `Financial market event affecting multiple stakeholders`,
        context: `A significant market development requiring causal analysis`,
      });
    }

    console.log(`[V2 Gen] Generated ${seeds.length} seeds. Starting case generation...`);

    // Generate questions using seeds
    const results: { success: boolean; pearlLevel?: string; answerType?: string; trapType?: string; seedId?: string; error?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < totalTasks; i++) {
      // Determine sample based on mode
      let sample: SamplingResult;
      if (forcedPearlLevel && forcedAnswerType) {
        // Force specific level and answer type
        sample = hierarchicalSample(needs, forcedPearlLevel as 'L1' | 'L2' | 'L3', forcedAnswerType);
      } else if (distribution) {
        // Use explicit level from task queue, sample answer type within that level
        const forcedLevel = taskQueue[i];
        sample = hierarchicalSample(needs, forcedLevel);
      } else {
        // Auto-sample based on needs
        sample = hierarchicalSample(needs);
      }

      // Get the corresponding seed
      const seed = seeds[i];

      console.log(
        `[V2 Gen ${i + 1}/${totalTasks}] ${sample.pearlLevel} - ${sample.answerType} - ${getTrapTypeString(sample)} | Seed: ${seed.topic}`
      );

      const result = await generateSingleQuestion(sample, seed, dataset, author);

      if (result.success && result.question) {
        successCount++;
        // Update needs for next iteration
        if (sample.pearlLevel === 'L1') needs.L1.current++;
        else if (sample.pearlLevel === 'L2') needs.L2.current++;
        else if (sample.pearlLevel === 'L3') needs.L3.current++;

        results.push({
          success: true,
          pearlLevel: sample.pearlLevel,
          answerType: sample.answerType,
          trapType: getTrapTypeString(sample),
          seedId: seed.id,
        });
      } else {
        errorCount++;
        results.push({
          success: false,
          pearlLevel: sample.pearlLevel,
          answerType: sample.answerType,
          error: result.error,
        });
      }

      // Small delay between requests (shorter for large batches)
      if (i < totalTasks - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Get updated distribution
    const updatedNeeds = await getCurrentDistribution(dataset);

    return NextResponse.json({
      success: true,
      generated: successCount,
      errors: errorCount,
      results,
      distribution: {
        L1: { current: updatedNeeds.L1.current, target: TARGETS.L1 },
        L2: { current: updatedNeeds.L2.current, target: TARGETS.L2 },
        L3: { current: updatedNeeds.L3.current, target: TARGETS.L3 },
        total: {
          current: updatedNeeds.L1.current + updatedNeeds.L2.current + updatedNeeds.L3.current,
          target: TARGETS.total,
        },
      },
    });
  } catch (error) {
    console.error('V2 Generation error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}

export async function GET() {
  // Return current distribution and target info
  const needs = await getCurrentDistribution('cs372-assignment2');

  return NextResponse.json({
    targets: TARGETS,
    current: {
      L1: needs.L1.current,
      L2: needs.L2.current,
      L3: needs.L3.current,
      total: needs.L1.current + needs.L2.current + needs.L3.current,
    },
    remaining: {
      L1: Math.max(0, TARGETS.L1 - needs.L1.current),
      L2: Math.max(0, TARGETS.L2 - needs.L2.current),
      L3: Math.max(0, TARGETS.L3 - needs.L3.current),
      total: Math.max(0, TARGETS.total - (needs.L1.current + needs.L2.current + needs.L3.current)),
    },
  });
}

