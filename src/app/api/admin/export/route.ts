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

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      orderBy: [
        { pearlLevel: 'asc' },
        { sourceCase: 'asc' },
      ],
    });

    // Count by level
    const distribution = {
      L1: questions.filter(q => q.pearlLevel === 'L1').length,
      L2: questions.filter(q => q.pearlLevel === 'L2').length,
      L3: questions.filter(q => q.pearlLevel === 'L3').length,
    };

    // Clean scenarios if requested (for eval export)
    let processedQuestions = questions;
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
    }

    // Format export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalQuestions: processedQuestions.length,
        distribution,
        version: '1.0',
        cleanedForEval: cleanForEval,
        filters: {
          pearlLevels: pearlLevels.length > 0 ? pearlLevels : ['L1', 'L2', 'L3'],
          verifiedOnly,
          dataset: dataset || 'all',
        },
      },
      questions: processedQuestions.map(q => {
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

