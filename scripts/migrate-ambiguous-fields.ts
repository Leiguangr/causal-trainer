/**
 * Migration script to backfill new Question fields:
 * - author: Set to "LLM" for LLM-generated, null otherwise
 * - hiddenTimestamp: "N/A" for YES/NO, "TBD" for AMBIGUOUS
 * - conditionalAnswers: "N/A" for YES/NO, "TBD" for AMBIGUOUS
 * - causalStructure: Set to null for AMBIGUOUS questions
 * 
 * Usage: npx tsx scripts/migrate-ambiguous-fields.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of ambiguous fields...\n');

  // Get all questions
  const questions = await prisma.question.findMany();
  console.log(`Found ${questions.length} questions to process.\n`);

  let yesNoCount = 0;
  let ambiguousCount = 0;

  for (const q of questions) {
    const isAmbiguous = q.groundTruth === 'AMBIGUOUS';
    
    const updates: {
      author?: string | null;
      hiddenTimestamp?: string;
      conditionalAnswers?: string;
      causalStructure?: string | null;
    } = {};

    // Set author based on isLLMGenerated
    if (q.isLLMGenerated && !q.author) {
      updates.author = 'LLM';
    }

    // Set hiddenTimestamp and conditionalAnswers
    if (isAmbiguous) {
      // For AMBIGUOUS: set to TBD (needs human annotation)
      if (!q.hiddenTimestamp) {
        updates.hiddenTimestamp = 'TBD';
      }
      if (!q.conditionalAnswers) {
        updates.conditionalAnswers = 'TBD';
      }
      // Clear causalStructure for AMBIGUOUS (doesn't make sense to have one)
      if (q.causalStructure) {
        updates.causalStructure = null;
      }
      ambiguousCount++;
    } else {
      // For YES/NO: set to N/A
      if (!q.hiddenTimestamp) {
        updates.hiddenTimestamp = 'N/A';
      }
      if (!q.conditionalAnswers) {
        updates.conditionalAnswers = 'N/A';
      }
      yesNoCount++;
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await prisma.question.update({
        where: { id: q.id },
        data: updates,
      });
      console.log(`Updated ${q.id}: groundTruth=${q.groundTruth}, changes=${Object.keys(updates).join(', ')}`);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`YES/NO questions: ${yesNoCount}`);
  console.log(`AMBIGUOUS questions: ${ambiguousCount}`);
  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

