/**
 * Import Assignment 1 cases into Assignment 2 format
 * 
 * Converts the old format from combined-causal-questions-2026-01-15.json
 * to our Assignment 2 database schema.
 */

import * as fs from 'fs';
import { prisma } from '@/lib/prisma';

// Trap type mapping from Assignment 1 names to Assignment 2 codes
const TRAP_TYPE_MAPPING: Record<string, string> = {
  // L1 WOLF types
  'CONFOUNDING': 'W7',
  'SELECTION': 'W1',
  'SELECTION_BIAS': 'W1',
  'SURVIVORSHIP': 'W2',
  'SURVIVORSHIP_BIAS': 'W2',
  'HEALTHY_USER': 'W3',
  'HEALTHY_USER_BIAS': 'W3',
  'REGRESSION': 'W4',
  'REGRESSION_TO_MEAN': 'W4',
  'ECOLOGICAL': 'W5',
  'ECOLOGICAL_FALLACY': 'W5',
  'BASE_RATE': 'W6',
  'BASE_RATE_NEGLECT': 'W6',
  'SIMPSONS': 'W8',
  'SIMPSONS_PARADOX': 'W8',
  'REVERSE': 'W9',
  'REVERSE_CAUSATION': 'W9',
  'POST_HOC': 'W10',
  'POST_HOC_FALLACY': 'W10',
  
  // L1 COLLIDER can be W or T depending on level
  'COLLIDER': 'W7', // For L1, treat as confounding family
  
  // L2 trap types
  'T1': 'T1', 'T2': 'T2', 'T3': 'T3', 'T4': 'T4', 'T5': 'T5',
  'T6': 'T6', 'T7': 'T7', 'T8': 'T8', 'T9': 'T9', 'T10': 'T10',
  'T11': 'T11', 'T12': 'T12', 'T13': 'T13', 'T14': 'T14', 'T15': 'T15',
  'T16': 'T16', 'T17': 'T17',
  
  // L3 family types
  'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
  'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
  
  // NONE for SHEEP (YES) cases
  'NONE': 'S1', // Default to S1 for valid causal claims
};

// More specific L2 trap mapping
const L2_TRAP_MAPPING: Record<string, string> = {
  'CONFOUNDING': 'T7',
  'CONFOUNDER': 'T7',
  'SELECTION': 'T1',
  'SURVIVORSHIP': 'T2',
  'COLLIDER': 'T3',
  'IMMORTAL_TIME': 'T4',
  'REGRESSION': 'T5',
  'ECOLOGICAL': 'T6',
  'SIMPSONS': 'T8',
  'CONF_MED': 'T9',
  'REVERSE': 'T10',
  'FEEDBACK': 'T11',
  'TEMPORAL': 'T12',
  'MEASUREMENT': 'T13',
  'RECALL': 'T14',
  'MECHANISM': 'T15',
  'GOODHART': 'T16',
  'BACKFIRE': 'T17',
};

interface Assignment1Case {
  scenario: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
  };
  annotations: {
    caseId: string;
    pearlLevel: string;
    domain: string;
    subdomain: string;
    trapType: string;
    trapSubtype: string;
    difficulty: string;
    causalStructure: string | null;
    keyInsight: string;
    author: string;
  };
  groundTruth: string;
  hiddenTimestamp: string;
  conditionalAnswers: Record<string, string> | string;
  wiseRefusal: string;
  explanation: string;
}

function extractClaim(scenario: string): string {
  // Try to extract claim from scenario text
  const claimMatch = scenario.match(/Claim:\s*["']?([^"'\n]+)["']?/i);
  if (claimMatch) {
    return claimMatch[1].trim();
  }
  
  // Try other patterns
  const quotedMatch = scenario.match(/"([^"]+causes?[^"]+)"/i);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }
  
  // Fallback: generate from variables if we can find them
  return 'Causal claim extracted from scenario';
}

function cleanScenario(scenario: string): string {
  // Remove the claim line from the scenario if present
  return scenario
    .replace(/\n*Claim:\s*["']?[^"'\n]+["']?\n*/gi, '\n')
    .trim();
}

function mapTrapType(trapType: string, pearlLevel: string): string {
  const normalized = trapType.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  
  if (pearlLevel === 'L2') {
    return L2_TRAP_MAPPING[normalized] || TRAP_TYPE_MAPPING[normalized] || 'T7';
  }
  
  return TRAP_TYPE_MAPPING[normalized] || normalized;
}

function normalizeDifficulty(difficulty: string): string {
  const lower = difficulty.toLowerCase();
  if (lower === 'easy') return 'Easy';
  if (lower === 'hard') return 'Hard';
  return 'Medium';
}

function normalizeGroundTruth(groundTruth: string, pearlLevel: string): string {
  const upper = groundTruth.toUpperCase();
  
  if (pearlLevel === 'L3') {
    if (upper === 'YES' || upper === 'VALID') return 'VALID';
    if (upper === 'NO' || upper === 'INVALID') return 'INVALID';
    if (upper === 'AMBIGUOUS' || upper === 'CONDITIONAL') return 'CONDITIONAL';
  }
  
  return upper;
}

function parseConditionalAnswers(answers: Record<string, string> | string): string {
  if (typeof answers === 'string' && answers === 'N/A') {
    return JSON.stringify([null, null]);
  }
  
  if (typeof answers === 'object') {
    const arr = [
      answers.ifScenarioA || answers.answer_if_condition_1 || null,
      answers.ifScenarioB || answers.answer_if_condition_2 || null,
    ];
    return JSON.stringify(arr);
  }
  
  return JSON.stringify([null, null]);
}

async function importCases(inputPath: string) {
  console.log(`Reading cases from ${inputPath}...`);
  
  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(rawData);
  
  const cases: Assignment1Case[] = data.questions || data;
  console.log(`Found ${cases.length} cases to import`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const c of cases) {
    try {
      const pearlLevel = c.annotations?.pearlLevel || 'L1';
      const trapType = mapTrapType(c.annotations?.trapType || 'NONE', pearlLevel);
      const groundTruth = normalizeGroundTruth(c.groundTruth, pearlLevel);
      const claim = extractClaim(c.scenario);
      const scenario = cleanScenario(c.scenario);
      
      // Build variables JSON
      const variables = {
        X: typeof c.variables?.X === 'object' ? c.variables.X : { name: c.variables?.X || 'X', role: 'exposure' },
        Y: typeof c.variables?.Y === 'object' ? c.variables.Y : { name: c.variables?.Y || 'Y', role: 'outcome' },
        Z: c.variables?.Z ? [c.variables.Z] : [],
      };
      
      // Create the question
      await prisma.question.create({
        data: {
          scenario,
          claim,
          pearlLevel,
          domain: c.annotations?.domain || 'Markets',
          subdomain: c.annotations?.subdomain || null,
          trapType: `${trapType}:${c.annotations?.trapSubtype || c.annotations?.trapType || 'Unknown'}`,
          trapSubtype: c.annotations?.trapSubtype || '',
          groundTruth,
          difficulty: normalizeDifficulty(c.annotations?.difficulty || 'medium'),
          variables: JSON.stringify(variables),
          causalStructure: c.annotations?.causalStructure || null,
          keyInsight: c.annotations?.keyInsight || null,
          hiddenTimestamp: c.hiddenTimestamp === 'N/A' ? null : c.hiddenTimestamp,
          conditionalAnswers: parseConditionalAnswers(c.conditionalAnswers),
          wiseRefusal: c.wiseRefusal,
          explanation: c.explanation,
          goldRationale: c.explanation,
          initialAuthor: c.annotations?.author || 'assignment1-import',
          dataset: 'cs372-assignment2',
          validationStatus: 'pending',
          isLLMGenerated: false,
          isVerified: false,
          sourceCase: c.annotations?.caseId || null,
        },
      });
      
      imported++;
      if (imported % 50 === 0) {
        console.log(`  Imported ${imported} cases...`);
      }
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('Unique constraint')) {
        skipped++;
      } else {
        console.error(`Error importing case: ${err.message}`);
        errors++;
      }
    }
  }
  
  console.log('\n=== Import Summary ===');
  console.log(`Total cases: ${cases.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

// Main execution
const inputFile = process.argv[2] || 'data/combined-causal-questions-2026-01-15.json';
importCases(inputFile)
  .then(() => {
    console.log('\nImport complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
