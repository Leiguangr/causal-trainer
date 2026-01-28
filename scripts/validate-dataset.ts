#!/usr/bin/env npx ts-node

/**
 * T³ Dataset Validator
 * 
 * Validates a dataset JSON file against the T³ benchmark schema.
 * 
 * Usage:
 *   npx ts-node scripts/validate-dataset.ts <dataset.json>
 *   npx ts-node scripts/validate-dataset.ts data/my-dataset.json
 * 
 * The validator checks:
 *   1. JSON Schema compliance (field types, required fields)
 *   2. Pearl level + label consistency (L2 must be NO, L3 uses VALID/INVALID/CONDITIONAL)
 *   3. Ambiguous case requirements (hidden_timestamp, conditional_answers)
 *   4. Minimum case count (170 required)
 *   5. Quality score thresholds
 */

import * as fs from 'fs';
import * as path from 'path';

// ============== Type Definitions ==============

interface Variable {
  name?: string;
  role?: string;
}

interface Variables {
  X: string | Variable;
  Y: string | Variable;
  Z: string[];
  "X'"?: string | Variable;
}

interface Trap {
  type: string | null;
  type_name: string | null;
  subtype: string | null;
  subtype_name: string | null;
}

interface ConditionalAnswers {
  answer_if_condition_1: string | null;
  answer_if_condition_2: string | null;
}

interface Case {
  id: string;
  case_id: string;
  bucket: string;
  pearl_level: string;
  domain: string;
  subdomain: string | null;
  scenario: string;
  claim: string;
  label: string;
  is_ambiguous: boolean;
  variables: Variables;
  trap: Trap;
  difficulty: string;
  causal_structure: string | null;
  key_insight: string | null;
  hidden_timestamp: string | null;
  conditional_answers: ConditionalAnswers | null;
  wise_refusal: string | null;
  gold_rationale: string | null;
  initial_author: string;
  validator: string | null;
  final_score: number | null;
}

interface ValidationError {
  caseId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============== Validation Constants ==============

const VALID_PEARL_LEVELS = ['L1', 'L2', 'L3'];
const VALID_L1_LABELS = ['YES', 'NO', 'AMBIGUOUS'];
const VALID_L2_LABELS = ['NO'];
const VALID_L3_LABELS = ['VALID', 'INVALID', 'CONDITIONAL'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const L1_TRAP_TYPES = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'A', 'NONE', null];
const L2_TRAP_TYPES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', null];
const L3_FAMILIES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'NONE', null];

const REQUIRED_FIELDS = [
  'id', 'case_id', 'bucket', 'pearl_level', 'domain', 'scenario', 'claim',
  'label', 'is_ambiguous', 'variables', 'trap', 'difficulty',
  'initial_author', 'validator', 'final_score'
];

const MIN_CASE_COUNT = 170;
const MIN_ACCEPT_SCORE = 8;
const MIN_REVISE_SCORE = 6;

// ============== Validation Functions ==============

function validateCase(c: Case, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const caseId = c.id || `case[${index}]`;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in c) || c[field as keyof Case] === undefined) {
      errors.push({
        caseId,
        field,
        message: `Missing required field: ${field}`,
        severity: 'error'
      });
    }
  }

  // Validate pearl_level
  if (c.pearl_level && !VALID_PEARL_LEVELS.includes(c.pearl_level)) {
    errors.push({
      caseId,
      field: 'pearl_level',
      message: `Invalid pearl_level: "${c.pearl_level}". Must be one of: ${VALID_PEARL_LEVELS.join(', ')}`,
      severity: 'error'
    });
  }

  // Validate label consistency with pearl_level
  if (c.pearl_level === 'L1' && c.label && !VALID_L1_LABELS.includes(c.label)) {
    errors.push({
      caseId,
      field: 'label',
      message: `L1 case has invalid label: "${c.label}". Must be one of: ${VALID_L1_LABELS.join(', ')}`,
      severity: 'error'
    });
  }

  if (c.pearl_level === 'L2' && c.label !== 'NO') {
    errors.push({
      caseId,
      field: 'label',
      message: `L2 case MUST have label "NO", but found: "${c.label}"`,
      severity: 'error'
    });
  }

  if (c.pearl_level === 'L3' && c.label && !VALID_L3_LABELS.includes(c.label)) {
    errors.push({
      caseId,
      field: 'label',
      message: `L3 case has invalid label: "${c.label}". Must be one of: ${VALID_L3_LABELS.join(', ')}`,
      severity: 'error'
    });
  }

  // Validate difficulty
  if (c.difficulty && !VALID_DIFFICULTIES.includes(c.difficulty)) {
    errors.push({
      caseId,
      field: 'difficulty',
      message: `Invalid difficulty: "${c.difficulty}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
      severity: 'warning'
    });
  }

  // Validate is_ambiguous consistency
  const isAmbiguousLabel = c.label === 'AMBIGUOUS' || c.label === 'CONDITIONAL';
  if (c.is_ambiguous !== isAmbiguousLabel) {
    errors.push({
      caseId,
      field: 'is_ambiguous',
      message: `is_ambiguous (${c.is_ambiguous}) does not match label "${c.label}". Should be ${isAmbiguousLabel}`,
      severity: 'error'
    });
  }

  // Validate ambiguous cases have required fields
  if (c.is_ambiguous) {
    if (!c.hidden_timestamp || c.hidden_timestamp === 'N/A') {
      errors.push({
        caseId,
        field: 'hidden_timestamp',
        message: 'Ambiguous/Conditional cases must have a hidden_timestamp question',
        severity: 'error'
      });
    }
    if (!c.conditional_answers) {
      errors.push({
        caseId,
        field: 'conditional_answers',
        message: 'Ambiguous/Conditional cases must have conditional_answers',
        severity: 'error'
      });
    }
  }

  // Validate variables structure
  if (c.variables) {
    if (!c.variables.X) {
      errors.push({ caseId, field: 'variables.X', message: 'Missing variable X', severity: 'error' });
    }
    if (!c.variables.Y) {
      errors.push({ caseId, field: 'variables.Y', message: 'Missing variable Y', severity: 'error' });
    }
    if (!Array.isArray(c.variables.Z)) {
      errors.push({ caseId, field: 'variables.Z', message: 'Variable Z must be an array', severity: 'error' });
    }
  }

  // Validate trap type based on pearl level
  if (c.trap && c.trap.type) {
    if (c.pearl_level === 'L1' && !L1_TRAP_TYPES.includes(c.trap.type)) {
      errors.push({
        caseId,
        field: 'trap.type',
        message: `L1 trap type "${c.trap.type}" not in valid set: ${L1_TRAP_TYPES.filter(t => t).join(', ')}`,
        severity: 'warning'
      });
    }
    if (c.pearl_level === 'L2' && !L2_TRAP_TYPES.includes(c.trap.type)) {
      errors.push({
        caseId,
        field: 'trap.type',
        message: `L2 trap type "${c.trap.type}" not in valid set: ${L2_TRAP_TYPES.filter(t => t).join(', ')}`,
        severity: 'warning'
      });
    }
    if (c.pearl_level === 'L3' && !L3_FAMILIES.includes(c.trap.type)) {
      errors.push({
        caseId,
        field: 'trap.type',
        message: `L3 family "${c.trap.type}" not in valid set: ${L3_FAMILIES.filter(t => t).join(', ')}`,
        severity: 'warning'
      });
    }
  }

  // Validate scenario length (only check minimum)
  if (c.scenario) {
    if (c.scenario.length < 50) {
      errors.push({
        caseId,
        field: 'scenario',
        message: `Scenario too short (${c.scenario.length} chars). Recommend at least 50 characters.`,
        severity: 'warning'
      });
    }
  }

  // Validate final_score
  if (c.final_score !== null && c.final_score !== undefined) {
    if (c.final_score < 0 || c.final_score > 10) {
      errors.push({
        caseId,
        field: 'final_score',
        message: `final_score ${c.final_score} out of valid range [0-10]`,
        severity: 'error'
      });
    }
    if (c.final_score < MIN_REVISE_SCORE) {
      errors.push({
        caseId,
        field: 'final_score',
        message: `final_score ${c.final_score} is below rejection threshold (${MIN_REVISE_SCORE})`,
        severity: 'warning'
      });
    }
  }

  // Validate id format
  if (c.id && !/^T3-BucketLarge-[A-Z]-[0-9]+\.[0-9]+$/.test(c.id)) {
    errors.push({
      caseId,
      field: 'id',
      message: `ID "${c.id}" does not match expected format: T3-BucketLarge-{Letter}-{num}.{num}`,
      severity: 'warning'
    });
  }

  // Validate wise_refusal for non-ambiguous cases
  if (!c.is_ambiguous && !c.wise_refusal) {
    errors.push({
      caseId,
      field: 'wise_refusal',
      message: 'Missing wise_refusal',
      severity: 'warning'
    });
  }

  return errors;
}

function validateDataset(cases: Case[]): { errors: ValidationError[]; stats: Record<string, unknown> } {
  const allErrors: ValidationError[] = [];
  
  // Validate each case
  cases.forEach((c, index) => {
    const caseErrors = validateCase(c, index);
    allErrors.push(...caseErrors);
  });

  // Check minimum case count
  if (cases.length < MIN_CASE_COUNT) {
    allErrors.push({
      caseId: 'dataset',
      field: 'count',
      message: `Dataset has ${cases.length} cases, but minimum required is ${MIN_CASE_COUNT}`,
      severity: 'error'
    });
  }

  // Check for duplicate IDs
  const ids = cases.map(c => c.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    allErrors.push({
      caseId: 'dataset',
      field: 'id',
      message: `Duplicate IDs found: ${[...new Set(duplicates)].join(', ')}`,
      severity: 'error'
    });
  }

  // Compute statistics
  const stats = {
    total_cases: cases.length,
    by_pearl_level: {
      L1: cases.filter(c => c.pearl_level === 'L1').length,
      L2: cases.filter(c => c.pearl_level === 'L2').length,
      L3: cases.filter(c => c.pearl_level === 'L3').length,
    },
    by_label: {
      YES: cases.filter(c => c.label === 'YES').length,
      NO: cases.filter(c => c.label === 'NO').length,
      AMBIGUOUS: cases.filter(c => c.label === 'AMBIGUOUS').length,
      VALID: cases.filter(c => c.label === 'VALID').length,
      INVALID: cases.filter(c => c.label === 'INVALID').length,
      CONDITIONAL: cases.filter(c => c.label === 'CONDITIONAL').length,
    },
    by_difficulty: {
      Easy: cases.filter(c => c.difficulty === 'Easy').length,
      Medium: cases.filter(c => c.difficulty === 'Medium').length,
      Hard: cases.filter(c => c.difficulty === 'Hard').length,
    },
    ambiguous_cases: cases.filter(c => c.is_ambiguous).length,
    score_distribution: {
      accepted: cases.filter(c => c.final_score !== null && c.final_score >= MIN_ACCEPT_SCORE).length,
      needs_revision: cases.filter(c => c.final_score !== null && c.final_score >= MIN_REVISE_SCORE && c.final_score < MIN_ACCEPT_SCORE).length,
      rejected: cases.filter(c => c.final_score !== null && c.final_score < MIN_REVISE_SCORE).length,
      unscored: cases.filter(c => c.final_score === null).length,
    },
    avg_score: cases.filter(c => c.final_score !== null).length > 0
      ? (cases.filter(c => c.final_score !== null).reduce((sum, c) => sum + (c.final_score || 0), 0) / cases.filter(c => c.final_score !== null).length).toFixed(2)
      : 'N/A',
    unique_authors: [...new Set(cases.map(c => c.initial_author))].length,
    unique_validators: [...new Set(cases.map(c => c.validator).filter(v => v))].length,
  };

  return { errors: allErrors, stats };
}

// ============== Main ==============

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('T³ Dataset Validator');
    console.log('====================\n');
    console.log('Usage: npx ts-node scripts/validate-dataset.ts <dataset.json>\n');
    console.log('Example: npx ts-node scripts/validate-dataset.ts data/my-dataset.json\n');
    process.exit(0);
  }

  const inputPath = args[0];
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('T³ Dataset Validator');
  console.log('====================\n');
  console.log(`Validating: ${resolvedPath}\n`);

  let data: Case[];
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      console.error('Error: Dataset must be a JSON array of cases');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error parsing JSON: ${err}`);
    process.exit(1);
  }

  const { errors, stats } = validateDataset(data);

  // Print statistics
  console.log('📊 Dataset Statistics');
  console.log('---------------------');
  console.log(`Total cases: ${stats.total_cases}`);
  console.log(`By Pearl level: L1=${(stats.by_pearl_level as Record<string, number>).L1}, L2=${(stats.by_pearl_level as Record<string, number>).L2}, L3=${(stats.by_pearl_level as Record<string, number>).L3}`);
  console.log(`By difficulty: Easy=${(stats.by_difficulty as Record<string, number>).Easy}, Medium=${(stats.by_difficulty as Record<string, number>).Medium}, Hard=${(stats.by_difficulty as Record<string, number>).Hard}`);
  console.log(`Ambiguous cases: ${stats.ambiguous_cases}`);
  console.log(`Average score: ${stats.avg_score}`);
  console.log(`Score distribution: Accepted=${(stats.score_distribution as Record<string, number>).accepted}, Needs revision=${(stats.score_distribution as Record<string, number>).needs_revision}, Rejected=${(stats.score_distribution as Record<string, number>).rejected}, Unscored=${(stats.score_distribution as Record<string, number>).unscored}`);
  console.log(`Unique authors: ${stats.unique_authors}`);
  console.log(`Unique validators: ${stats.unique_validators}`);
  console.log();

  // Print errors
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  if (errors.length === 0) {
    console.log('✅ Validation PASSED - No issues found!\n');
  } else {
    console.log(`⚠️  Validation completed with ${errorCount} error(s) and ${warningCount} warning(s)\n`);

    if (errorCount > 0) {
      console.log('❌ ERRORS (must fix):');
      console.log('---------------------');
      errors.filter(e => e.severity === 'error').forEach(e => {
        console.log(`  [${e.caseId}] ${e.field}: ${e.message}`);
      });
      console.log();
    }

    if (warningCount > 0) {
      console.log('⚠️  WARNINGS (should review):');
      console.log('-----------------------------');
      errors.filter(e => e.severity === 'warning').slice(0, 20).forEach(e => {
        console.log(`  [${e.caseId}] ${e.field}: ${e.message}`);
      });
      if (warningCount > 20) {
        console.log(`  ... and ${warningCount - 20} more warnings`);
      }
      console.log();
    }
  }

  // Final verdict
  if (errorCount > 0) {
    console.log('❌ VALIDATION FAILED - Please fix errors before submission.');
    process.exit(1);
  } else if ((stats.total_cases as number) < MIN_CASE_COUNT) {
    console.log(`⚠️  VALIDATION WARNING - Dataset has fewer than ${MIN_CASE_COUNT} cases.`);
    process.exit(0);
  } else {
    console.log('✅ VALIDATION PASSED - Dataset is ready for submission!');
    process.exit(0);
  }
}

main();
