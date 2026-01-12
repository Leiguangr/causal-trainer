import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';
import { CHEATSHEET_TAXONOMY, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import { DOMAINS, PearlLevel, PEARL_LEVELS } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateRequest {
  pearlLevel: PearlLevel;
  trapType: string;
  trapSubtype?: string;
  domain: string;
  count?: number;
}

export interface GeneratedQuestion {
  scenario: string;
  pearlLevel: PearlLevel;
  domain: string;
  subdomain?: string;
  trapType: string;
  trapSubtype: string;
  difficulty: 'easy' | 'medium' | 'hard';
  groundTruth: 'VALID' | 'INVALID' | 'CONDITIONAL';
  variables: {
    X: string;
    Y: string;
    Z: string;
  };
  causalStructure: string;
  keyInsight: string;
  hiddenTimestamp?: {
    condition1: string;
    condition2: string;
  };
  wiseRefusal: string;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateRequest = await req.json();
    const { pearlLevel, trapType, trapSubtype, domain, count = 1 } = body;

    // Validate inputs
    if (!pearlLevel || !trapType || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: pearlLevel, trapType, domain' },
        { status: 400 }
      );
    }

    // Get trap type definition
    const trapDef = CHEATSHEET_TAXONOMY.find(t => t.type === trapType);
    if (!trapDef) {
      return NextResponse.json({ error: `Invalid trap type: ${trapType}` }, { status: 400 });
    }

    // Get subtype definition if specified
    const subtypeDef = trapSubtype
      ? trapDef.subtypes.find(s => s.name === trapSubtype)
      : getSubtypesForTypeAndLevel(trapType, pearlLevel)[0];

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(pearlLevel, trapDef, subtypeDef, domain, count);

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    const questions: GeneratedQuestion[] = parsed.questions || [parsed];

    return NextResponse.json({ questions, usage: response.usage });
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(): string {
  return `You are an expert in causal inference and Pearl's causal hierarchy. Your task is to generate realistic practice problems that test understanding of causal reasoning traps using a unified question schema.

Each problem should:
1. Present a realistic scenario from the specified domain
2. Embed the causal claim/conclusion **inside the scenario text itself** (no separate claim field)
3. Use inline tags (X), (Y), (Z) to mark the key variables in the scenario
4. Be clearly analyzable using causal DAG reasoning
5. Include groundTruth: VALID (claim is correct), INVALID (claim has a flaw), or CONDITIONAL (depends on assumptions)
6. Use a single-Z variable block: variables.X, variables.Y, variables.Z (string)
7. Put all detailed reasoning in wiseRefusal (no separate explanation field)

Always respond with valid JSON in this exact format:
{
  "questions": [
    {
      "scenario": "2-4 sentences describing a realistic situation and the causal conclusion, with (X), (Y), (Z) tags inline",
      "subdomain": "A specific subdomain (e.g., 'Behavioral Finance', 'Cardiology', etc.)",
      "groundTruth": "VALID|INVALID|CONDITIONAL",
      "difficulty": "easy|medium|hard",
      "variables": {
        "X": "The exposure/treatment variable (brief description)",
        "Y": "The outcome variable (brief description)",
        "Z": "Single key additional variable (confounder/mediator/collider/mechanism)"
      },
      "causalStructure": "Brief description of the causal graph (e.g., 'X → Y is confounded by Z' or 'Z is a collider between X and Y')",
      "keyInsight": "One-line takeaway lesson (e.g., 'Conditioning on a collider induces spurious correlation')",
      "hiddenTimestamp": {
        "condition1": "Optional – description when Z occurs BEFORE X",
        "condition2": "Optional – description when X occurs BEFORE Z"
      },
      "wiseRefusal": "Complete 3-4 sentence answer that: 1) States the verdict (VALID/INVALID/CONDITIONAL), 2) Identifies the trap, 3) Explains the correct causal reasoning using X, Y, and Z, 4) Provides the key insight"
    }
  ]
}`;
}

function buildUserPrompt(
  level: PearlLevel,
  trapDef: typeof CHEATSHEET_TAXONOMY[0],
  subtypeDef: typeof CHEATSHEET_TAXONOMY[0]['subtypes'][0] | undefined,
  domain: string,
  count: number
): string {
  const meta = PEARL_LEVELS[level];
  const levelDesc = `${meta.name} – ${meta.description}`;

  let prompt = `Generate ${count} causal reasoning problem(s) with these specifications:

**Pearl Level**: ${level} - ${levelDesc}
**Domain**: ${domain}
**Trap Type**: ${trapDef.type} (${trapDef.label})
**Description**: ${trapDef.description}
`;

  if (subtypeDef) {
    prompt += `**Subtype**: ${subtypeDef.name}
**Subtype Description**: ${subtypeDef.description}
`;
  }

  // Determine expected groundTruth based on trap type
  const expectedGroundTruth = trapDef.type === 'MECHANISM' ? 'VALID' : 'INVALID';

  prompt += `
**Expected groundTruth**: ${expectedGroundTruth}

The scenario should be realistic and domain-appropriate. The causal claim should be embedded inside the scenario text and clearly exhibit the ${trapDef.type} trap.

IMPORTANT:
- The scenario must include both the setup and the conclusion/claim in a single field.
- Use (X), (Y), (Z) tags inline in the scenario to mark the variables.
- groundTruth must be ${expectedGroundTruth} (this is what the user will select as their answer).
- wiseRefusal should be the complete answer a student would give on an exam, and it must explicitly reference X, Y, and Z.
- Use a single-Z variables block: X (treatment), Y (outcome), Z (single key additional variable).`;

  return prompt;
}
