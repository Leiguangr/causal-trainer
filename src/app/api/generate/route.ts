import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';
import { CHEATSHEET_TAXONOMY, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import { DOMAINS, PearlLevel } from '@/types';

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
  claim: string;
  pearlLevel: PearlLevel;
  domain: string;
  subdomain?: string;
  trapType: string;
  trapSubtype: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  groundTruth: 'YES' | 'NO' | 'AMBIGUOUS';
  variables: {
    X: string;
    Y: string;
    Z: string[];
  };
  causalStructure: string;
  keyInsight: string;
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
  return `You are an expert in causal inference and Pearl's causal hierarchy. Your task is to generate realistic practice problems that test understanding of causal reasoning traps.

Ground Truth Label Rules:
- YES: The claim is supported as stated by the given scenario. trapType MUST be "NONE".
- NO: The claim is invalid due to a violated causal/statistical assumption. trapType MUST specify exactly one trap.
- AMBIGUOUS: The claim cannot be definitively evaluated given available information. trapType MUST be "NONE".

Each problem should:
1. Present a realistic scenario from the specified domain
2. Make a causal claim that contains the specified reasoning trap
3. Be clearly analyzable using causal DAG reasoning
4. Include groundTruth: YES (claim is supported), NO (claim has an identifiable flaw), or AMBIGUOUS (cannot be evaluated)
5. Ensure the correct answer (groundTruth) is one of the three options users can select

Always respond with valid JSON in this exact format:
{
  "questions": [
    {
      "scenario": "2-4 sentences describing a realistic situation",
      "claim": "The specific causal claim being made (1 sentence)",
      "subdomain": "A specific subdomain (e.g., 'Behavioral Finance', 'Cardiology', etc.)",
      "groundTruth": "YES|NO|AMBIGUOUS",
      "difficulty": "easy|medium|hard",
      "variables": {
        "X": "The exposure/treatment variable (brief description)",
        "Y": "The outcome variable (brief description)",
        "Z": ["List of confounders, mediators, colliders, or mechanisms involved"]
      },
      "causalStructure": "Brief description of the causal graph (e.g., 'X → Y is confounded by Z' or 'Z is a collider between X and Y')",
      "keyInsight": "One-line takeaway lesson (e.g., 'Conditioning on a collider induces spurious correlation')",
      "explanation": "2-3 sentence explanation of why the claim is YES/NO/AMBIGUOUS",
      "wiseRefusal": "Complete 3-4 sentence answer that: 1) States the verdict (YES/NO/AMBIGUOUS), 2) Identifies the trap (if NO), 3) Explains the correct causal reasoning, 4) Provides the key insight"
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
  const levelDesc = {
    L1: 'Association (observational data, correlation claims)',
    L2: 'Intervention (do-operator, policy evaluation)',
    L3: 'Counterfactual (what-if reasoning, alternative worlds)',
  }[level];

  // Scenario structure guidance by Pearl level
  const scenarioStructure = {
    L1: `SCENARIO STRUCTURE FOR L1 (Data-Centric):
- Focus on describing the DATA PATTERN itself
- Show observational correlations, associations, or patterns
- No actor/analyst persona required - the data speaks for itself`,

    L2: `SCENARIO STRUCTURE FOR L2 (Actor-Centric):
- The scenario MUST include someone who TOOK AN ACTION and MAKES A CLAIM about its effect
- This could be: an analyst, policy maker, CEO, researcher, doctor, manager, etc.
- Show: (1) what intervention they did, (2) what they observed, (3) their causal conclusion
- The trap is in their METHODOLOGY or INTERPRETATION, not just the data`,

    L3: `SCENARIO STRUCTURE FOR L3 (Reasoning-Centric):
- The scenario MUST include someone making a COUNTERFACTUAL CLAIM ("what if" / "had X not happened")
- Show: (1) what happened, (2) their counterfactual reasoning about alternatives
- The trap is in their COUNTERFACTUAL LOGIC (preemption, cross-world confounding, etc.)`,
  }[level];

  let prompt = `Generate ${count} causal reasoning problem(s) with these specifications:

**Pearl Level**: ${level} - ${levelDesc}
**Domain**: ${domain}
**Trap Type**: ${trapDef.type} (${trapDef.label})
**Description**: ${trapDef.description}

${scenarioStructure}
`;

  if (subtypeDef) {
    prompt += `**Subtype**: ${subtypeDef.name}
**Definition**: ${subtypeDef.description}
${subtypeDef.minimalGraph ? `**Causal Graph**: ${subtypeDef.minimalGraph}` : ''}
${subtypeDef.mathSignature ? `**What Goes Wrong**: ${subtypeDef.mathSignature}` : ''}
${subtypeDef.howItHappens ? `**Practical Example**: ${subtypeDef.howItHappens}` : ''}
`;
  }

  // Determine expected groundTruth based on trap type
  // MECHANISM traps typically have valid causal claims (YES), others are invalid (NO)
  const expectedGroundTruth = trapDef.type === 'MECHANISM' ? 'YES' : 'NO';

  prompt += `
**Expected groundTruth**: ${expectedGroundTruth}

The scenario should be realistic and domain-appropriate. The causal claim should clearly exhibit the ${trapDef.type} trap.

IMPORTANT:
- groundTruth must be ${expectedGroundTruth} (this is what the user will select as their answer)
- The wiseRefusal should be the complete answer a student would give on an exam
- Include specific variable names from the scenario in X, Y, and Z`;

  return prompt;
}

