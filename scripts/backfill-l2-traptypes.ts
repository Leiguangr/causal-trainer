/**
 * Backfill L2 trap types that are marked as "UNKNOWN"
 * Maps trapSubtype names back to proper T-codes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping from subtype names to T-codes
const SUBTYPE_TO_TCODE: Record<string, string> = {
  'Selection': 'T1:SELECTION',
  'SELECTION': 'T1:SELECTION',
  'Survivorship': 'T2:SURVIVORSHIP',
  'SURVIVORSHIP': 'T2:SURVIVORSHIP',
  'Survivorship Bias': 'T2:SURVIVORSHIP',
  'Collider': 'T3:COLLIDER',
  'COLLIDER': 'T3:COLLIDER',
  'Collider Bias': 'T3:COLLIDER',
  'Immortal Time': 'T4:IMMORTAL TIME',
  'IMMORTAL TIME': 'T4:IMMORTAL TIME',
  'Immortal Time Bias': 'T4:IMMORTAL TIME',
  'Regression': 'T5:REGRESSION',
  'REGRESSION': 'T5:REGRESSION',
  'Regression to Mean': 'T5:REGRESSION',
  'Regression to the Mean': 'T5:REGRESSION',
  'Ecological': 'T6:ECOLOGICAL',
  'ECOLOGICAL': 'T6:ECOLOGICAL',
  'Ecological Fallacy': 'T6:ECOLOGICAL',
  'Confounder': 'T7:CONFOUNDER',
  'CONFOUNDER': 'T7:CONFOUNDER',
  'Confounding': 'T7:CONFOUNDER',
  'Simpson': 'T8:SIMPSON\'S',
  'SIMPSON\'S': 'T8:SIMPSON\'S',
  'Simpson\'s Paradox': 'T8:SIMPSON\'S',
  'Simpsons Paradox': 'T8:SIMPSON\'S',
  'Conf-Med': 'T9:CONF-MED',
  'CONF-MED': 'T9:CONF-MED',
  'Confounder-Mediator': 'T9:CONF-MED',
  'Confounder-Mediator Ambiguity': 'T9:CONF-MED',
  'Confounder-Mediator Confusion': 'T9:CONF-MED',
  'Reverse': 'T10:REVERSE',
  'REVERSE': 'T10:REVERSE',
  'Reverse Causation': 'T10:REVERSE',
  'Feedback': 'T11:FEEDBACK',
  'FEEDBACK': 'T11:FEEDBACK',
  'Feedback Loop': 'T11:FEEDBACK',
  'Temporal': 'T12:TEMPORAL',
  'TEMPORAL': 'T12:TEMPORAL',
  'Time-Varying Confounding': 'T12:TEMPORAL',
  'Measurement': 'T13:MEASUREMENT',
  'MEASUREMENT': 'T13:MEASUREMENT',
  'Measurement Error': 'T13:MEASUREMENT',
  'Measurement Bias': 'T13:MEASUREMENT',
  'Recall': 'T14:RECALL',
  'RECALL': 'T14:RECALL',
  'Recall Bias': 'T14:RECALL',
  'Mechanism': 'T15:MECHANISM',
  'MECHANISM': 'T15:MECHANISM',
  'Wrong Mechanism': 'T15:MECHANISM',
  'Mechanism Failure': 'T15:MECHANISM',
  'Goodhart': 'T16:GOODHART',
  'GOODHART': 'T16:GOODHART',
  'Goodhart\'s Law': 'T16:GOODHART',
  'Backfire': 'T17:BACKFIRE',
  'BACKFIRE': 'T17:BACKFIRE',
  'Backfire Effect': 'T17:BACKFIRE',
};

async function backfillL2TrapTypes() {
  console.log('Backfilling L2 trap types...\n');

  // Find all L2 cases with UNKNOWN trap type
  const unknownCases = await prisma.question.findMany({
    where: {
      dataset: 'cs372-assignment2',
      pearlLevel: 'L2',
      trapType: 'UNKNOWN',
    },
    select: {
      id: true,
      trapType: true,
      trapSubtype: true,
    },
  });

  console.log(`Found ${unknownCases.length} L2 cases with UNKNOWN trap type\n`);

  let updated = 0;
  let failed = 0;
  const unmapped: string[] = [];

  for (const q of unknownCases) {
    const subtype = q.trapSubtype;
    const newTrapType = SUBTYPE_TO_TCODE[subtype];

    if (newTrapType) {
      await prisma.question.update({
        where: { id: q.id },
        data: { trapType: newTrapType },
      });
      updated++;
      console.log(`✓ ${q.id}: "${subtype}" → ${newTrapType}`);
    } else {
      failed++;
      if (!unmapped.includes(subtype)) {
        unmapped.push(subtype);
      }
      console.log(`✗ ${q.id}: "${subtype}" - NO MAPPING FOUND`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  
  if (unmapped.length > 0) {
    console.log(`\nUnmapped subtypes:`);
    unmapped.forEach(s => console.log(`  - "${s}"`));
  }

  await prisma.$disconnect();
}

backfillL2TrapTypes().catch(console.error);
