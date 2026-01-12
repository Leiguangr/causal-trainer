import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { CHEATSHEET_TAXONOMY, getTrapTypesForLevel, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import { PearlLevel } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Target distribution: 11% L1, 66% L2, 23% L3
const LEVEL_DISTRIBUTION = {
  L1: 0.11,
  L2: 0.66,
  L3: 0.23,
};

interface TrapSelection {
  pearlLevel: PearlLevel;
  trapType: string;
  trapTypeLabel: string;
  trapTypeDescription: string;
  trapSubtype: string;
  subtypeDescription: string;
}

// Select underrepresented trap type/subtype based on current distribution
async function selectNextTrap(targetLevel?: PearlLevel): Promise<TrapSelection> {
  // Get current distribution of trap types and subtypes
  const existingQuestions = await prisma.question.findMany({
    select: { pearlLevel: true, trapType: true, trapSubtype: true },
  });

  // Count by level
  const levelCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
  existingQuestions.forEach(q => {
    if (q.pearlLevel && levelCounts[q.pearlLevel] !== undefined) {
      levelCounts[q.pearlLevel]++;
    }
  });
  const totalCount = existingQuestions.length || 1;

  // Determine which level to generate for
  let selectedLevel: PearlLevel;
  if (targetLevel) {
    selectedLevel = targetLevel;
  } else {
    // Find most underrepresented level
    const levelDeficits = Object.entries(LEVEL_DISTRIBUTION).map(([level, target]) => ({
      level: level as PearlLevel,
      deficit: target - (levelCounts[level] / totalCount),
    }));
    levelDeficits.sort((a, b) => b.deficit - a.deficit);
    selectedLevel = levelDeficits[0].level;
  }

  // Get trap types valid for this level
  const validTrapTypes = getTrapTypesForLevel(selectedLevel);

  // Count existing by trap type for this level
  const trapTypeCounts: Record<string, number> = {};
  validTrapTypes.forEach(t => { trapTypeCounts[t.type] = 0; });
  existingQuestions
    .filter(q => q.pearlLevel === selectedLevel)
    .forEach(q => {
      if (q.trapType && trapTypeCounts[q.trapType] !== undefined) {
        trapTypeCounts[q.trapType]++;
      }
    });

  // Find least represented trap type (with some randomization)
  const trapTypeEntries = Object.entries(trapTypeCounts);
  trapTypeEntries.sort((a, b) => a[1] - b[1]);

  // Pick from the bottom 3 (or fewer) with weighted randomization
  const candidates = trapTypeEntries.slice(0, Math.min(3, trapTypeEntries.length));
  const weights = candidates.map((_, i) => 3 - i); // 3, 2, 1 weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let selectedTrapType = candidates[0][0];
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      selectedTrapType = candidates[i][0];
      break;
    }
  }

  const trapDef = validTrapTypes.find(t => t.type === selectedTrapType)!;

  // Get subtypes for this trap type and level
  const subtypes = getSubtypesForTypeAndLevel(selectedTrapType, selectedLevel);

  // Count existing by subtype
  const subtypeCounts: Record<string, number> = {};
  subtypes.forEach(s => { subtypeCounts[s.name] = 0; });
  existingQuestions
    .filter(q => q.pearlLevel === selectedLevel && q.trapType === selectedTrapType)
    .forEach(q => {
      if (q.trapSubtype && subtypeCounts[q.trapSubtype] !== undefined) {
        subtypeCounts[q.trapSubtype]++;
      }
    });

  // Select least represented subtype (or random if no subtypes)
  let selectedSubtype = '';
  let subtypeDescription = '';
  if (subtypes.length > 0) {
    const subtypeEntries = Object.entries(subtypeCounts);
    subtypeEntries.sort((a, b) => a[1] - b[1]);
    // Pick from bottom 2 with randomization
    const subCandidates = subtypeEntries.slice(0, Math.min(2, subtypeEntries.length));
    selectedSubtype = subCandidates[Math.floor(Math.random() * subCandidates.length)][0];
    subtypeDescription = subtypes.find(s => s.name === selectedSubtype)?.description || '';
  }

  return {
    pearlLevel: selectedLevel,
    trapType: selectedTrapType,
    trapTypeLabel: trapDef.label,
    trapTypeDescription: trapDef.description,
    trapSubtype: selectedSubtype,
    subtypeDescription,
  };
}

type ValidityType = 'VALID' | 'INVALID' | 'CONDITIONAL';

function buildPrompt(
  trap: TrapSelection,
  validity: ValidityType,
  domain?: string,
  existingSummaries?: string,
  promptNotes?: string
): string {
  const levelDescription = {
    L1: 'Association - Observational relationships and patterns in data. You observe correlations but cannot intervene.',
    L2: 'Intervention - Causal effects of actions and interventions. You can set/manipulate variables via do(X).',
    L3: 'Counterfactual - Reasoning about what-ifs. What would have happened if X had been different?',
  };

  const domainExamples: Record<string, string> = {
    Markets: 'stock trading, commodities, currency, crypto, macroeconomics',
    Medicine: 'clinical trials, public health, epidemiology, treatment effects',
    Law: 'legal causation, liability, evidence, precedent',
    Technology: 'A/B testing, product metrics, user behavior, system performance',
    Education: 'learning outcomes, teaching methods, student performance',
  };

  // Different instructions based on validity type
  if (validity === 'VALID') {
    return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question where the claim IS VALID.

MANDATORY SPECIFICATIONS:
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- The reasoning should AVOID common traps like ${trap.trapTypeLabel}
${domain ? `- Domain: ${domain} (e.g., ${domainExamples[domain] || 'relevant scenarios'})` : '- Domain: Choose from Markets, Medicine, Law, Technology, or Education'}

REQUIREMENTS:
- Create a realistic, detailed scenario with specific numbers, names, and context
- The causal structure must be appropriate for Pearl Level ${trap.pearlLevel}
- Include clear causal variables (X, Y, Z, etc.)
- The scenario should have PROPER causal identification - no confounding, selection bias, or other traps
- The claim MUST be VALID and correctly follow from the evidence
- Examples of valid reasoning:
  * Randomized controlled trial with proper design → causal claim is valid
  * Instrumental variable properly excludes confounders → causal claim is valid
  * Natural experiment with clear exogenous variation → causal claim is valid
  * Proper counterfactual comparison with parallel trends → causal claim is valid

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${existingSummaries ? `\nEXISTING SCENARIOS TO AVOID DUPLICATING:\n${existingSummaries}\n` : ''}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Detailed scenario (150-300 words) showing proper causal identification...",
  "claim": "The specific causal claim to evaluate (this claim IS valid and follows from evidence)...",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": "Control/Instrument variable (if applicable)"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "NONE",
    "trapSubtype": "None",
    "difficulty": "easy or medium or hard",
    "causalStructure": "Brief DAG description showing why identification is valid",
    "keyInsight": "One-line key takeaway about why this reasoning is sound"
  },
  "groundTruth": "VALID",
  "explanation": "Detailed explanation (100-200 words) of why the claim IS valid. Explain how confounders are controlled, why there's no selection bias, etc.",
  "wiseRefusal": "Complete answer starting with 'The claim is VALID.' followed by clear reasoning about why the causal identification is sound."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
  }

  if (validity === 'CONDITIONAL') {
    return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question where the claim is CONDITIONALLY valid.

MANDATORY SPECIFICATIONS:
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- Related trap to consider: ${trap.trapTypeLabel} (${trap.trapType})
${domain ? `- Domain: ${domain} (e.g., ${domainExamples[domain] || 'relevant scenarios'})` : '- Domain: Choose from Markets, Medicine, Law, Technology, or Education'}

REQUIREMENTS:
- Create a realistic, detailed scenario with specific numbers, names, and context
- The causal structure must be appropriate for Pearl Level ${trap.pearlLevel}
- The claim should be VALID ONLY IF certain assumptions hold
- Make the assumptions explicit but reasonable to question
- Examples of conditional validity:
  * Claim is valid IF we assume no unmeasured confounders
  * Claim is valid IF the parallel trends assumption holds
  * Claim is valid IF the exclusion restriction is satisfied
  * Claim is valid IF there's no measurement error in the treatment

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${existingSummaries ? `\nEXISTING SCENARIOS TO AVOID DUPLICATING:\n${existingSummaries}\n` : ''}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Detailed scenario (150-300 words) with ambiguous causal identification...",
  "claim": "The specific causal claim to evaluate (validity depends on assumptions)...",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": "Potential confounder or control variable"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "${trap.trapType}",
    "trapSubtype": "${trap.trapSubtype || 'None'}",
    "difficulty": "medium or hard",
    "causalStructure": "Brief DAG description",
    "keyInsight": "One-line key takeaway about the required assumptions"
  },
  "groundTruth": "CONDITIONAL",
  "explanation": "Detailed explanation (100-200 words) of what assumptions must hold for the claim to be valid, and why those assumptions might be questionable.",
  "wiseRefusal": "Complete answer starting with 'The claim is CONDITIONAL.' followed by clear reasoning about the required assumptions."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
  }

  // Default: INVALID case with trap
  return `You are an expert in causal reasoning and Pearl's Causality Hierarchy. Generate ONE high-quality causal reasoning question.

MANDATORY SPECIFICATIONS (you MUST follow these exactly):
- Pearl Level: ${trap.pearlLevel} (${levelDescription[trap.pearlLevel]})
- Trap Type: ${trap.trapTypeLabel} (${trap.trapType})
  Definition: ${trap.trapTypeDescription}
${trap.trapSubtype ? `- Trap Subtype: ${trap.trapSubtype.replace(/_/g, ' ')}
  Definition: ${trap.subtypeDescription}` : ''}
${domain ? `- Domain: ${domain} (e.g., ${domainExamples[domain] || 'relevant scenarios'})` : '- Domain: Choose from Markets, Medicine, Law, Technology, or Education'}

REQUIREMENTS:
- Create a realistic, detailed scenario with specific numbers, names, and context
- The scenario MUST clearly exhibit the specified trap type${trap.trapSubtype ? ' and subtype' : ''}
- The causal structure must be appropriate for Pearl Level ${trap.pearlLevel}
- Include clear causal variables (X, Y, Z, etc.)
- Provide a specific causal claim that a naive analyst might make
- The claim should be INVALID due to the specified trap
- Give detailed explanation of why the trap applies

${promptNotes ? `\nADDITIONAL INSTRUCTIONS:\n${promptNotes}\n` : ''}

${existingSummaries ? `\nEXISTING SCENARIOS TO AVOID DUPLICATING:\n${existingSummaries}\n` : ''}

OUTPUT FORMAT (valid JSON only):
{
  "scenario": "Detailed scenario (150-300 words) with specific context, numbers, and setting...",
  "claim": "The specific causal claim to evaluate (as a quote from someone in the scenario)...",
  "variables": {
    "X": "Primary treatment/cause variable",
    "Y": "Outcome variable",
    "Z": "Confounder/Mediator/Collider (depending on trap type)"
  },
  "annotations": {
    "pearlLevel": "${trap.pearlLevel}",
    "domain": "Markets or Medicine or Law or Technology or Education",
    "subdomain": "Specific area within domain",
    "trapType": "${trap.trapType}",
    "trapSubtype": "${trap.trapSubtype || 'None'}",
    "difficulty": "easy or medium or hard",
    "causalStructure": "Brief DAG description (e.g., 'Z → X, Z → Y' for confounding)",
    "keyInsight": "One-line key takeaway"
  },
  "groundTruth": "INVALID",
  "explanation": "Detailed explanation (100-200 words) of why the claim is invalid due to ${trap.trapTypeLabel}${trap.trapSubtype ? ` (${trap.trapSubtype.replace(/_/g, ' ')})` : ''}. Explain the causal mechanism.",
  "wiseRefusal": "Complete answer starting with 'The claim is INVALID.' followed by clear reasoning about the ${trap.trapTypeLabel} trap."
}

Generate the question now. Return ONLY valid JSON, no other text.`;
}

interface GenerateRequest {
  pearlLevel?: string;
  domain?: string;
  batchSize: number;
  promptNotes?: string;
  validityMix?: {
    valid: number;      // percentage of VALID cases (0-100)
    invalid: number;    // percentage of INVALID cases (0-100)
    conditional: number; // percentage of CONDITIONAL cases (0-100)
  };
}

interface GeneratedQuestion {
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

// Helper to select validity type based on mix percentages
function selectValidity(
  validityMix: { valid: number; invalid: number; conditional: number },
  index: number,
  total: number
): ValidityType {
  // Calculate how many of each type we need
  const validCount = Math.round((validityMix.valid / 100) * total);
  const invalidCount = Math.round((validityMix.invalid / 100) * total);
  // Rest goes to conditional

  if (index < validCount) return 'VALID';
  if (index < validCount + invalidCount) return 'INVALID';
  return 'CONDITIONAL';
}

// Background generation function - runs detached from the request
async function runBackgroundGeneration(
  batchId: string,
  batchSize: number,
  pearlLevel: string | undefined,
  domain: string | undefined,
  promptNotes: string | undefined,
  existingSummaries: string,
  validityMix: { valid: number; invalid: number; conditional: number }
) {
  console.log(`[Batch ${batchId}] Starting background generation of ${batchSize} questions (mix: ${validityMix.valid}% valid, ${validityMix.invalid}% invalid, ${validityMix.conditional}% conditional)`);

  try {
    // Mark as running
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: { status: 'running', currentIndex: 0 },
    });

    let successCount = 0;
    let errorCount = 0;

    // Shuffle indices to randomize validity distribution
    const indices = Array.from({ length: batchSize }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < batchSize; i++) {
      // Update current index
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: { currentIndex: i + 1 },
      });

      // Select validity type based on shuffled index
      const validity = selectValidity(validityMix, indices[i], batchSize);

      // Select trap type/subtype based on current distribution
      const trap = await selectNextTrap(pearlLevel as PearlLevel | undefined);
      console.log(`[Batch ${batchId}] Generating ${i + 1}/${batchSize}: ${validity} - ${trap.pearlLevel} - ${trap.trapType} - ${trap.trapSubtype || 'No subtype'}`);

      const prompt = buildPrompt(trap, validity, domain, existingSummaries, promptNotes);

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert in causal reasoning and Pearl's Causality Hierarchy. You specialize in generating training questions about causal traps and biases. Follow the specifications EXACTLY - the trap type and subtype are mandatory requirements, not suggestions.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.85,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0].message.content;
        if (!content) {
          errorCount++;
          continue;
        }

        const generated: GeneratedQuestion = JSON.parse(content);

        // Get the next case ID
        const lastQuestion = await prisma.question.findFirst({
          where: { sourceCase: { startsWith: 'G.' } },
          orderBy: { sourceCase: 'desc' },
        });

        const nextCaseNumber = lastQuestion?.sourceCase
          ? parseInt(lastQuestion.sourceCase.split('.')[1] || '0') + 1
          : 1;
        const caseId = `G.${nextCaseNumber}`;

        // Use the requested trap type/subtype (override LLM if it deviated)
        const finalTrapType = generated.annotations.trapType === trap.trapType
          ? generated.annotations.trapType
          : trap.trapType;
        const finalTrapSubtype = trap.trapSubtype || generated.annotations.trapSubtype;

        // Create question in database
        await prisma.question.create({
          data: {
            scenario: generated.scenario,
            claim: generated.claim,
            pearlLevel: trap.pearlLevel,
            domain: generated.annotations.domain,
            subdomain: generated.annotations.subdomain,
            trapType: finalTrapType,
            trapSubtype: finalTrapSubtype !== 'None' ? finalTrapSubtype : null,
            explanation: generated.explanation,
            difficulty: generated.annotations.difficulty?.toLowerCase() || 'medium',
            groundTruth: generated.groundTruth,
            variables: JSON.stringify(generated.variables),
            causalStructure: generated.annotations.causalStructure,
            keyInsight: generated.annotations.keyInsight,
            wiseRefusal: generated.wiseRefusal,
            sourceCase: caseId,
            isLLMGenerated: true,
            isVerified: false,
            generationBatchId: batchId,
          },
        });

        successCount++;

        // Update generated count
        await prisma.generationBatch.update({
          where: { id: batchId },
          data: { generatedCount: successCount },
        });

      } catch (error) {
        console.error(`[Batch ${batchId}] Error generating question ${i + 1}:`, error);
        errorCount++;
      }
    }

    // Mark as completed
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        generatedCount: successCount,
      },
    });

    console.log(`[Batch ${batchId}] Completed: ${successCount} generated, ${errorCount} errors`);

  } catch (error) {
    console.error(`[Batch ${batchId}] Fatal error:`, error);
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { pearlLevel, domain, batchSize, promptNotes, validityMix } = body;

    console.log('Generate request body:', JSON.stringify(body));

    const size = typeof batchSize === 'number' ? batchSize : parseInt(String(batchSize), 10);
    if (!size || isNaN(size) || size < 1 || size > 200) {
      console.log('Invalid batch size:', batchSize, 'parsed as:', size);
      return NextResponse.json({ error: 'Batch size must be between 1 and 200' }, { status: 400 });
    }

    // Default validity mix: 30% valid, 50% invalid, 20% conditional
    const mix = validityMix || { valid: 30, invalid: 50, conditional: 20 };
    // Normalize percentages to sum to 100
    const total = mix.valid + mix.invalid + mix.conditional;
    if (total !== 100) {
      const scale = 100 / total;
      mix.valid = Math.round(mix.valid * scale);
      mix.invalid = Math.round(mix.invalid * scale);
      mix.conditional = 100 - mix.valid - mix.invalid;
    }

    // Get existing scenarios to avoid duplication
    const existingScenarios = await prisma.question.findMany({
      select: { scenario: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const existingSummaries = existingScenarios.map(q =>
      `${q.scenario.substring(0, 80)}...`
    ).join('\n');

    // Create generation batch record
    const batch = await prisma.generationBatch.create({
      data: {
        pearlLevel: pearlLevel || null,
        domain: domain || null,
        requestedCount: size,
        generatedCount: 0,
        status: 'pending',
        currentIndex: 0,
        promptNotes: promptNotes || null,
        createdById: null,
      },
    });

    // Start background generation (fire and forget)
    // Using setImmediate to detach from the request lifecycle
    setImmediate(() => {
      runBackgroundGeneration(
        batch.id,
        size,
        pearlLevel,
        domain,
        promptNotes,
        existingSummaries,
        mix
      ).catch(err => {
        console.error(`[Batch ${batch.id}] Unhandled error:`, err);
      });
    });

    // Return immediately with batch ID
    return NextResponse.json({
      success: true,
      batchId: batch.id,
      status: 'pending',
      message: `Generation started for ${size} questions (${mix.valid}% valid, ${mix.invalid}% invalid, ${mix.conditional}% conditional). Poll /api/admin/generate/${batch.id}/status for progress.`,
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

