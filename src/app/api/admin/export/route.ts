import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Clean a scenario by removing explicit trap hints using LLM
async function cleanScenarioForEval(scenario: string, trapType: string): Promise<string> {
  const prompt = `You are helping prepare a causal reasoning evaluation dataset. The following scenario may contain explicit hints about the causal trap (${trapType}) that need to be removed so test-takers must identify the flaw themselves.

ORIGINAL SCENARIO:
${scenario}

TASK: Rewrite this scenario with MINIMAL changes to:
1. REMOVE ONLY meta-language that explicitly names or describes the analytical mistake:
   - Remove: "is mistakenly treated as", "incorrectly assumes", "fails to account for", "is wrongly identified as"
   - Remove: explicit labels like "Z is a confounder", "the mediator Z", "conditioning on the collider"

2. PRESERVE EVERYTHING ELSE - this is critical:
   - KEEP all factual information exactly as stated (numbers, percentages, timeframes, sample sizes)
   - KEEP all causal relationships described in the scenario
   - KEEP all variables and their descriptions
   - KEEP the inline variable notation (X), (Y), (Z) exactly as they appear
   - KEEP the sentence structure where possible
   - KEEP any study design details (RCT, observational, etc.)

3. DO NOT:
   - Add any new information
   - Remove factual details that reveal the trap through the data pattern (this is fine - experts should infer from data)
   - Change the meaning or implications of any statement
   - Alter numbers, statistics, or quantitative claims
   - Remove information that would change whether the claim is valid/invalid

The goal is to remove ONLY the "answer key" language while preserving the full factual scenario.
If the scenario has no explicit trap hints, return it unchanged.

Return ONLY the cleaned scenario text, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || scenario;
  } catch (error) {
    console.error('Error cleaning scenario:', error);
    return scenario; // Return original if cleaning fails
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pearlLevels = searchParams.get('pearlLevels')?.split(',') || [];
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const cleanForEval = searchParams.get('cleanForEval') === 'true';
    const format = searchParams.get('format') || 'json';
    const dataset = searchParams.get('dataset');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (pearlLevels.length > 0 && !pearlLevels.includes('all')) {
      where.pearl_level = { in: pearlLevels };
    }
    if (verifiedOnly) {
      where.is_verified = true;
    }
    if (dataset && dataset !== 'all') {
      where.dataset = dataset;
    }

    const wantsAll = pearlLevels.length === 0 || pearlLevels.includes('all');
    const wantsL1 = wantsAll || pearlLevels.includes('L1');
    const wantsL2 = wantsAll || pearlLevels.includes('L2');
    const wantsL3 = wantsAll || pearlLevels.includes('L3');

    // Fetch legacy questions for L2/L3 (and legacy L1 if explicitly requested)
    const questionWhere: Record<string, unknown> = { ...where };
    if (!wantsAll) {
      const allowed: string[] = [];
      if (wantsL2) allowed.push('L2');
      if (wantsL3) allowed.push('L3');
      // Keep legacy L1 export if user explicitly included L1 (for backward compatibility)
      if (wantsL1) allowed.push('L1');
      questionWhere.pearl_level = { in: allowed };
    }

    // Determine which sources to include
    const includeLegacy = searchParams.get('includeLegacy') !== 'false';
    const includeT3 = searchParams.get('includeT3') !== 'false';

    // Build T3Case where clause
    const t3Where: Record<string, unknown> = {};
    if (verifiedOnly) {
      t3Where.is_verified = true;
    }
    if (dataset && dataset !== 'all') {
      t3Where.dataset = dataset;
    }
    if (!wantsAll) {
      const allowedLevels: string[] = [];
      if (wantsL1) allowedLevels.push('L1');
      if (wantsL2) allowedLevels.push('L2');
      if (wantsL3) allowedLevels.push('L3');
      if (allowedLevels.length > 0) {
        t3Where.pearl_level = { in: allowedLevels };
      }
    }

    const [questions, t3Cases] = await Promise.all([
      // Legacy Question table (only if includeLegacy is true)
      includeLegacy
        ? prisma.question.findMany({
            where: questionWhere,
            orderBy: [{ pearl_level: 'asc' }, { source_case: 'asc' }],
          })
        : Promise.resolve([]),
      // Unified T3Case table (only if includeT3 is true)
      includeT3
        ? prisma.t3Case.findMany({
            where: t3Where,
            orderBy: [{ pearl_level: 'asc' }, { source_case: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    // Count by level
    const distribution = {
      L1:
        (includeLegacy ? questions.filter((q: { pearl_level: string }) => q.pearl_level === 'L1').length : 0) +
        (includeT3 ? t3Cases.filter((c: { pearl_level: string }) => c.pearl_level === 'L1').length : 0),
      L2:
        (includeLegacy ? questions.filter((q: { pearl_level: string }) => q.pearl_level === 'L2').length : 0) +
        (includeT3 ? t3Cases.filter((c: { pearl_level: string }) => c.pearl_level === 'L2').length : 0),
      L3:
        (includeLegacy ? questions.filter((q: { pearl_level: string }) => q.pearl_level === 'L3').length : 0) +
        (includeT3 ? t3Cases.filter((c: { pearl_level: string }) => c.pearl_level === 'L3').length : 0),
    };

    // Map T3Case rows into unified export format (Table 9 schema) - already in snake_case
    const t3Exports = t3Cases.map((c: any) => {
      // Parse variables (JSON string to object)
      let variables: unknown = null;
      try {
        variables = c.variables ? JSON.parse(c.variables) : null;
      } catch {
        variables = c.variables;
      }

      // Parse conditional answers
      let conditional_answers: unknown = null;
      try {
        conditional_answers = c.conditional_answers ? JSON.parse(c.conditional_answers) : null;
      } catch {
        conditional_answers = c.conditional_answers;
      }

      // Parse invariants (L3 only)
      let invariants: unknown = null;
      if (c.pearl_level === 'L3' && c.invariants) {
        try {
          invariants = JSON.parse(c.invariants);
        } catch {
          invariants = c.invariants;
        }
      }

      // Parse hidden timestamp
      let hidden_timestamp: unknown = null;
      if (c.hidden_timestamp) {
        try {
          hidden_timestamp = JSON.parse(c.hidden_timestamp);
        } catch {
          hidden_timestamp = c.hidden_timestamp;
        }
      }

      // Build trap object
      const trap = {
        type: c.trap_type,
        type_name: c.trap_type_name || null,
        subtype: c.trap_subtype || null,
        subtype_name: c.trap_subtype_name || null,
      };

      // Base export structure matching Table 9 (snake_case)
      const baseExport: any = {
        // Identity & Metadata (Table 9)
        id: c.case_id || c.id,
        case_id: c.case_id || null,
        bucket: c.bucket || null,
        pearl_level: c.pearl_level,
        domain: c.domain || null,
        subdomain: c.subdomain || null,

        // Case Content (Table 9)
        scenario: c.scenario,
        claim: c.claim || null,
        counterfactual_claim: c.counterfactual_claim || null,
        label: c.label,
        is_ambiguous: c.is_ambiguous,

        // Variables (Table 9)
        variables,

        // Trap Structure (Table 9)
        trap,

        // Reasoning Fields (Table 9)
        difficulty: c.difficulty,
        causal_structure: c.causal_structure || null,
        key_insight: c.key_insight || null,

        // Ambiguity Handling (Table 9)
        hidden_timestamp,
        conditional_answers,

        // Explanations (Table 9)
        wise_refusal: c.wise_refusal || null,
        gold_rationale: c.gold_rationale || null,

        // L3-Specific
        invariants: c.pearl_level === 'L3' ? invariants : null,

        // Assignment 2 Fields (Table 9)
        initial_author: c.initial_author || null,
        validator: c.validator || null,
        final_score: c.final_score || null,

        // Metadata
        dataset: c.dataset,
        author: c.author || 'Unknown',
        source_case: c.source_case || null,
        is_verified: c.is_verified,
      };

      return baseExport;
    });

    // Clean scenarios if requested (for eval export)
    let processedQuestions = includeLegacy ? questions : [];
    let processedT3Exports = includeT3 ? t3Exports : [];
    if (cleanForEval) {
      // Process in batches to avoid rate limits
      const cleanedQuestions = [];
      for (const q of questions) {
        // Clean the combined scenario+claim text
        const combinedText = q.claim
          ? `${q.scenario}\n\nClaim: "${q.claim}"`
          : q.scenario;
        const cleanedScenario = await cleanScenarioForEval(combinedText, q.trap_type);
        cleanedQuestions.push({ ...q, scenario: cleanedScenario, claim: '' }); // Clear claim since it's now in scenario
      }
      processedQuestions = cleanedQuestions;

      const cleanedT3 = [];
      for (const item of t3Exports) {
        const trapLabel = item.trap?.type || item.trap?.typeName || 'UNKNOWN';
        const scenarioToClean = item.claim
          ? `${item.scenario}\n\nClaim: "${item.claim}"`
          : item.scenario;
        const cleanedScenario = await cleanScenarioForEval(scenarioToClean, trapLabel);
        cleanedT3.push({
          ...item,
          scenario: cleanedScenario,
          claim: '', // Clear claim since it's now in scenario for eval
        });
      }
      processedT3Exports = cleanedT3;
    }

    // Export data (already in snake_case from database)
    const convertedQuestions = [
      ...processedQuestions.map((q: any) => {
        // Parse variables if it's a JSON string
        let variables;
        try {
          variables = q.variables ? JSON.parse(q.variables) : null;
        } catch {
          variables = q.variables;
        }

        // Parse conditional answers if it's a JSON string
        let conditional_answers;
        try {
          conditional_answers = q.conditional_answers ? JSON.parse(q.conditional_answers) : null;
        } catch {
          conditional_answers = q.conditional_answers;
        }

        // Concatenate scenario and claim into a single scenario field
        const combinedScenario = q.claim
          ? `${q.scenario}\n\nClaim: "${q.claim}"`
          : q.scenario;

        // Build export matching required dataset structure
        const baseExport = {
          // Scenario: clear description of the situation
          scenario: combinedScenario,

          // Variables: key variables with their roles
          variables,

          // Annotations: structured metadata
          annotations: {
            case_id: q.source_case || q.id,
            pearl_level: q.pearl_level,
            domain: q.domain,
            subdomain: q.subdomain,
            trap_type: q.trap_type,
            trap_subtype: q.trap_subtype,
            difficulty: q.difficulty,
            causal_structure: q.causal_structure,
            key_insight: q.key_insight,
            author: q.author || 'Unknown',
          },

          // Ground truth answer
          ground_truth: q.ground_truth,

          // Hidden Timestamp: question that reveals temporal/causal ordering
          hidden_timestamp: q.hidden_timestamp || null,

          // Conditional Answers: "Answer if..." sections for different scenarios
          conditional_answers: conditional_answers || null,

          // Wise Refusal: response that identifies missing info or biases
          wise_refusal: q.wise_refusal,

          // Additional explanation
          explanation: q.explanation,
        };

        // For eval export, exclude trap-revealing fields
        if (cleanForEval) {
          return {
            scenario: combinedScenario,
            variables,
            annotations: {
              case_id: q.source_case || q.id,
              pearl_level: q.pearl_level,
              domain: q.domain,
              subdomain: q.subdomain,
              difficulty: q.difficulty,
              author: q.author || 'Unknown',
            },
            ground_truth: q.ground_truth,
          };
        }

        return baseExport;
      }),
      ...processedT3Exports,
    ];

    // Format export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalQuestions: convertedQuestions.length,
        distribution,
        version: '2.0', // Updated for unified T3Case schema
        cleanedForEval: cleanForEval,
        filters: {
          pearlLevels: pearlLevels.length > 0 ? pearlLevels : ['L1', 'L2', 'L3'],
          verifiedOnly,
          dataset: dataset || 'all',
          includeLegacy,
          includeT3,
        },
      },
      questions: convertedQuestions,
    };

    if (format === 'json') {
      const filename = cleanForEval
        ? `causal-eval-${new Date().toISOString().split('T')[0]}.json`
        : `causal-questions-${new Date().toISOString().split('T')[0]}.json`;

      // Export just the array of questions (no metadata wrapper) for easy combining
      // All field names are in snake_case format
      return new NextResponse(JSON.stringify(exportData.questions, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // For preview (non-download), still include metadata
    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export questions' },
      { status: 500 }
    );
  }
}

