// Backfill script to fix trapType for YES and AMBIGUOUS questions
// Run with: npx tsx scripts/backfill-traptype.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  // Find affected questions
  const affected = await prisma.question.findMany({
    where: {
      groundTruth: { in: ['YES', 'AMBIGUOUS'] },
      trapType: { not: 'NONE' }
    },
    select: { id: true, groundTruth: true, trapType: true, trapSubtype: true }
  });

  console.log(`Found ${affected.length} questions to fix`);
  
  if (affected.length === 0) {
    console.log('No backfill needed!');
    await prisma.$disconnect();
    return;
  }

  // Show sample
  console.log('\nSample of affected questions:');
  affected.slice(0, 5).forEach(q => {
    console.log(`  ${q.id}: ${q.groundTruth} with trapType=${q.trapType}`);
  });

  // Fix them
  const result = await prisma.question.updateMany({
    where: {
      groundTruth: { in: ['YES', 'AMBIGUOUS'] },
      trapType: { not: 'NONE' }
    },
    data: {
      trapType: 'NONE',
      trapSubtype: 'NONE'
    }
  });

  console.log(`\nFixed ${result.count} questions (set trapType=NONE, trapSubtype=NONE)`);
  await prisma.$disconnect();
}

backfill().catch(console.error);

