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
      where.pearlLevel = { in: pearlLevels };
    }
    if (verifiedOnly) {
      where.isVerified = true;
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
      questionWhere.pearlLevel = { in: allowed };
    }

    // Determine which sources to include
    const includeLegacy = searchParams.get('includeLegacy') !== 'false';
    const includeT3 = searchParams.get('includeT3') !== 'false';

    const [questions, l1Cases, l2Cases, l3Cases] = await Promise.all([
      // Legacy Question table (only if includeLegacy is true)
      includeLegacy
        ? prisma.question.findMany({
            where: questionWhere,
            orderBy: [{ pearlLevel: 'asc' }, { sourceCase: 'asc' }],
          })
        : Promise.resolve([]),
      // T3 L1Case (only if includeT3 is true and wantsL1)
      includeT3 && wantsL1
        ? prisma.l1Case.findMany({
            where: {
              ...(verifiedOnly ? { isVerified: true } : {}),
              ...(dataset && dataset !== 'all' ? { dataset } : {}),
            },
            orderBy: [{ sourceCase: 'asc' }],
          })
        : Promise.resolve([]),
      // T3 L2Case (only if includeT3 is true and wantsL2)
      includeT3 && wantsL2
        ? prisma.l2Case.findMany({
            where: {
              ...(verifiedOnly ? { isVerified: true } : {}),
              ...(dataset && dataset !== 'all' ? { dataset } : {}),
            },
            orderBy: [{ sourceCase: 'asc' }],
          })
        : Promise.resolve([]),
      // T3 L3Case (only if includeT3 is true and wantsL3)
      includeT3 && wantsL3
        ? prisma.l3Case.findMany({
            where: {
              ...(verifiedOnly ? { isVerified: true } : {}),
              ...(dataset && dataset !== 'all' ? { dataset } : {}),
            },
            orderBy: [{ sourceCase: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    // Count by level
    const distribution = {
      L1:
        (includeLegacy ? questions.filter((q: { pearlLevel: string }) => q.pearlLevel === 'L1').length : 0) +
        (includeT3 ? l1Cases.length : 0),
      L2:
        (includeLegacy ? questions.filter((q: { pearlLevel: string }) => q.pearlLevel === 'L2').length : 0) +
        (includeT3 ? l2Cases.length : 0),
      L3:
        (includeLegacy ? questions.filter((q: { pearlLevel: string }) => q.pearlLevel === 'L3').length : 0) +
        (includeT3 ? l3Cases.length : 0),
    };

    // Map L1Case rows into the same export shape as legacy questions
    const l1Exports = l1Cases.map((c: any) => {
      let variables: unknown = null;
      try {
        variables = c.variables ? JSON.parse(c.variables) : null;
      } catch {
        variables = c.variables;
      }

      const combinedScenario = c.claim ? `${c.scenario}\n\nClaim: "${c.claim}"` : c.scenario;

      return {
        // Scenario: clear description of the situation
        scenario: combinedScenario,
        variables,
        annotations: {
          caseId: c.sourceCase || c.id,
          pearlLevel: 'L1',
          domain: c.domain,
          subdomain: c.subdomain,
          trapType: c.evidenceClass, // exported under legacy name
          trapSubtype: c.evidenceType || 'NONE',
          difficulty: c.difficulty,
          causalStructure: c.causalStructure,
          keyInsight: null,
          author: c.author || 'Unknown',
        },
        groundTruth: c.groundTruth,
        hiddenTimestamp: null,
        conditionalAnswers: null,
        wiseRefusal: null,
        explanation: c.whyFlawedOrValid,
      };
    });

    // Map L2Case rows into the new L2 export schema
    const l2Exports = l2Cases.map((c: any) => {
      let variables: unknown = null;
      try {
        variables = c.variables ? JSON.parse(c.variables) : null;
      } catch {
        variables = c.variables;
      }

      return {
        // Scenario: narrative with X, Y, Z labeled
        scenario: c.scenario,
        variables,
        annotations: {
          caseId: c.sourceCase || c.id,
          pearlLevel: 'L2',
          trapType: c.trapType,
          difficulty: c.difficulty,
          causalStructure: c.causalStructure,
          author: c.author || 'Unknown',
        },
        hiddenQuestion: c.hiddenQuestion,
        answerIfA: c.answerIfA,
        answerIfB: c.answerIfB,
        wiseRefusal: c.wiseRefusal,
      };
    });

    // Map L3Case rows into the new L3 export schema
    const l3Exports = l3Cases.map((c: any) => {
      let variables: unknown = null;
      let invariants: unknown = null;
      try {
        variables = c.variables ? JSON.parse(c.variables) : null;
      } catch {
        variables = c.variables;
      }
      try {
        invariants = c.invariants ? JSON.parse(c.invariants) : null;
      } catch {
        invariants = c.invariants;
      }

      return {
        // Scenario: what happened in World A
        scenario: c.scenario,
        counterfactualClaim: c.counterfactualClaim,
        variables,
        invariants,
        annotations: {
          caseId: c.caseId || c.sourceCase || c.id,
          pearlLevel: 'L3',
          domain: c.domain,
          family: c.family,
          difficulty: c.difficulty,
          author: c.author || 'Unknown',
        },
        groundTruth: c.groundTruth,
        justification: c.justification,
        wiseResponse: c.wiseResponse,
      };
    });

    // Clean scenarios if requested (for eval export)
    let processedQuestions = includeLegacy ? questions : [];
    let processedL1Exports = includeT3 ? l1Exports : [];
    let processedL2Exports = includeT3 ? l2Exports : [];
    let processedL3Exports = includeT3 ? l3Exports : [];
    if (cleanForEval) {
      // Process in batches to avoid rate limits
      const cleanedQuestions = [];
      for (const q of questions) {
        // Clean the combined scenario+claim text
        const combinedText = q.claim
          ? `${q.scenario}\n\nClaim: "${q.claim}"`
          : q.scenario;
        const cleanedScenario = await cleanScenarioForEval(combinedText, q.trapType);
        cleanedQuestions.push({ ...q, scenario: cleanedScenario, claim: '' }); // Clear claim since it's now in scenario
      }
      processedQuestions = cleanedQuestions;

      const cleanedL1 = [];
      for (const item of l1Exports) {
        const trapLabel = `${item.annotations.trapType}${item.annotations.trapSubtype ? `/${item.annotations.trapSubtype}` : ''}`;
        const cleanedScenario = await cleanScenarioForEval(item.scenario, trapLabel);
        cleanedL1.push({
          ...item,
          scenario: cleanedScenario,
        });
      }
      processedL1Exports = cleanedL1;

      const cleanedL2 = [];
      for (const item of l2Exports) {
        const cleanedScenario = await cleanScenarioForEval(item.scenario, item.annotations.trapType);
        cleanedL2.push({
          ...item,
          scenario: cleanedScenario,
        });
      }
      processedL2Exports = cleanedL2;

      const cleanedL3 = [];
      for (const item of l3Exports) {
        // For L3, clean the scenario (not the counterfactual claim, as that's the question)
        const cleanedScenario = await cleanScenarioForEval(item.scenario, item.annotations.family || 'L3');
        cleanedL3.push({
          ...item,
          scenario: cleanedScenario,
        });
      }
      processedL3Exports = cleanedL3;
    }

    // Format export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalQuestions: processedQuestions.length + processedL1Exports.length + processedL2Exports.length + processedL3Exports.length,
        distribution,
        version: '1.0',
        cleanedForEval: cleanForEval,
        filters: {
          pearlLevels: pearlLevels.length > 0 ? pearlLevels : ['L1', 'L2', 'L3'],
          verifiedOnly,
          dataset: dataset || 'all',
          includeLegacy,
          includeT3,
        },
      },
      questions: [
        ...processedQuestions.map((q: any) => {
        // Parse variables if it's a JSON string
        let variables;
        try {
          variables = q.variables ? JSON.parse(q.variables) : null;
        } catch {
          variables = q.variables;
        }

        // Parse conditional answers if it's a JSON string
        let conditionalAnswers;
        try {
          conditionalAnswers = q.conditionalAnswers ? JSON.parse(q.conditionalAnswers) : null;
        } catch {
          conditionalAnswers = q.conditionalAnswers;
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
            caseId: q.sourceCase || q.id,
            pearlLevel: q.pearlLevel,
            domain: q.domain,
            subdomain: q.subdomain,
            trapType: q.trapType,
            trapSubtype: q.trapSubtype,
            difficulty: q.difficulty,
            causalStructure: q.causalStructure,
            keyInsight: q.keyInsight,
            author: q.author || 'Unknown',
          },

          // Ground truth answer
          groundTruth: q.groundTruth,

          // Hidden Timestamp: question that reveals temporal/causal ordering
          hiddenTimestamp: q.hiddenTimestamp || null,

          // Conditional Answers: "Answer if..." sections for different scenarios
          conditionalAnswers: conditionalAnswers || null,

          // Wise Refusal: response that identifies missing info or biases
          wiseRefusal: q.wiseRefusal,

          // Additional explanation
          explanation: q.explanation,
        };

        // For eval export, exclude trap-revealing fields
        if (cleanForEval) {
          return {
            scenario: combinedScenario,
            variables,
            annotations: {
              caseId: q.sourceCase || q.id,
              pearlLevel: q.pearlLevel,
              domain: q.domain,
              subdomain: q.subdomain,
              difficulty: q.difficulty,
              author: q.author || 'Unknown',
            },
            groundTruth: q.groundTruth,
          };
        }

        return baseExport;
        }),
        ...processedL1Exports,
        ...processedL2Exports,
        ...processedL3Exports,
      ],
    };

    if (format === 'json') {
      const filename = cleanForEval
        ? `causal-eval-${new Date().toISOString().split('T')[0]}.json`
        : `causal-questions-${new Date().toISOString().split('T')[0]}.json`;

      // Export just the array of questions (no metadata wrapper) for easy combining
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

