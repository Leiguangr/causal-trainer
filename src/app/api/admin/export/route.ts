import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Clean a scenario by removing explicit trap hints using LLM
async function cleanScenarioForEval(scenario: string, trapType: string): Promise<string> {
  const prompt = `You are helping prepare a causal reasoning evaluation dataset. The following scenario contains explicit hints about the causal trap (${trapType}) that need to be removed so test-takers must identify the flaw themselves.

ORIGINAL SCENARIO:
${scenario}

TASK: Rewrite this scenario to:
1. REMOVE any meta-language describing the mistake (e.g., "is mistakenly treated as", "incorrectly assumes", "fails to account for")
2. REMOVE any explicit labeling of variables as "confounder", "mediator", "collider", etc.
3. KEEP all the factual information and causal structure intact
4. KEEP the inline variable notation (X), (Y), (Z)
5. The scenario should still contain enough information for an expert to identify the trap, but should not explicitly name or describe the trap

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
        const cleanedScenario = await cleanScenarioForEval(q.scenario, q.trapType);
        cleanedQuestions.push({ ...q, scenario: cleanedScenario });
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

        // For eval export, exclude trap-revealing fields
        const baseExport = {
          caseId: q.sourceCase || q.id,
          scenario: q.scenario,
          claim: q.claim,
          variables,
          annotations: {
            pearlLevel: q.pearlLevel,
            domain: q.domain,
            subdomain: q.subdomain,
            difficulty: q.difficulty,
            // Only include these if NOT cleaning for eval
            ...(cleanForEval ? {} : {
              trapType: q.trapType,
              trapSubtype: q.trapSubtype,
              causalStructure: q.causalStructure,
              keyInsight: q.keyInsight,
            }),
          },
          groundTruth: q.groundTruth,
          // Only include detailed explanations if NOT cleaning for eval
          ...(cleanForEval ? {} : {
            explanation: q.explanation,
            wiseRefusal: q.wiseRefusal,
          }),
        };

        return baseExport;
      }),
    };

    if (format === 'json') {
      const filename = cleanForEval
        ? `causal-eval-${new Date().toISOString().split('T')[0]}.json`
        : `causal-questions-${new Date().toISOString().split('T')[0]}.json`;

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export questions' },
      { status: 500 }
    );
  }
}

