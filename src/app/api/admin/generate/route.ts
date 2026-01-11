import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(
  pearlLevel?: string,
  domain?: string,
  existingSummaries?: string,
  promptNotes?: string
): string {
  const levelDescription = {
    L1: 'Association - Observational relationships and patterns in data. Common traps: confounding, reverse causation, selection bias.',
    L2: 'Intervention - Causal effects of actions and interventions. Common traps: unblocked backdoor paths, mediator errors, feedback loops.',
    L3: 'Counterfactual - Reasoning about what-ifs and alternative scenarios. Common traps: preemption, cross-world confounding, dynamic divergence.',
  };

  const domainExamples = {
    Markets: 'stock trading, commodities, currency, crypto, macroeconomics',
    Medicine: 'clinical trials, public health, epidemiology, treatment effects',
    Law: 'legal causation, liability, evidence, precedent',
    Technology: 'A/B testing, product metrics, user behavior, system performance',
    Education: 'learning outcomes, teaching methods, student performance',
  };

  return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question.

REQUIREMENTS:
${pearlLevel ? `- Pearl Level: ${pearlLevel} (${levelDescription[pearlLevel as keyof typeof levelDescription]})` : '- Pearl Level: Choose L1, L2, or L3 appropriately'}
${domain ? `- Domain: ${domain} (e.g., ${domainExamples[domain as keyof typeof domainExamples] || 'relevant scenarios'})` : '- Domain: Choose an appropriate domain'}
- Create a realistic, detailed scenario with specific numbers and context
- The scenario should be distinct from existing questions
- Include clear causal variables (X, Y, Z, etc.)
- Provide a specific claim to evaluate
- Give detailed explanation and wise refusal

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${existingSummaries ? `\nEXISTING SCENARIOS TO AVOID DUPLICATING:\n${existingSummaries}\n` : ''}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Detailed scenario with specific context, numbers, and setting...",
  "claim": "The specific causal claim to evaluate (as a quote)...",
  "variables": {
    "X": "Primary treatment/cause variable description",
    "Y": "Outcome variable description",
    "Z": "Confounder/Mediator/Other relevant variable description"
  },
  "annotations": {
    "pearlLevel": "L1 or L2 or L3",
    "domain": "Markets or Medicine or Law or Technology or Education or other",
    "subdomain": "Specific area within domain",
    "trapType": "CONFOUNDING or REVERSE or SELECTION or COLLIDER or MEDIATOR or COUNTERFACTUAL or other",
    "trapSubtype": "Specific variant of the trap",
    "difficulty": "Easy or Medium or Hard",
    "causalStructure": "Brief description of the causal DAG (e.g., 'Z → X, Z → Y (confounding)')",
    "keyInsight": "One-line key takeaway"
  },
  "groundTruth": "VALID or INVALID or CONDITIONAL",
  "explanation": "Detailed explanation of why the claim is valid/invalid/conditional. Include the causal mechanism and why the trap occurs.",
  "wiseRefusal": "Complete answer starting with 'The claim is [VALID/INVALID/CONDITIONAL].' followed by clear reasoning."
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
  caseId: string;
  scenario: string;
  claim: string;
  variables: {
    X: string;
    Y: string;
    Z?: string;
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
  };
  groundTruth: string;
  explanation: string;
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
      select: { scenario: true, claim: true },
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
            claim: generated.claim,
            pearlLevel: generated.annotations.pearlLevel,
            domain: generated.annotations.domain,
            subdomain: generated.annotations.subdomain,
            trapType: generated.annotations.trapType,
            trapSubtype: generated.annotations.trapSubtype,
            explanation: generated.explanation,
            difficulty: generated.annotations.difficulty.toLowerCase(),
            groundTruth: generated.groundTruth,
            variables: JSON.stringify(generated.variables),
            causalStructure: generated.annotations.causalStructure,
            keyInsight: generated.annotations.keyInsight,
            wiseRefusal: generated.wiseRefusal,
            sourceCase: caseId,
            isLLMGenerated: true,
            isVerified: false,
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

