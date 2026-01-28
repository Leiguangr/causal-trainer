import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Trap type code mappings per revised Assignment 2 spec
const L1_TRAP_CODES: Record<string, { code: string; name: string }> = {
  // WOLF types (W1-W10)
  'SELECTION': { code: 'W1', name: 'Selection Bias' },
  'SELECTION_BIAS': { code: 'W1', name: 'Selection Bias' },
  'SURVIVORSHIP': { code: 'W2', name: 'Survivorship Bias' },
  'SURVIVORSHIP_BIAS': { code: 'W2', name: 'Survivorship Bias' },
  'HEALTHY_USER': { code: 'W3', name: 'Healthy User Bias' },
  'HEALTHY_USER_BIAS': { code: 'W3', name: 'Healthy User Bias' },
  'REGRESSION': { code: 'W4', name: 'Regression to Mean' },
  'REGRESSION_TO_MEAN': { code: 'W4', name: 'Regression to Mean' },
  'ECOLOGICAL': { code: 'W5', name: 'Ecological Fallacy' },
  'ECOLOGICAL_FALLACY': { code: 'W5', name: 'Ecological Fallacy' },
  'BASE_RATE': { code: 'W6', name: 'Base Rate Neglect' },
  'BASE_RATE_NEGLECT': { code: 'W6', name: 'Base Rate Neglect' },
  'CONFOUNDING': { code: 'W7', name: 'Confounding' },
  'CONFOUNDER': { code: 'W7', name: 'Confounding' },
  'SIMPSONS': { code: 'W8', name: "Simpson's Paradox" },
  'SIMPSONS_PARADOX': { code: 'W8', name: "Simpson's Paradox" },
  'REVERSE': { code: 'W9', name: 'Reverse Causation' },
  'REVERSE_CAUSATION': { code: 'W9', name: 'Reverse Causation' },
  'POST_HOC': { code: 'W10', name: 'Post Hoc Fallacy' },
  'POST_HOC_FALLACY': { code: 'W10', name: 'Post Hoc Fallacy' },
  // SHEEP types (S1-S8)
  'RCT': { code: 'S1', name: 'RCT' },
  'NATURAL_EXPERIMENT': { code: 'S2', name: 'Natural Experiment' },
  'LOTTERY': { code: 'S3', name: 'Lottery/Quasi-Random' },
  'QUASI_RANDOM': { code: 'S3', name: 'Lottery/Quasi-Random' },
  'ABLATION': { code: 'S4', name: 'Controlled Ablation' },
  'CONTROLLED_ABLATION': { code: 'S4', name: 'Controlled Ablation' },
  'MECHANISM_DOSE': { code: 'S5', name: 'Mechanism + Dose' },
  'DOSE_RESPONSE': { code: 'S5', name: 'Mechanism + Dose' },
  'INSTRUMENTAL': { code: 'S6', name: 'Instrumental Variable' },
  'INSTRUMENTAL_VARIABLE': { code: 'S6', name: 'Instrumental Variable' },
  'DIFF_IN_DIFF': { code: 'S7', name: 'Diff-in-Diff' },
  'REGRESSION_DISCONTINUITY': { code: 'S8', name: 'Regression Discontinuity' },
  // Ambiguous
  'AMBIGUOUS': { code: 'A', name: 'Ambiguous' },
};

const L2_TRAP_CODES: Record<string, { code: string; name: string; family: string }> = {
  // F1: Selection
  'SELECTION': { code: 'T1', name: 'Selection', family: 'F1' },
  'T1': { code: 'T1', name: 'Selection', family: 'F1' },
  'SURVIVORSHIP': { code: 'T2', name: 'Survivorship', family: 'F1' },
  'T2': { code: 'T2', name: 'Survivorship', family: 'F1' },
  'COLLIDER': { code: 'T3', name: 'Collider', family: 'F1' },
  'T3': { code: 'T3', name: 'Collider', family: 'F1' },
  'IMMORTAL_TIME': { code: 'T4', name: 'Immortal Time', family: 'F1' },
  'T4': { code: 'T4', name: 'Immortal Time', family: 'F1' },
  // F2: Statistical
  'REGRESSION': { code: 'T5', name: 'Regression', family: 'F2' },
  'T5': { code: 'T5', name: 'Regression', family: 'F2' },
  'ECOLOGICAL': { code: 'T6', name: 'Ecological', family: 'F2' },
  'T6': { code: 'T6', name: 'Ecological', family: 'F2' },
  // F3: Confounding
  'CONFOUNDER': { code: 'T7', name: 'Confounder', family: 'F3' },
  'CONFOUNDING': { code: 'T7', name: 'Confounder', family: 'F3' },
  'T7': { code: 'T7', name: 'Confounder', family: 'F3' },
  'SIMPSONS': { code: 'T8', name: "Simpson's", family: 'F3' },
  'T8': { code: 'T8', name: "Simpson's", family: 'F3' },
  'CONF_MED': { code: 'T9', name: 'Conf-Med', family: 'F3' },
  'CONF-MED': { code: 'T9', name: 'Conf-Med', family: 'F3' },
  'T9': { code: 'T9', name: 'Conf-Med', family: 'F3' },
  // F4: Direction
  'REVERSE': { code: 'T10', name: 'Reverse', family: 'F4' },
  'T10': { code: 'T10', name: 'Reverse', family: 'F4' },
  'FEEDBACK': { code: 'T11', name: 'Feedback', family: 'F4' },
  'T11': { code: 'T11', name: 'Feedback', family: 'F4' },
  'TEMPORAL': { code: 'T12', name: 'Temporal', family: 'F4' },
  'T12': { code: 'T12', name: 'Temporal', family: 'F4' },
  // F5: Information
  'MEASUREMENT': { code: 'T13', name: 'Measurement', family: 'F5' },
  'T13': { code: 'T13', name: 'Measurement', family: 'F5' },
  'RECALL': { code: 'T14', name: 'Recall', family: 'F5' },
  'T14': { code: 'T14', name: 'Recall', family: 'F5' },
  // F6: Mechanism
  'MECHANISM': { code: 'T15', name: 'Mechanism', family: 'F6' },
  'T15': { code: 'T15', name: 'Mechanism', family: 'F6' },
  'GOODHART': { code: 'T16', name: 'Goodhart', family: 'F6' },
  'T16': { code: 'T16', name: 'Goodhart', family: 'F6' },
  'BACKFIRE': { code: 'T17', name: 'Backfire', family: 'F6' },
  'T17': { code: 'T17', name: 'Backfire', family: 'F6' },
  // L2 Ambiguous types
  'AMBIG:MECHANISM': { code: 'T15', name: 'Mechanism Ambiguity', family: 'F6' },
  'AMBIG:TIMING': { code: 'T12', name: 'Timing Ambiguity', family: 'F4' },
  'AMBIG:MAGNITUDE': { code: 'T5', name: 'Magnitude Ambiguity', family: 'F2' },
  'AMBIG:STRUCTURE': { code: 'T7', name: 'Structure Ambiguity', family: 'F3' },
};

const L3_TRAP_CODES: Record<string, { code: string; name: string }> = {
  'DETERMINISTIC': { code: 'F1', name: 'Deterministic' },
  'F1': { code: 'F1', name: 'Deterministic' },
  'PROBABILISTIC': { code: 'F2', name: 'Probabilistic' },
  'F2': { code: 'F2', name: 'Probabilistic' },
  'OVERDETERMINATION': { code: 'F3', name: 'Overdetermination' },
  'F3': { code: 'F3', name: 'Overdetermination' },
  'STRUCTURAL': { code: 'F4', name: 'Structural' },
  'F4': { code: 'F4', name: 'Structural' },
  'TEMPORAL': { code: 'F5', name: 'Temporal' },
  'F5': { code: 'F5', name: 'Temporal' },
  'EPISTEMIC': { code: 'F6', name: 'Epistemic' },
  'F6': { code: 'F6', name: 'Epistemic' },
  'ATTRIBUTION': { code: 'F7', name: 'Attribution' },
  'F7': { code: 'F7', name: 'Attribution' },
  'MORAL_LEGAL': { code: 'F8', name: 'Moral/Legal' },
  'MORAL': { code: 'F8', name: 'Moral/Legal' },
  'LEGAL': { code: 'F8', name: 'Moral/Legal' },
  'F8': { code: 'F8', name: 'Moral/Legal' },
};

// Helper to get trap code info based on level and trap type
function getTrapInfo(pearlLevel: string, trapType: string | null, trapSubtype: string | null): {
  type: string | null;
  type_name: string | null;
  subtype: string | null;
  subtype_name: string | null;
} {
  if (!trapType) return { type: null, type_name: null, subtype: null, subtype_name: null };

  // DB format is "CODE:NAME" (e.g., "S8:Regression Discontinuity", "T8:SIMPSON'S", "F1:Deterministic")
  // Parse out the code and name
  let code: string | null = null;
  let name: string | null = null;

  if (trapType.includes(':')) {
    const [parsedCode, ...nameParts] = trapType.split(':');
    code = parsedCode.trim();
    const rawName = nameParts.join(':').trim(); // Rejoin in case name has colons
    
    // Look up canonical name from mapping tables for consistency
    if (pearlLevel === 'L1') {
      const info = L1_TRAP_CODES[code];
      name = info?.name || rawName;
    } else if (pearlLevel === 'L2') {
      const info = L2_TRAP_CODES[code];
      name = info?.name || rawName;
    } else if (pearlLevel === 'L3') {
      const info = L3_TRAP_CODES[code];
      name = info?.name || rawName;
    } else {
      name = rawName;
    }
  } else {
    // Fallback: try to look up in mapping tables
    const normalizedType = trapType.toUpperCase().replace(/[- ]/g, '_');
    
    if (pearlLevel === 'L1') {
      const info = L1_TRAP_CODES[normalizedType] || L1_TRAP_CODES[trapType];
      if (info) {
        code = info.code;
        name = info.name;
      }
    } else if (pearlLevel === 'L2') {
      const info = L2_TRAP_CODES[normalizedType] || L2_TRAP_CODES[trapType];
      if (info) {
        code = info.code;
        name = info.name;
      }
    } else if (pearlLevel === 'L3') {
      const info = L3_TRAP_CODES[normalizedType] || L3_TRAP_CODES[trapType];
      if (info) {
        code = info.code;
        name = info.name;
      }
    }
    
    // If still not found, use trapType as both
    if (!code) {
      code = trapType;
      name = trapType;
    }
  }

  // Format subtype - use trapSubtype, convert underscores to spaces for subtype_name
  const subtypeCode = trapSubtype ? trapSubtype.replace(/ /g, '_') : null;
  const subtypeName = trapSubtype ? trapSubtype.replace(/_/g, ' ') : null;

  return {
    type: code,
    type_name: name,
    subtype: subtypeCode,
    subtype_name: subtypeName,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileType = searchParams.get('type') || 'dataset'; // schema, scores, dataset

    // Fetch all questions in the cs372-assignment2 dataset
    const questions = await prisma.question.findMany({
      where: { dataset: 'cs372-assignment2' },
      orderBy: [{ pearlLevel: 'asc' }, { createdAt: 'asc' }],
    });

    const dateStr = new Date().toISOString().split('T')[0];

    if (fileType === 'schema') {
      // Export JSON Schema definition for the T3 dataset (matching revised Assignment 2 spec)
      const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "T3 Causal Reasoning Benchmark Schema",
        "description": "Schema for CS372 Assignment 2 (Revised) - Causal Reasoning Validation Dataset",
        "version": "3.0.0",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique case identifier (e.g., T3-BucketLarge-G-1.1)"
          },
          "case_id": {
            "type": "string",
            "description": "Case reference ID from original benchmark (e.g., 1.1)"
          },
          "bucket": {
            "type": "string",
            "description": "Bucket identifier (e.g., BucketLarge-G)"
          },
          "pearl_level": {
            "type": "string",
            "enum": ["L1", "L2", "L3"],
            "description": "Pearl's causal hierarchy level"
          },
          "domain": {
            "type": "string",
            "description": "Domain area (e.g., Markets, Economics)"
          },
          "subdomain": {
            "type": ["string", "null"],
            "description": "More specific subdomain"
          },
          "scenario": {
            "type": "string",
            "description": "Description of the situation or problem (1-3 sentences)"
          },
          "claim": {
            "type": "string",
            "description": "The causal claim being evaluated"
          },
          "label": {
            "type": "string",
            "enum": ["YES", "NO", "AMBIGUOUS", "VALID", "INVALID", "CONDITIONAL"],
            "description": "Case label (L1: YES/NO/AMBIGUOUS, L2: NO, L3: VALID/INVALID/CONDITIONAL)"
          },
          "is_ambiguous": {
            "type": "boolean",
            "description": "Whether the case is ambiguous"
          },
          "variables": {
            "type": "object",
            "description": "Variables object with X, Y, Z structure",
            "properties": {
              "X": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "name": { "type": "string" }, "role": { "type": "string" } } }], "description": "Exposure/treatment/predictor variable" },
              "Y": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "name": { "type": "string" }, "role": { "type": "string" } } }], "description": "Outcome variable" },
              "Z": { "type": "array", "items": { "type": "string" }, "description": "Confounders, mediators, colliders, or mechanisms (MUST be array)" }
            }
          },
          "trap": {
            "type": "object",
            "description": "Trap type information",
            "properties": {
              "type": { "type": ["string", "null"], "description": "Trap type code (L1: W1-W10/S1-S8/A, L2: T1-T17, L3: F1-F8)" },
              "type_name": { "type": ["string", "null"], "description": "Human-readable trap type name" },
              "subtype": { "type": ["string", "null"], "description": "Trap subtype code" },
              "subtype_name": { "type": ["string", "null"], "description": "Human-readable subtype name" }
            }
          },
          "difficulty": { "type": "string", "enum": ["Easy", "Medium", "Hard"], "description": "Difficulty level" },
          "causal_structure": { "type": ["string", "null"], "description": "Description of the causal graph structure" },
          "key_insight": { "type": ["string", "null"], "description": "One-line memorable takeaway" },
          "hidden_timestamp": { "type": ["string", "object", "null"], "description": "Question that reveals temporal/causal ordering" },
          "conditional_answers": {
            "type": ["object", "array", "null"],
            "description": "Conditional answers for different scenarios",
            "properties": {
              "answer_if_condition_1": { "type": "string" },
              "answer_if_condition_2": { "type": "string" }
            }
          },
          "wise_refusal": { "type": ["string", "null"], "description": "Response identifying missing information or biases" },
          "gold_rationale": { "type": ["string", "null"], "description": "Complete explanation of the correct reasoning" },
          "initial_author": { "type": "string", "description": "Student who created the case" },
          "validator": { "type": ["string", "null"], "description": "Student who validated the case" },
          "final_score": { "type": ["number", "null"], "minimum": 0, "maximum": 10, "description": "Quality score (0-10)" }
        },
        "required": ["id", "case_id", "bucket", "pearl_level", "domain", "scenario", "claim", "label", "is_ambiguous", "variables", "trap", "difficulty", "initial_author", "validator", "final_score"]
      };

      return new NextResponse(JSON.stringify(schema, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="cs372-schema-${dateStr}.json"`,
        },
      });
    }

    if (fileType === 'scores') {
      // Export validation scores as CSV
      const csvLines = [
        'caseId,pearlLevel,groundTruth,initialAuthor,validator,validationStatus,scenarioClarityScore,hiddenQuestionScore,conditionalAnswerAScore,conditionalAnswerBScore,wiseRefusalScore,difficultyCalibrationScore,finalScore,validatorNotes'
      ];
      
      for (const q of questions) {
        const row = [
          q.sourceCase || q.id,
          q.pearlLevel,
          q.groundTruth,
          q.initialAuthor || '',
          q.validator || '',
          q.validationStatus,
          q.scenarioClarityScore?.toString() || '',
          q.hiddenQuestionScore?.toString() || '',
          q.conditionalAnswerAScore?.toString() || '',
          q.conditionalAnswerBScore?.toString() || '',
          q.wiseRefusalScore?.toString() || '',
          q.difficultyCalibrationScore?.toString() || '',
          q.finalScore?.toString() || '',
          (q.validatorNotes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        ];
        csvLines.push(row.join(','));
      }

      return new NextResponse(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="cs372-scores-${dateStr}.csv"`,
        },
      });
    }

    // Default: Export dataset
    // Use 'all' param to export all cases, otherwise only approved
    const exportAll = searchParams.get('all') === 'true';
    const exportQuestions = exportAll
      ? questions
      : questions.filter(q => q.validationStatus === 'approved');

    // Generate case IDs with proper bucket naming (per revised spec)
    let caseCounter = 1;

    const datasetExport = exportQuestions.map((q) => {
      let variables, conditionalAnswers;
      try { variables = q.variables ? JSON.parse(q.variables) : null; } catch { variables = null; }
      try { conditionalAnswers = q.conditionalAnswers ? JSON.parse(q.conditionalAnswers) : null; } catch { conditionalAnswers = null; }

      // Generate bucket based on group (Markets = Group G)
      const bucket = 'BucketLarge-G';

      // Generate case_id (e.g., "1.1", "1.2", etc.)
      const caseIdNum = q.sourceCase || `${caseCounter}.1`;
      caseCounter++;

      // Generate full ID (e.g., "T3-BucketLarge-G-1.1")
      const fullId = `T3-${bucket}-${caseIdNum}`;

      // Map groundTruth to label based on Pearl level (per revised spec Table 10)
      // L1: YES, NO, AMBIGUOUS
      // L2: NO (all cases)
      // L3: VALID, INVALID, CONDITIONAL
      let label = q.groundTruth;

      if (q.pearlLevel === 'L2') {
        // All L2 cases must be labeled "NO" per revised spec
        label = 'NO';
      } else if (q.pearlLevel === 'L3') {
        // L3 uses VALID/INVALID/CONDITIONAL instead of YES/NO/AMBIGUOUS
        if (label === 'YES') {
          label = 'VALID';
        } else if (label === 'NO') {
          label = 'INVALID';
        } else if (label === 'AMBIGUOUS') {
          label = 'CONDITIONAL';
        }
        // If already VALID/INVALID/CONDITIONAL, keep as-is
      }

      // Determine if ambiguous based on label
      const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';

      // Format variables - per revised spec:
      // - X and Y should be objects with 'name' and 'role' fields
      // - Z MUST be an array
      // - L3 cases may have X' (counterfactual)
      let formattedVariables: Record<string, unknown> | null = null;
      if (variables) {
        // Z must always be an array
        let zArray: string[] = [];
        if (variables.Z) {
          if (Array.isArray(variables.Z)) {
            zArray = variables.Z;
          } else {
            zArray = [variables.Z];
          }
        }

        // Format X as object with name and role
        const formatVar = (val: unknown, role: string) => {
          if (!val) return null;
          if (typeof val === 'object' && val !== null && 'name' in val) {
            return val; // Already in object format
          }
          return {
            name: String(val),
            role: role
          };
        };

        formattedVariables = {
          X: formatVar(variables.X, 'exposure'),
          Y: formatVar(variables.Y, 'outcome'),
          Z: zArray
        };

        // Add X' for L3 counterfactual cases if present
        if (q.pearlLevel === 'L3' && variables["X'"]) {
          formattedVariables["X'"] = variables["X'"];
        }
      }

      // Get trap info with proper codes
      const trapInfo = getTrapInfo(q.pearlLevel, q.trapType, q.trapSubtype);

      // Build the export object matching revised Assignment 2 spec
      const exportCase: Record<string, unknown> = {
        // Core identifiers
        id: fullId,
        case_id: caseIdNum,
        bucket: bucket,
        pearl_level: q.pearlLevel,
        domain: q.domain,
        subdomain: q.subdomain || null,

        // Content
        scenario: q.scenario,
        claim: q.claim,

        // Label and ambiguity
        label: label,
        is_ambiguous: isAmbiguous,

        // Variables with Z as array (required by revised spec)
        variables: formattedVariables,

        // Trap with type codes and names (revised spec)
        trap: {
          type: trapInfo.type,
          type_name: trapInfo.type_name,
          subtype: trapInfo.subtype,
          subtype_name: trapInfo.subtype_name
        },

        // Difficulty (capitalize first letter)
        difficulty: q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1).toLowerCase() : 'Medium',

        // Causal structure and key insight (all levels per revised spec)
        causal_structure: q.causalStructure || null,
        key_insight: q.keyInsight || null,

        // Hidden timestamp and conditional answers
        hidden_timestamp: q.hiddenTimestamp || null,
        conditional_answers: conditionalAnswers ? {
          answer_if_condition_1: Array.isArray(conditionalAnswers) ? conditionalAnswers[0] : conditionalAnswers.answer_if_condition_1 || null,
          answer_if_condition_2: Array.isArray(conditionalAnswers) ? conditionalAnswers[1] : conditionalAnswers.answer_if_condition_2 || null
        } : null,

        // Wise refusal and gold rationale
        wise_refusal: q.wiseRefusal || null,
        gold_rationale: q.explanation || q.wiseRefusal || null,

        // Assignment 2 required fields
        initial_author: q.initialAuthor || q.author || 'Unknown',
        validator: q.validator || null,
        final_score: q.finalScore || null
      };

      return exportCase;
    });

    // Export as array of cases (no metadata wrapper for cleaner format)
    return new NextResponse(JSON.stringify(datasetExport, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cs372-dataset-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error('CS372 export error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

