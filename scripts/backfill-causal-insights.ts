/**
 * Backfill causal_structure and key_insight for existing cases
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function deriveInsights(
  scenario: string,
  claim: string,
  pearlLevel: string,
  groundTruth: string,
  trapType: string | null
): Promise<{ causalStructure: string; keyInsight: string }> {
  const prompt = `Given a causal reasoning case, provide two things:

SCENARIO: ${scenario}

CLAIM: ${claim}

PEARL LEVEL: ${pearlLevel}
GROUND TRUTH: ${groundTruth}
TRAP TYPE: ${trapType || 'Unknown'}

Please provide:
1. causal_structure: A brief description of the causal graph structure (e.g., "Z -> X, Z -> Y (confounding)" or "X -> M -> Y (mediation)")
2. key_insight: A one-line memorable takeaway that captures why this case is tricky or important

Respond in JSON format:
{
  "causal_structure": "...",
  "key_insight": "..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(response);
    return {
      causalStructure: parsed.causal_structure || '',
      keyInsight: parsed.key_insight || '',
    };
  } catch (error) {
    console.error('Error deriving insights:', error);
    return { causalStructure: '', keyInsight: '' };
  }
}

async function main() {
  // Find cases without causal_structure or key_insight
  const cases = await prisma.question.findMany({
    where: {
      OR: [
        { causalStructure: null },
        { causalStructure: '' },
        { keyInsight: null },
        { keyInsight: '' },
      ],
    },
    select: {
      id: true,
      scenario: true,
      claim: true,
      pearlLevel: true,
      groundTruth: true,
      trapType: true,
    },
  });

  console.log(`Found ${cases.length} cases missing causal_structure or key_insight\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`[${i + 1}/${cases.length}] Processing ${c.id}...`);

    const insights = await deriveInsights(
      c.scenario || '',
      c.claim || '',
      c.pearlLevel,
      c.groundTruth || '',
      c.trapType
    );

    if (insights.causalStructure || insights.keyInsight) {
      await prisma.question.update({
        where: { id: c.id },
        data: {
          causalStructure: insights.causalStructure || null,
          keyInsight: insights.keyInsight || null,
        },
      });
      console.log(`  ✓ Structure: "${insights.causalStructure?.substring(0, 40)}..."`);
      console.log(`    Insight: "${insights.keyInsight?.substring(0, 50)}..."`);
      updated++;
    } else {
      console.log(`  ✗ Failed to derive insights`);
      failed++;
    }

    // Small delay to avoid rate limiting
    if (i % 10 === 9) {
      console.log(`  [Processed ${i + 1} cases, pausing briefly...]`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
