/**
 * Seed Generation API
 * 
 * POST /api/admin/seeds - Generate diverse scenario seeds
 * GET /api/admin/seeds - Get cached seeds
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  ScenarioSeed,
  createDiversityTracker,
  buildSeedGenerationPrompt,
  updateTracker,
  parseSeedsFromResponse,
  getSubdomainStats,
  DiversityTracker,
} from '@/lib/prompts/seeding';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory cache for seeds (in production, use database)
let cachedSeeds: ScenarioSeed[] = [];
let cachedTracker: DiversityTracker | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      totalCount = 120,
      batchSize = 20,
      clearCache = false,
    } = body;

    // Initialize or reset tracker
    if (clearCache || !cachedTracker) {
      cachedTracker = createDiversityTracker();
      cachedSeeds = [];
    }

    const allSeeds: ScenarioSeed[] = [...cachedSeeds];
    const numBatches = Math.ceil((totalCount - allSeeds.length) / batchSize);

    // Generate seeds in batches
    for (let batch = 0; batch < numBatches; batch++) {
      const remaining = totalCount - allSeeds.length;
      const currentBatchSize = Math.min(batchSize, remaining);
      
      if (currentBatchSize <= 0) break;

      const prompt = buildSeedGenerationPrompt(
        currentBatchSize,
        cachedTracker,
        allSeeds.length / batchSize
      );

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, // Higher temperature for diversity
        max_tokens: 4000,
      });

      const response = completion.choices[0]?.message?.content || '';
      const newSeeds = parseSeedsFromResponse(response);

      if (newSeeds.length > 0) {
        // Assign unique IDs
        newSeeds.forEach((seed, idx) => {
          seed.id = `seed-${allSeeds.length + idx + 1}`;
        });
        
        updateTracker(cachedTracker, newSeeds);
        allSeeds.push(...newSeeds);
      }

      // Small delay between batches to avoid rate limits
      if (batch < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update cache
    cachedSeeds = allSeeds;

    return NextResponse.json({
      success: true,
      seeds: allSeeds,
      count: allSeeds.length,
      stats: {
        subdomainDistribution: getSubdomainStats(cachedTracker),
        uniqueEntities: cachedTracker.usedEntities.size,
        uniqueEvents: cachedTracker.usedEvents.size,
      },
    });
  } catch (error) {
    console.error('Seed generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate seeds', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    seeds: cachedSeeds,
    count: cachedSeeds.length,
    stats: cachedTracker ? {
      subdomainDistribution: getSubdomainStats(cachedTracker),
      uniqueEntities: cachedTracker.usedEntities.size,
      uniqueEvents: cachedTracker.usedEvents.size,
    } : null,
  });
}

