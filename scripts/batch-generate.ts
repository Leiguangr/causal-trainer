/**
 * Batch Generation Script using OpenAI Batch API
 * 
 * Generates 280 cases with distribution:
 * - L1: 28 (10%) - balanced across W1-W10, S1-S8
 * - L2: 168 (60%) - balanced across T1-T17
 * - L3: 84 (30%) - balanced across F1-F8, with VALID/INVALID/CONDITIONAL
 */

import * as fs from 'fs';
import * as path from 'path';
import { Blob } from 'node:buffer';
import OpenAI, { toFile } from 'openai';
import { prisma } from '@/lib/prisma';

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
import { getPromptFromSample } from '@/lib/prompts';
import { SamplingResult } from '@/lib/assignment2-taxonomy';
import { 
  L1_WOLF_TYPES, 
  L1_SHEEP_TYPES, 
  L2_TRAP_TYPES, 
  L3_FAMILIES,
} from '@/lib/assignment2-taxonomy';
import { DOMAIN_MARKETS } from '@/lib/assignment2-prompts';

// Market subdomains for diversity
const SUBDOMAINS = [
  'Asset pricing and valuation',
  'Trading strategies and market microstructure',
  'Risk management and hedging',
  'Corporate finance and capital structure',
  'Derivatives and structured products',
  'Behavioral finance and market psychology',
  'International finance and exchange rates',
  'Fixed income and credit markets',
  'Alternative investments and private equity',
  'Financial regulation and compliance',
  'Fintech and digital assets',
  'Sustainable finance and ESG',
];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Target distribution for 500 cases
const TARGET = {
  L1: 50,  // 10%
  L2: 300, // 60%
  L3: 150, // 30%
  TOTAL: 500
};

// L1 distribution: 50 / 18 ≈ 2.8 per trap type
// WOLF (NO): 25 cases, SHEEP (YES): 25 cases
const L1_DISTRIBUTION = {
  // WOLF types (NO answers) - 25 total
  W1: 3, W2: 3, W3: 2, W4: 2, W5: 3, W6: 2, W7: 3, W8: 2, W9: 3, W10: 2,
  // SHEEP types (YES answers) - 25 total
  S1: 4, S2: 4, S3: 3, S4: 3, S5: 3, S6: 2, S7: 3, S8: 3,
};

// L2 distribution: 300 / 17 ≈ 17-18 per trap type
const L2_DISTRIBUTION = {
  T1: 18, T2: 18, T3: 18, T4: 17, T5: 18, T6: 17, T7: 18, T8: 17, T9: 18,
  T10: 18, T11: 17, T12: 17, T13: 18, T14: 17, T15: 18, T16: 17, T17: 17,
};

// L3 distribution: 150 / 8 ≈ 18-19 per family
// Split across VALID (35%), INVALID (35%), CONDITIONAL (30%)
const L3_DISTRIBUTION = {
  F1: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F2: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F3: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F4: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F5: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F6: { VALID: 0, INVALID: 0, CONDITIONAL: 19 }, // F6 only supports CONDITIONAL
  F7: { VALID: 7, INVALID: 7, CONDITIONAL: 5 },
  F8: { VALID: 7, INVALID: 7, CONDITIONAL: 4 },
};

interface BatchRequest {
  custom_id: string;
  method: string;
  url: string;
  body: {
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    response_format: { type: string };
  };
}

function getRandomSubdomain(): string {
  return SUBDOMAINS[Math.floor(Math.random() * SUBDOMAINS.length)];
}

// Sample entities for diverse scenarios
const SAMPLE_ENTITIES = [
  ['TechCorp', 'RetailGiant', 'Market Index'],
  ['Alpha Fund', 'Beta Securities', 'Hedge Fund X'],
  ['Bank ABC', 'Insurance Corp', 'Credit Agency'],
  ['Energy Co', 'Green Power', 'Oil Major'],
  ['Pharma Inc', 'BioTech Start', 'FDA'],
  ['Crypto Exchange', 'DeFi Protocol', 'Stablecoin'],
  ['Retail Investor', 'Institutional Fund', 'Market Maker'],
  ['Central Bank', 'Treasury', 'Bond Market'],
];

const TIMEFRAMES = [
  'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024',
  'H1 2023', 'H2 2023', '2022-2023', 'Last 12 months',
];

const EVENTS = [
  'earnings announcement', 'merger announcement', 'regulatory change',
  'market correction', 'interest rate decision', 'product launch',
  'executive change', 'dividend announcement', 'stock split',
  'acquisition offer', 'IPO', 'bankruptcy filing',
];

const CONTEXTS = [
  'during high market volatility',
  'amid economic uncertainty',
  'following a major policy shift',
  'in a bull market environment',
  'during a sector rotation',
  'after unexpected economic data',
  'in response to geopolitical tensions',
  'following industry disruption',
];

function createSeed(requestId: number, difficulty?: Difficulty): { id: string; topic: string; subdomain: string; entities: string[]; timeframe: string; event: string; context: string; hook: string; difficulty?: Difficulty } {
  return {
    id: `seed-${requestId}`,
    topic: `Market scenario ${requestId}`,
    subdomain: SUBDOMAINS[requestId % SUBDOMAINS.length],
    entities: SAMPLE_ENTITIES[requestId % SAMPLE_ENTITIES.length],
    timeframe: TIMEFRAMES[requestId % TIMEFRAMES.length],
    event: EVENTS[requestId % EVENTS.length],
    context: CONTEXTS[requestId % CONTEXTS.length],
    hook: 'A realistic market scenario',
    difficulty,  // Pass through the difficulty level
  };
}

// Difficulty sampling with 1:2:1 distribution (Easy:Medium:Hard)
type Difficulty = 'Easy' | 'Medium' | 'Hard';

function sampleDifficulty(): Difficulty {
  const r = Math.random();
  if (r < 0.25) return 'Easy';
  if (r < 0.75) return 'Medium';
  return 'Hard';
}

function buildSample(level: string, trapCode: string, answerType?: string, difficulty?: Difficulty): SamplingResult {
  const result: SamplingResult = { 
    pearlLevel: level as 'L1' | 'L2' | 'L3', 
    answerType: '',
    difficulty: difficulty || sampleDifficulty()  // Apply 1:2:1 distribution
  };
  
  if (level === 'L1') {
    if (trapCode.startsWith('W')) {
      result.answerType = 'NO';
      result.trapType = L1_WOLF_TYPES.find(t => t.id === trapCode);
    } else {
      result.answerType = 'YES';
      result.sheepType = L1_SHEEP_TYPES.find(t => t.id === trapCode);
    }
  } else if (level === 'L2') {
    result.answerType = 'NO';
    result.trapType = L2_TRAP_TYPES.find(t => t.id === trapCode);
  } else if (level === 'L3') {
    result.answerType = answerType || 'VALID';
    result.l3Family = L3_FAMILIES.find(f => f.id === trapCode);
  }
  
  return result;
}

async function createBatchRequests(): Promise<BatchRequest[]> {
  const requests: BatchRequest[] = [];
  let requestId = 0;

  // Generate L1 requests
  for (const [trapCode, count] of Object.entries(L1_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      const sample = buildSample('L1', trapCode);
      const promptDef = getPromptFromSample(sample);
      if (!promptDef) continue;

      const seed = createSeed(requestId, sample.difficulty);
      const prompt = promptDef.buildPrompt(seed);
      
      requests.push({
        custom_id: `L1-${trapCode}-${i}-${requestId}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-5.2',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in causal reasoning and Pearl\'s Causality Hierarchy. Generate training questions for the T³ benchmark. Follow specifications EXACTLY. Always respond with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          response_format: { type: 'json_object' },
        },
      });
      requestId++;
    }
  }

  // Generate L2 requests
  for (const [trapCode, count] of Object.entries(L2_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      const sample = buildSample('L2', trapCode);
      const promptDef = getPromptFromSample(sample);
      if (!promptDef) continue;

      const seed = createSeed(requestId, sample.difficulty);
      const prompt = promptDef.buildPrompt(seed);
      
      requests.push({
        custom_id: `L2-${trapCode}-${i}-${requestId}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-5.2',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in causal reasoning and Pearl\'s Causality Hierarchy. Generate training questions for the T³ benchmark. Follow specifications EXACTLY. Always respond with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          response_format: { type: 'json_object' },
        },
      });
      requestId++;
    }
  }

  // Generate L3 requests
  for (const [familyCode, answers] of Object.entries(L3_DISTRIBUTION)) {
    for (const [answerType, count] of Object.entries(answers)) {
      for (let i = 0; i < count; i++) {
        const sample = buildSample('L3', familyCode, answerType);
        const promptDef = getPromptFromSample(sample);
        if (!promptDef) continue;

        const seed = createSeed(requestId, sample.difficulty);
        const prompt = promptDef.buildPrompt(seed);
        
        requests.push({
          custom_id: `L3-${familyCode}-${answerType}-${i}-${requestId}`,
          method: 'POST',
          url: '/v1/chat/completions',
          body: {
            model: 'gpt-5.2',
            messages: [
              {
                role: 'system',
                content: 'You are an expert in causal reasoning and Pearl\'s Causality Hierarchy. Generate training questions for the T³ benchmark. Follow specifications EXACTLY. Always respond with valid JSON.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          },
        });
        requestId++;
      }
    }
  }

  return requests;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';

  if (command === 'create') {
    console.log('Creating batch requests...');
    const requests = await createBatchRequests();
    console.log(`Created ${requests.length} requests`);

    // Write to JSONL file
    const jsonlPath = path.join(process.cwd(), 'data', 'batch-requests.jsonl');
    const jsonlContent = requests.map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(jsonlPath, jsonlContent);
    console.log(`Written to ${jsonlPath}`);

    // Upload file to OpenAI
    console.log('Uploading file to OpenAI...');
    const fileContent = fs.readFileSync(jsonlPath);
    const file = await openai.files.create({
      file: await toFile(fileContent, 'batch-requests.jsonl'),
      purpose: 'batch',
    });
    console.log(`File uploaded: ${file.id}`);

    // Create batch
    console.log('Creating batch job...');
    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        description: 'T3 Causal Reasoning Benchmark - 280 cases',
      },
    });
    console.log(`Batch created: ${batch.id}`);
    console.log(`Status: ${batch.status}`);
    
    // Save batch ID for later
    fs.writeFileSync(
      path.join(process.cwd(), 'data', 'batch-id.txt'),
      batch.id
    );
    console.log('\nRun "npx tsx scripts/batch-generate.ts status" to check progress');
    console.log('Run "npx tsx scripts/batch-generate.ts process" to process results when complete');

  } else if (command === 'status') {
    const batchId = fs.readFileSync(
      path.join(process.cwd(), 'data', 'batch-id.txt'),
      'utf-8'
    ).trim();
    
    const batch = await openai.batches.retrieve(batchId);
    console.log(`Batch ID: ${batch.id}`);
    console.log(`Status: ${batch.status}`);
    console.log(`Created: ${new Date(batch.created_at * 1000).toISOString()}`);
    if (batch.completed_at) {
      console.log(`Completed: ${new Date(batch.completed_at * 1000).toISOString()}`);
    }
    console.log(`Request counts:`);
    console.log(`  Total: ${batch.request_counts?.total || 0}`);
    console.log(`  Completed: ${batch.request_counts?.completed || 0}`);
    console.log(`  Failed: ${batch.request_counts?.failed || 0}`);
    
    if (batch.output_file_id) {
      console.log(`\nOutput file ready: ${batch.output_file_id}`);
      console.log('Run "npx tsx scripts/batch-generate.ts process" to process results');
    }

  } else if (command === 'process') {
    const batchId = fs.readFileSync(
      path.join(process.cwd(), 'data', 'batch-id.txt'),
      'utf-8'
    ).trim();
    
    const batch = await openai.batches.retrieve(batchId);
    
    if (batch.status !== 'completed') {
      console.log(`Batch not yet complete. Status: ${batch.status}`);
      return;
    }

    if (!batch.output_file_id) {
      console.log('No output file available');
      return;
    }

    // Download results
    console.log('Downloading results...');
    const fileResponse = await openai.files.content(batch.output_file_id);
    const fileContent = await fileResponse.text();
    
    const outputPath = path.join(process.cwd(), 'data', 'batch-results.jsonl');
    fs.writeFileSync(outputPath, fileContent);
    console.log(`Results saved to ${outputPath}`);

    // Process results
    console.log('Processing results and saving to database...');
    const lines = fileContent.trim().split('\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        const customId = result.custom_id;
        const [level, trapCode, answerTypeOrIndex] = customId.split('-');
        
        if (result.error) {
          console.log(`Error for ${customId}: ${result.error.message}`);
          errorCount++;
          continue;
        }

        const content = result.response?.body?.choices?.[0]?.message?.content;
        if (!content) {
          console.log(`No content for ${customId}`);
          errorCount++;
          continue;
        }

        const generated = JSON.parse(content);
        
        // Determine ground truth and other fields based on level
        let groundTruth = generated.groundTruth;
        let trapType = '';
        let trapSubtype = generated.trapSubtype || '';
        
        if (level === 'L1') {
          trapType = `${trapCode}:${generated.trapSubtype || trapCode}`;
        } else if (level === 'L2') {
          trapType = `${trapCode}:${generated.trapSubtype || trapCode}`;
          groundTruth = 'NO'; // All L2 must be NO
        } else if (level === 'L3') {
          trapType = `${trapCode}:${generated.trapSubtype || trapCode}`;
        }

        // Build conditional answers
        let conditionalAnswersValue: string;
        if (groundTruth === 'AMBIGUOUS' || groundTruth === 'CONDITIONAL') {
          const rawAnswers = generated.conditionalAnswers;
          let answers: (string | null)[];
          
          if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
            answers = [
              rawAnswers.answer_if_condition_1 || null,
              rawAnswers.answer_if_condition_2 || null
            ];
          } else if (Array.isArray(rawAnswers)) {
            answers = rawAnswers;
          } else {
            answers = [null, null];
          }
          
          while (answers.length < 2) answers.push(null);
          conditionalAnswersValue = JSON.stringify(answers);
        } else {
          conditionalAnswersValue = JSON.stringify([null, null]);
        }

        // Get subdomain from the seed
        const subdomainMatch = customId.match(/seed-(\d+)/);
        const subdomain = SUBDOMAINS[parseInt(subdomainMatch?.[1] || '0') % SUBDOMAINS.length];

        // Create database entry
        await prisma.question.create({
          data: {
            scenario: generated.scenario,
            claim: generated.claim || generated.causalClaim || generated.counterfactualClaim || '',
            pearlLevel: level,
            domain: DOMAIN_MARKETS.name,
            subdomain: subdomain,
            trapType,
            trapSubtype,
            groundTruth,
            causalStructure: generated.causalStructure || null,
            keyInsight: generated.keyInsight || null,
            explanation: generated.explanation || generated.goldRationale || generated.wiseRefusal || '',
            hiddenTimestamp: (groundTruth === 'AMBIGUOUS' || groundTruth === 'CONDITIONAL')
              ? (generated.hiddenTimestamp || generated.hiddenQuestion || null)
              : null,
            conditionalAnswers: conditionalAnswersValue,
            wiseRefusal: generated.wiseRefusal,
            variables: generated.variables ? JSON.stringify(generated.variables) : null,
            dataset: 'cs372-assignment2',
            difficulty: generated.difficulty || 'Medium',
            author: 'lgren007@stanford.edu',
            isVerified: false,
            isLLMGenerated: true,
            initialAuthor: 'lgren007@stanford.edu',
            validationStatus: 'pending',
          },
        });

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`Processed ${successCount} cases...`);
        }
      } catch (err) {
        console.log(`Error processing line: ${err}`);
        errorCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

  } else if (command === 'clear') {
    console.log('Clearing all existing cases...');
    const deleted = await prisma.question.deleteMany({
      where: { dataset: 'cs372-assignment2' },
    });
    console.log(`Deleted ${deleted.count} cases`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
