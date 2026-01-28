/**
 * Script to generate missing L1 types
 * Ensures we have at least one case for each WOLF and SHEEP type
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { L1_WOLF_TYPES, L1_SHEEP_TYPES, SamplingResult, TrapDefinition, SheepDefinition, sampleDifficulty } from '@/lib/assignment2-taxonomy';
import { getTrapTypeString, DOMAIN_MARKETS } from '@/lib/assignment2-prompts';
import { getPromptFromSample, buildSeedGenerationPrompt, parseSeedsFromResponse, createDiversityTracker, ScenarioSeed, DOMAIN_MARKETS as PROMPT_DOMAIN } from '@/lib/prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getExistingL1Types(): Promise<Set<string>> {
  const questions = await prisma.question.findMany({
    where: { pearlLevel: 'L1' },
    select: { trapType: true },
  });
  
  // Extract the code (W1, S2, etc.) from trapType format "CODE:NAME"
  const codes = new Set<string>();
  for (const q of questions) {
    if (q.trapType) {
      const code = q.trapType.split(':')[0];
      codes.add(code);
    }
  }
  return codes;
}

async function generateSeed(): Promise<ScenarioSeed> {
  const tracker = createDiversityTracker();
  const seedPrompt = buildSeedGenerationPrompt(1, tracker, 0);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: seedPrompt }],
      temperature: 0.9,
      max_tokens: 2000,
    });
    
    const response = completion.choices[0]?.message?.content || '';
    const seeds = parseSeedsFromResponse(response);
    
    if (seeds.length > 0) {
      return seeds[0];
    }
  } catch (e) {
    console.error('Error generating seed:', e);
  }
  
  // Fallback seed
  return {
    id: `seed-${Date.now()}`,
    topic: 'Financial Market Analysis',
    subdomain: PROMPT_DOMAIN.subdomains[Math.floor(Math.random() * PROMPT_DOMAIN.subdomains.length)],
    entities: ['Company A', 'Fund B'],
    timeframe: 'Q1 2024',
    event: 'Market event requiring causal analysis',
    context: 'Financial market scenario',
  };
}

async function generateQuestion(
  sample: SamplingResult,
  seed: ScenarioSeed,
  author: string
): Promise<{ success: boolean; error?: string }> {
  const promptDef = getPromptFromSample(sample);
  
  if (!promptDef) {
    return { success: false, error: 'No prompt definition found' };
  }
  
  const prompt = promptDef.buildPrompt(seed);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in causal reasoning. Generate training questions for the T³ benchmark. Always respond with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
      response_format: { type: 'json_object' },
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Empty response' };
    }
    
    const generated = JSON.parse(content) as {
      scenario: string;
      claim?: string;
      causalClaim?: string;
      variables?: { X?: string; Y?: string; Z?: string };
      groundTruth: string;
      trapSubtype?: string;
      wiseRefusal?: string;
      difficulty?: string;
      explanation?: string;
    };
    
    const groundTruth = generated.groundTruth;
    const claim = generated.claim || generated.causalClaim || 
      `Does ${generated.variables?.X || 'X'} cause ${generated.variables?.Y || 'Y'}?`;
    
    await prisma.question.create({
      data: {
        scenario: generated.scenario,
        claim,
        pearlLevel: sample.pearlLevel,
        domain: DOMAIN_MARKETS.name,
        subdomain: seed.subdomain,
        trapType: getTrapTypeString(sample),
        trapSubtype: generated.trapSubtype || sample.trapType?.name || sample.sheepType?.name || '',
        groundTruth,
        explanation: generated.explanation || generated.wiseRefusal || '',
        hiddenTimestamp: null,
        conditionalAnswers: JSON.stringify([null, null]),
        wiseRefusal: generated.wiseRefusal,
        variables: generated.variables ? JSON.stringify(generated.variables) : null,
        dataset: 'cs372-assignment2',
        difficulty: generated.difficulty || 'Medium',
        author,
        isVerified: false,
        isLLMGenerated: true,
        initialAuthor: author,
        validationStatus: 'pending',
      },
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function main() {
  const author = 'lgren007@stanford.edu';
  
  // Get existing types
  const existingTypes = await getExistingL1Types();
  console.log('Existing L1 types:', Array.from(existingTypes));
  
  // Find missing WOLF types
  const missingWolf: TrapDefinition[] = [];
  for (const wolf of L1_WOLF_TYPES) {
    if (!existingTypes.has(wolf.id)) {
      missingWolf.push(wolf);
    }
  }
  
  // Find missing SHEEP types
  const missingSheep: SheepDefinition[] = [];
  for (const sheep of L1_SHEEP_TYPES) {
    if (!existingTypes.has(sheep.id)) {
      missingSheep.push(sheep);
    }
  }
  
  console.log('Missing WOLF types:', missingWolf.map(w => w.id));
  console.log('Missing SHEEP types:', missingSheep.map(s => s.id));
  
  const totalMissing = missingWolf.length + missingSheep.length;
  console.log(`\nGenerating ${totalMissing} cases for missing types...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Generate missing WOLF (NO) types
  for (const wolf of missingWolf) {
    console.log(`Generating ${wolf.id}: ${wolf.name}...`);
    const seed = await generateSeed();
    
    const sample: SamplingResult = {
      pearlLevel: 'L1',
      answerType: 'NO',
      difficulty: sampleDifficulty(),  // Apply 1:2:1 distribution
      trapType: wolf,
    };
    
    const result = await generateQuestion(sample, seed, author);
    if (result.success) {
      console.log(`  ✓ Generated ${wolf.id}`);
      successCount++;
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
      errorCount++;
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Generate missing SHEEP (YES) types
  for (const sheep of missingSheep) {
    console.log(`Generating ${sheep.id}: ${sheep.name}...`);
    const seed = await generateSeed();
    
    const sample: SamplingResult = {
      pearlLevel: 'L1',
      answerType: 'YES',
      difficulty: sampleDifficulty(),  // Apply 1:2:1 distribution
      sheepType: sheep,
    };
    
    const result = await generateQuestion(sample, seed, author);
    if (result.success) {
      console.log(`  ✓ Generated ${sheep.id}`);
      successCount++;
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
      errorCount++;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Show updated coverage
  const updatedTypes = await getExistingL1Types();
  console.log(`\nL1 type coverage: ${updatedTypes.size}/18`);
  console.log('Covered types:', Array.from(updatedTypes).sort());
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
