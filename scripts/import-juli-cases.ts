/**
 * Import Juli's cases from the combined JSON file into the database.
 * Sets initialAuthor field and marks them for validation.
 * 
 * Usage: npx tsx scripts/import-juli-cases.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface JsonQuestion {
  scenario: string;
  variables: {
    X: string;
    Y: string;
    Z?: string | string[];
  };
  annotations: {
    caseId: string;
    pearlLevel: string;
    domain: string;
    subdomain?: string;
    trapType: string;
    trapSubtype: string;
    difficulty: string;
    causalStructure?: string | null;
    keyInsight?: string;
    author: string;
  };
  groundTruth: string;
  hiddenTimestamp?: string;
  conditionalAnswers?: {
    ifScenarioA: string;
    ifScenarioB: string;
  } | string;
  wiseRefusal: string;
  explanation: string;
}

interface JsonData {
  questions: JsonQuestion[];
}

async function main() {
  console.log("Starting import of Juli's cases...\n");

  // Load the combined JSON file
  const jsonPath = path.join(__dirname, '..', 'data', 'combined-causal-questions-2026-01-15.json');
  const jsonRaw = fs.readFileSync(jsonPath, 'utf-8');
  const data: JsonData = JSON.parse(jsonRaw);

  // Filter to Juli's cases only with their indices
  const juliCases = data.questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => q.annotations.author === 'julih@stanford.edu');

  console.log(`Found ${juliCases.length} cases from Juli to import.\n`);

  let imported = 0;
  let skipped = 0;

  for (const { q, idx } of juliCases) {
    const caseId = q.annotations.caseId;
    // Use the JSON array index to create unique IDs since caseIds may not be unique
    const existingId = `juli-${idx.toString().padStart(3, '0')}`;

    // Check if already exists
    const existing = await prisma.question.findUnique({
      where: { id: existingId },
    });

    if (existing) {
      console.log(`  ⏭️  Case ${caseId} already exists, skipping.`);
      skipped++;
      continue;
    }

    // Extract claim from scenario (usually the last sentence in quotes)
    const claimMatch = q.scenario.match(/Claim:\s*"([^"]+)"/);
    const claim = claimMatch ? claimMatch[1] : q.scenario.split('\n').pop() || '';

    // Clean scenario (remove claim if embedded)
    // Use a workaround for the 's' flag by replacing with character class
    const scenario = q.scenario.replace(/\n\nClaim:[\s\S]*$/, '').trim();

    // Handle conditional answers - can be object or string
    let conditionalAnswers: string | null = null;
    if (q.conditionalAnswers) {
      if (typeof q.conditionalAnswers === 'object') {
        conditionalAnswers = JSON.stringify(q.conditionalAnswers);
      } else {
        conditionalAnswers = q.conditionalAnswers;
      }
    }

    await prisma.question.create({
      data: {
        id: existingId,
        scenario: scenario,
        claim: claim,
        pearlLevel: q.annotations.pearlLevel,
        domain: q.annotations.domain,
        subdomain: q.annotations.subdomain,
        trapType: q.annotations.trapType,
        trapSubtype: q.annotations.trapSubtype,
        explanation: q.explanation,
        difficulty: q.annotations.difficulty?.toLowerCase() || 'medium',
        groundTruth: q.groundTruth,
        variables: JSON.stringify(q.variables),
        causalStructure: q.annotations.causalStructure || null,
        keyInsight: q.annotations.keyInsight || null,
        wiseRefusal: q.wiseRefusal,
        author: q.annotations.author,
        hiddenTimestamp: q.hiddenTimestamp || null,
        conditionalAnswers: conditionalAnswers,
        isVerified: false,
        isLLMGenerated: true,
        sourceCase: caseId,
        dataset: 'cs372-assignment2',
        // Validation fields
        initialAuthor: 'julih@stanford.edu',
        validationStatus: 'pending',
      },
    });

    console.log(`  ✅ Imported case ${caseId}: ${q.annotations.pearlLevel} - ${q.annotations.trapType}`);
    imported++;
  }

  console.log('\n--- Import Summary ---');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log('Import complete!');
}

main()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

