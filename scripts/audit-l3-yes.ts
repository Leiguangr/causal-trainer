// Audit L3 YES questions to check if they have proper structural assumptions
// Run with: npx tsx scripts/audit-l3-yes.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function audit() {
  const l3YesQuestions = await prisma.question.findMany({
    where: {
      pearlLevel: 'L3',
      groundTruth: 'YES'
    },
    select: { 
      id: true, 
      scenario: true, 
      claim: true, 
      domain: true,
      explanation: true,
      keyInsight: true,
      sourceCase: true
    }
  });

  console.log(`\n=== L3 YES Questions Audit ===`);
  console.log(`Found ${l3YesQuestions.length} L3 YES questions\n`);

  // Keywords that might indicate proper structural setup
  const structuralKeywords = [
    'assume', 'assuming', 'given that', 'suppose', 
    'only factor', 'only cause', 'sole cause', 'only mechanism',
    'simulation', 'model shows', 'parallel', 'experiment',
    'rct', 'randomized', 'controlled trial'
  ];

  let hasStructural = 0;
  let lacksStructural = 0;

  for (const q of l3YesQuestions) {
    const scenarioLower = q.scenario.toLowerCase();
    const hasKeyword = structuralKeywords.some(kw => scenarioLower.includes(kw));

    if (hasKeyword) {
      hasStructural++;
    } else {
      lacksStructural++;
      console.log(`\n--- ${q.sourceCase} (${q.domain}) ---`);
      console.log(`Scenario: ${q.scenario}`);
      console.log(`Claim: ${q.claim}`);
      console.log(`Explanation: ${q.explanation?.substring(0, 150)}...`);
      console.log(`⚠️  No structural assumption detected - likely should be AMBIGUOUS`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`With structural keywords: ${hasStructural}`);
  console.log(`Missing structural setup: ${lacksStructural}`);
  console.log(`\nQuestions missing structural setup should likely be reclassified as AMBIGUOUS`);

  await prisma.$disconnect();
}

audit().catch(console.error);

