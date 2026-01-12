import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { PEARL_LEVELS, PearlLevel } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(
  pearlLevel?: string,
  domain?: string,
  existingSummaries?: string,
  promptNotes?: string
): string {
  const pearlMeta = pearlLevel && (PEARL_LEVELS[pearlLevel as PearlLevel] ?? null);

  const domainExamples = {
    Markets: 'stock trading, commodities, currency, crypto, macroeconomics',
    Medicine: 'clinical trials, public health, epidemiology, treatment effects',
    Law: 'legal causation, liability, evidence, precedent',
    Technology: 'A/B testing, product metrics, user behavior, system performance',
    Education: 'learning outcomes, teaching methods, student performance',
  };

  const pearlSection = pearlMeta
    ? `- Pearl Level: ${pearlMeta.id} – ${pearlMeta.name}
  Description: ${pearlMeta.description}
  Canonical examples:
  - ${pearlMeta.examples[0]}
  - ${pearlMeta.examples[1] ?? ''}`
    : '- Pearl Level: Choose L1, L2, or L3 appropriately (Association / Intervention / Counterfactual).';

  return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question using the unified question schema.

REQUIREMENTS:
${pearlSection}
${domain ? `- Domain: ${domain} (e.g., ${domainExamples[domain as keyof typeof domainExamples] || 'relevant scenarios'})` : '- Domain: Choose an appropriate domain'}
- Create a realistic, detailed scenario with specific numbers and context
- The scenario should be distinct from existing questions
- Use a **single unified scenario field** that includes both setup **and** the causal claim/conclusion
- Embed inline tags (X), (Y), (Z) in the scenario text to mark the variables
- Define variables.X, variables.Y, variables.Z where Z is a **single key additional variable** (confounder / mediator / collider / mechanism)
- Optionally include a hiddenTimestamp block *only if* temporal order of Z vs X matters
- Provide a complete wiseRefusal as the **only explanation field** (no separate explanation)

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${existingSummaries ? `\nEXISTING SCENARIOS TO AVOID DUPLICATING:\n${existingSummaries}\n` : ''}

OUTPUT FORMAT (valid JSON only, unified schema):
{
  "scenario": "2–4 sentences with specific context and numbers. Includes both the setup and the causal claim/conclusion, with (X), (Y), (Z) tags inline.",
  "variables": {
    "X": "Primary treatment/cause variable description",
    "Y": "Outcome variable description",
    "Z": "Single key additional variable (confounder/mediator/collider/mechanism)"
  },
  "annotations": {
    "pearlLevel": "L1 or L2 or L3",
    "domain": "Markets or Medicine or Law or Technology or Education or other",
    "subdomain": "Specific area within domain (e.g., 'Behavioral Finance')",
    "trapType": "CONFOUNDING or REVERSE or SELECTION or COLLIDER or COUNTERFACTUAL or other",
    "trapSubtype": "Specific variant of the trap, or empty string if none fits",
    "difficulty": "easy or medium or hard (lowercase)",
    "causalStructure": "Brief description of the causal DAG (e.g., 'Z → X, Z → Y (confounding)')",
    "keyInsight": "One-line key takeaway",
    "hiddenTimestamp": {
      "condition1": "Optional – description when Z occurs BEFORE X",
      "condition2": "Optional – description when X occurs BEFORE Z"
    }
  },
  "groundTruth": "VALID or INVALID or CONDITIONAL",
  "wiseRefusal": "Complete answer starting with 'The [counterfactual/causal] claim is [VALID/INVALID/CONDITIONAL].' and explicitly referencing X, Y, and Z in the reasoning."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
}

interface GenerateRequest {
  pearlLevel?: string;
  domain?: string;
  batchSize: number;
  promptNotes?: string;
}

interface GeneratedQuestion {
  scenario: string;
  variables: {
    X: string;
    Y: string;
    Z: string;
    [key: string]: string | undefined;
  };
  annotations: {
    pearlLevel: string;
    domain: string;
    subdomain: string;
    trapType: string;
    trapSubtype: string;
    difficulty: string;
    causalStructure: string;
    keyInsight: string;
    hiddenTimestamp?: {
      condition1: string;
      condition2: string;
    };
  };
  groundTruth: string;
  wiseRefusal: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { pearlLevel, domain, batchSize, promptNotes } = body;

    if (!batchSize || batchSize < 1 || batchSize > 50) {
      return NextResponse.json({ error: 'Batch size must be between 1 and 50' }, { status: 400 });
    }

    // Get existing questions to avoid duplication
    const existingQuestions = await prisma.question.findMany({
      select: { scenario: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const existingSummaries = existingQuestions.map(q => 
      `${q.scenario.substring(0, 100)}...`
    ).join('\n');

    // Create generation batch record
    const batch = await prisma.generationBatch.create({
      data: {
        pearlLevel: pearlLevel || null,
        domain: domain || null,
        requestedCount: batchSize,
        generatedCount: 0,
        promptNotes: promptNotes || null,
        createdById: null,
      },
    });

    const generatedQuestions: any[] = [];
    
    // Generate questions one at a time for better quality control
    for (let i = 0; i < batchSize; i++) {
      const prompt = buildPrompt(pearlLevel, domain, existingSummaries, promptNotes);
      
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in causal reasoning and Pearl\'s Causality Hierarchy. Generate high-quality causal reasoning questions in valid JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.9,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0].message.content;
        if (!content) continue;

        const generated: GeneratedQuestion = JSON.parse(content);
        
        // Get the next case ID
        const lastQuestion = await prisma.question.findFirst({
          where: { sourceCase: { not: null } },
          orderBy: { sourceCase: 'desc' },
        });
        
        const nextCaseNumber = lastQuestion?.sourceCase 
          ? parseInt(lastQuestion.sourceCase.split('.')[1] || '45') + 1 
          : 46;
        const caseId = `3.${nextCaseNumber + i}`;

        // Create question in database
        const question = await prisma.question.create({
          data: {
            scenario: generated.scenario,
            pearlLevel: generated.annotations.pearlLevel,
            domain: generated.annotations.domain,
            subdomain: generated.annotations.subdomain,
            trapType: generated.annotations.trapType,
            trapSubtype: generated.annotations.trapSubtype,
            difficulty: generated.annotations.difficulty.toLowerCase(),
            groundTruth: generated.groundTruth,
            variables: JSON.stringify({
              X: generated.variables.X,
              Y: generated.variables.Y,
              Z: generated.variables.Z,
            }),
            causalStructure: generated.annotations.causalStructure,
            keyInsight: generated.annotations.keyInsight,
            wiseRefusal: generated.wiseRefusal,
            sourceCase: caseId,
            isLLMGenerated: true,
            isVerified: false,
            hiddenTimestamp: generated.annotations.hiddenTimestamp
              ? JSON.stringify(generated.annotations.hiddenTimestamp)
              : null,
            generationBatchId: batch.id,
          },
        });

        generatedQuestions.push(question);
      } catch (error) {
        console.error(`Error generating question ${i + 1}:`, error);
      }
    }

    // Update batch with actual count
    await prisma.generationBatch.update({
      where: { id: batch.id },
      data: { generatedCount: generatedQuestions.length },
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      generated: generatedQuestions.length,
      questions: generatedQuestions,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
