/**
 * Topic Seeding System
 * 
 * Pre-generates diverse scenario seeds to ensure variety across generated cases.
 * Phase 1: Generate unique seeds with diversity constraints
 * Phase 2: Assign seeds to specific (Level, Validity, TrapType) buckets
 */

import { ScenarioSeed } from './types';
import { DOMAIN_MARKETS } from './shared';

// Re-export ScenarioSeed for convenience
export type { ScenarioSeed } from './types';

// Track used elements to ensure diversity
export interface DiversityTracker {
  usedEntities: Set<string>;
  usedEvents: Set<string>;
  usedTimeframes: Set<string>;
  subdomainCounts: Map<string, number>;
}

export function createDiversityTracker(): DiversityTracker {
  return {
    usedEntities: new Set(),
    usedEvents: new Set(),
    usedTimeframes: new Set(),
    subdomainCounts: new Map(DOMAIN_MARKETS.subdomains.map(s => [s, 0])),
  };
}

// Example timeframes for variety
export const TIMEFRAME_EXAMPLES = [
  'Q1 2024', 'Q2 2024', 'Q3 2023', 'Q4 2023',
  'January 2024', 'March 2023', 'Summer 2023', 'Fall 2024',
  '2008 financial crisis', '2020 pandemic crash', '2021 meme stock rally',
  '2022 crypto winter', '2023 banking crisis', '2024 AI boom',
  'pre-pandemic era', 'post-COVID recovery', 'dot-com bubble era',
  'Great Recession period', 'pandemic lockdowns', 'rate hike cycle',
];

// Entity types for variety
export const ENTITY_TYPES = [
  'tech companies', 'banks', 'hedge funds', 'retail investors',
  'pension funds', 'startups', 'crypto exchanges', 'asset managers',
  'central banks', 'insurance companies', 'REITs', 'private equity firms',
  'ETF providers', 'market makers', 'broker-dealers', 'fintech companies',
];

// Event types for variety
export const EVENT_TYPES = [
  'earnings surprise', 'merger announcement', 'regulatory change',
  'market crash', 'IPO', 'stock buyback', 'dividend cut',
  'CEO departure', 'product launch', 'data breach', 'lawsuit filed',
  'credit downgrade', 'interest rate decision', 'currency devaluation',
  'supply chain disruption', 'activist investor campaign', 'accounting scandal',
  'algorithm malfunction', 'flash crash', 'short squeeze',
];

/**
 * Build the prompt for generating diverse scenario seeds
 */
export function buildSeedGenerationPrompt(
  count: number,
  tracker: DiversityTracker,
  batchIndex: number
): string {
  // Get least-used subdomains for this batch
  const sortedSubdomains = Array.from(tracker.subdomainCounts.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([s]) => s);

  const usedEntitiesList = Array.from(tracker.usedEntities).slice(-20).join(', ') || 'None yet';
  const usedEventsList = Array.from(tracker.usedEvents).slice(-20).join(', ') || 'None yet';

  return `You are generating unique scenario seeds for a financial markets causal reasoning benchmark.

TASK: Generate ${count} diverse scenario seeds. Each seed describes a specific market situation.

DIVERSITY REQUIREMENTS (CRITICAL):
1. Each seed MUST use DIFFERENT entities - no repeating companies, people, or assets
2. Each seed MUST describe a DIFFERENT event type
3. Spread across DIFFERENT timeframes
4. Use these PRIORITY subdomains (underrepresented): ${sortedSubdomains.join(', ')}

ALREADY USED (DO NOT REPEAT):
- Recent entities: ${usedEntitiesList}
- Recent events: ${usedEventsList}

SUBDOMAIN OPTIONS: ${DOMAIN_MARKETS.subdomains.join(', ')}

BATCH: ${batchIndex + 1} (ensure fresh ideas, not variations of previous batches)

OUTPUT FORMAT (JSON array):
[
  {
    "id": "seed-${batchIndex * count + 1}",
    "topic": "Brief topic title (5-10 words)",
    "subdomain": "One of the subdomain options",
    "entities": ["Company/Person 1", "Company/Person 2"],
    "timeframe": "Specific time period",
    "event": "Core market event (10-20 words)",
    "context": "Additional context that makes this scenario unique (20-30 words)"
  },
  ...
]

Generate EXACTLY ${count} seeds with maximum diversity. Be creative and specific.`;
}

/**
 * Update tracker with newly generated seeds
 */
export function updateTracker(tracker: DiversityTracker, seeds: ScenarioSeed[]): void {
  for (const seed of seeds) {
    // Track entities
    for (const entity of seed.entities) {
      tracker.usedEntities.add(entity.toLowerCase());
    }
    // Track events (normalized)
    tracker.usedEvents.add(seed.event.toLowerCase().slice(0, 50));
    // Track timeframes
    tracker.usedTimeframes.add(seed.timeframe.toLowerCase());
    // Update subdomain counts
    const count = tracker.subdomainCounts.get(seed.subdomain) || 0;
    tracker.subdomainCounts.set(seed.subdomain, count + 1);
  }
}

/**
 * Validate seed diversity against tracker
 */
export function validateSeedDiversity(seed: ScenarioSeed, tracker: DiversityTracker): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for duplicate entities
  for (const entity of seed.entities) {
    if (tracker.usedEntities.has(entity.toLowerCase())) {
      issues.push(`Duplicate entity: ${entity}`);
    }
  }

  // Check for similar events
  const normalizedEvent = seed.event.toLowerCase().slice(0, 50);
  if (tracker.usedEvents.has(normalizedEvent)) {
    issues.push(`Similar event already used`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get subdomain distribution stats
 */
export function getSubdomainStats(tracker: DiversityTracker): Record<string, number> {
  return Object.fromEntries(tracker.subdomainCounts);
}

/**
 * Seed assignment to buckets
 */
export interface BucketAssignment {
  seed: ScenarioSeed;
  level: 'L1' | 'L2' | 'L3';
  answerType: string;
  specificType: string;
}

/**
 * Assign seeds to buckets based on distribution needs
 */
export function assignSeedsToBuckets(
  seeds: ScenarioSeed[],
  distribution: {
    L1: { count: number; noRatio: number };
    L2: { count: number; noRatio: number };
    L3: { count: number; validRatio: number; invalidRatio: number };
  }
): BucketAssignment[] {
  const assignments: BucketAssignment[] = [];
  let seedIndex = 0;

  // L1 assignments
  const l1NoCount = Math.round(distribution.L1.count * distribution.L1.noRatio);
  const l1YesCount = distribution.L1.count - l1NoCount;

  // L1 WOLF types (W1-W10)
  const wolfTypes = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'];
  for (let i = 0; i < l1NoCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L1',
      answerType: 'NO',
      specificType: wolfTypes[i % wolfTypes.length],
    });
  }

  // L1 SHEEP types (S1-S8)
  const sheepTypes = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
  for (let i = 0; i < l1YesCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L1',
      answerType: 'YES',
      specificType: sheepTypes[i % sheepTypes.length],
    });
  }

  // L2 assignments
  const l2NoCount = Math.round(distribution.L2.count * distribution.L2.noRatio);
  const l2YesCount = distribution.L2.count - l2NoCount;

  // L2 trap types (T1-T17)
  const trapTypes = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
                     'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17'];
  for (let i = 0; i < l2NoCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L2',
      answerType: 'NO',
      specificType: trapTypes[i % trapTypes.length],
    });
  }

  for (let i = 0; i < l2YesCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L2',
      answerType: 'YES',
      specificType: 'valid-intervention',
    });
  }

  // L3 assignments
  const l3ValidCount = Math.round(distribution.L3.count * distribution.L3.validRatio);
  const l3InvalidCount = Math.round(distribution.L3.count * distribution.L3.invalidRatio);
  const l3ConditionalCount = distribution.L3.count - l3ValidCount - l3InvalidCount;

  // L3 families
  const validFamilies = ['F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8'];
  const invalidFamilies = ['F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8'];
  const conditionalFamilies = ['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

  for (let i = 0; i < l3ValidCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L3',
      answerType: 'VALID',
      specificType: validFamilies[i % validFamilies.length],
    });
  }

  for (let i = 0; i < l3InvalidCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L3',
      answerType: 'INVALID',
      specificType: invalidFamilies[i % invalidFamilies.length],
    });
  }

  for (let i = 0; i < l3ConditionalCount && seedIndex < seeds.length; i++) {
    assignments.push({
      seed: seeds[seedIndex++],
      level: 'L3',
      answerType: 'CONDITIONAL',
      specificType: conditionalFamilies[i % conditionalFamilies.length],
    });
  }

  return assignments;
}

/**
 * Parse seeds from LLM response
 */
export function parseSeedsFromResponse(response: string): ScenarioSeed[] {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON array found in response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      console.error('Parsed result is not an array');
      return [];
    }

    return parsed.map((item: Record<string, unknown>, idx: number) => ({
      id: (item.id as string) || `seed-${idx}`,
      topic: (item.topic as string) || '',
      subdomain: (item.subdomain as string) || DOMAIN_MARKETS.subdomains[0],
      entities: Array.isArray(item.entities) ? item.entities as string[] : [],
      timeframe: (item.timeframe as string) || '',
      event: (item.event as string) || '',
      context: (item.context as string) || '',
    }));
  } catch (error) {
    console.error('Failed to parse seeds:', error);
    return [];
  }
}

