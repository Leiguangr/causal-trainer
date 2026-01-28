/**
 * Backfill hidden_timestamp for CONDITIONAL/AMBIGUOUS cases
 * Derives the hidden question from the conditional_answers
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConditionalAnswers {
  answer_if_condition_1: string | null;
  answer_if_condition_2: string | null;
}

async function deriveHiddenQuestion(
  scenario: string,
  claim: string,
  conditionalAnswers: ConditionalAnswers
): Promise<string> {
  // Use GPT to derive the hidden question from the conditional answers
  const prompt = `Given a causal reasoning case with conditional answers, derive the key question that determines which answer is correct.

SCENARIO: ${scenario}

CLAIM: ${claim}

CONDITION 1: ${conditionalAnswers.answer_if_condition_1}

CONDITION 2: ${conditionalAnswers.answer_if_condition_2}

Based on these two conditional answers, what is the hidden question that determines which condition applies? The question should:
1. Be a single question (not a statement)
2. Have two possible answers that correspond to the two conditions
3. Identify what information is missing from the scenario

Respond with ONLY the question, nothing else.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';
    return response;
  } catch (error) {
    console.error('Error deriving hidden question:', error);
    return '';
  }
}

async function main() {
  // Find CONDITIONAL cases without hidden_timestamp
  const cases = await prisma.question.findMany({
    where: {
      groundTruth: 'CONDITIONAL',
      OR: [
        { hiddenTimestamp: null },
        { hiddenTimestamp: '' },
      ],
    },
    select: {
      id: true,
      scenario: true,
      claim: true,
      conditionalAnswers: true,
    },
  });

  console.log(`Found ${cases.length} CONDITIONAL cases without hidden_timestamp\n`);

  let updated = 0;
  let failed = 0;

  for (const c of cases) {
    // Parse conditional answers
    let conditionalAnswers: ConditionalAnswers;
    try {
      const parsed = c.conditionalAnswers ? JSON.parse(c.conditionalAnswers) : null;
      if (!parsed || (!parsed.answer_if_condition_1 && !parsed.answer_if_condition_2)) {
        // Handle array format [null, null] or missing answers
        if (Array.isArray(parsed) && parsed[0] !== null) {
          conditionalAnswers = {
            answer_if_condition_1: parsed[0],
            answer_if_condition_2: parsed[1] || null,
          };
        } else {
          console.log(`Skipping ${c.id} - no valid conditional answers`);
          continue;
        }
      } else {
        conditionalAnswers = parsed;
      }
    } catch {
      console.log(`Skipping ${c.id} - failed to parse conditional answers`);
      continue;
    }

    console.log(`Processing ${c.id}...`);

    // Derive hidden question
    const hiddenQuestion = await deriveHiddenQuestion(
      c.scenario || '',
      c.claim || '',
      conditionalAnswers
    );

    if (hiddenQuestion) {
      await prisma.question.update({
        where: { id: c.id },
        data: { hiddenTimestamp: hiddenQuestion },
      });
      console.log(`  ✓ Updated: "${hiddenQuestion.substring(0, 60)}..."`);
      updated++;
    } else {
      console.log(`  ✗ Failed to derive question`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
