import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type PearlLevel = 'L1' | 'L2' | 'L3';

type ExportItem = {
  scenario?: unknown;
  variables?: unknown;
  annotations?: {
    caseId?: unknown;
    pearlLevel?: unknown;
    domain?: unknown;
    subdomain?: unknown;
    trapType?: unknown;
    trapSubtype?: unknown;
    difficulty?: unknown;
    causalStructure?: unknown;
    keyInsight?: unknown;
    author?: unknown;
    family?: unknown;
  };
  // Legacy-ish fields
  groundTruth?: unknown;
  hiddenTimestamp?: unknown;
  conditionalAnswers?: unknown;
  wiseRefusal?: unknown;
  explanation?: unknown;

  // T3 L2 fields
  hiddenQuestion?: unknown;
  answerIfA?: unknown;
  answerIfB?: unknown;

  // T3 L3 fields
  counterfactualClaim?: unknown;
  invariants?: unknown;
  justification?: unknown;
  wiseResponse?: unknown;
};

function asString(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

function normalizeJsonString(x: unknown): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function parseCombinedScenario(combinedScenario: string): { scenario: string; claim: string } {
  const marker = '\n\nClaim: "';
  const idx = combinedScenario.lastIndexOf(marker);
  if (idx === -1) return { scenario: combinedScenario, claim: '' };
  const scenario = combinedScenario.slice(0, idx);
  const after = combinedScenario.slice(idx + marker.length);
  const endQuote = after.lastIndexOf('"');
  const claim = endQuote >= 0 ? after.slice(0, endQuote) : after;
  return { scenario, claim };
}

function getPearlLevel(item: ExportItem): PearlLevel | null {
  const level = asString(item.annotations?.pearlLevel);
  if (level === 'L1' || level === 'L2' || level === 'L3') return level;
  return null;
}

function isT3L2(item: ExportItem): boolean {
  return (
    typeof item.hiddenQuestion === 'string' &&
    typeof item.answerIfA === 'string' &&
    typeof item.answerIfB === 'string' &&
    typeof item.wiseRefusal === 'string'
  );
}

function isT3L3(item: ExportItem): boolean {
  return (
    typeof item.counterfactualClaim === 'string' &&
    item.invariants != null &&
    typeof item.justification === 'string' &&
    typeof item.wiseResponse === 'string'
  );
}

function isT3L1(item: ExportItem): boolean {
  // Export maps L1Case.evidenceClass -> annotations.trapType and evidenceType -> annotations.trapSubtype
  const trapType = asString(item.annotations?.trapType);
  return trapType === 'WOLF' || trapType === 'SHEEP' || trapType === 'NONE';
}

async function upsertQuestionByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    claim: string;
    pearlLevel: string;
    domain: string;
    subdomain: string | null;
    trapType: string;
    trapSubtype: string;
    explanation: string;
    difficulty: string;
    groundTruth: string;
    variables: string | null;
    causalStructure: string | null;
    keyInsight: string | null;
    wiseRefusal: string | null;
    hiddenTimestamp: string | null;
    conditionalAnswers: string | null;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  if (sourceCase) {
    const existing = await prisma.question.findFirst({
      where: { dataset, sourceCase },
      select: { id: true },
    });
    if (existing) {
      return prisma.question.update({ where: { id: existing.id }, data });
    }
  }
  return prisma.question.create({
    data: { ...data, dataset, sourceCase: sourceCase || null, isLLMGenerated: false },
  });
}

async function upsertL1ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    claim: string;
    groundTruth: string;
    evidenceClass: string;
    evidenceType: string | null;
    whyFlawedOrValid: string;
    domain: string | null;
    subdomain: string | null;
    difficulty: string;
    variables: string | null;
    causalStructure: string | null;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  if (sourceCase) {
    const existing = await prisma.l1Case.findFirst({
      where: { dataset, sourceCase },
      select: { id: true },
    });
    if (existing) return prisma.l1Case.update({ where: { id: existing.id }, data });
  }
  return prisma.l1Case.create({ data: { ...data, dataset, sourceCase: sourceCase || null } });
}

async function upsertL2ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    scenario: string;
    variables: string | null;
    trapType: string;
    difficulty: string;
    causalStructure: string | null;
    hiddenQuestion: string;
    answerIfA: string;
    answerIfB: string;
    wiseRefusal: string;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  if (sourceCase) {
    const existing = await prisma.l2Case.findFirst({
      where: { dataset, sourceCase },
      select: { id: true },
    });
    if (existing) return prisma.l2Case.update({ where: { id: existing.id }, data });
  }
  return prisma.l2Case.create({ data: { ...data, dataset, sourceCase: sourceCase || null } });
}

async function upsertL3ByDatasetSourceCase(args: {
  dataset: string;
  sourceCase: string | null;
  data: {
    caseId: string | null;
    domain: string | null;
    family: string;
    difficulty: string;
    scenario: string;
    counterfactualClaim: string;
    variables: string;
    invariants: string;
    groundTruth: string;
    justification: string;
    wiseResponse: string;
    author: string | null;
  };
}) {
  const { dataset, sourceCase, data } = args;
  if (sourceCase) {
    const existing = await prisma.l3Case.findFirst({
      where: { dataset, sourceCase },
      select: { id: true },
    });
    if (existing) return prisma.l3Case.update({ where: { id: existing.id }, data });
  }
  return prisma.l3Case.create({ data: { ...data, dataset, sourceCase: sourceCase || null } });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const dataset = (form.get('dataset') as string | null) || 'default';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const raw = await file.text();
    const cleaned = raw.replace(/^\uFEFF/, '').trim(); // strip UTF-8 BOM + whitespace
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Expected JSON array (exported questions)' }, { status: 400 });
    }

    const errors: Array<{ index: number; error: string }> = [];
    let imported = { question: 0, l1: 0, l2: 0, l3: 0 };

    // Process sequentially to keep sqlite happy and make failures attributable
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as ExportItem;

      const level = getPearlLevel(item);
      const scenarioCombined = asString(item.scenario);
      if (!level || !scenarioCombined) {
        errors.push({ index: i, error: 'Missing scenario or annotations.pearlLevel' });
        continue;
      }

      const { scenario, claim } = parseCombinedScenario(scenarioCombined);
      const annotations = item.annotations || {};

      const sourceCase = asString(annotations.caseId) || null;
      const author = asString(annotations.author) || null;
      const difficulty = asString(annotations.difficulty) || 'medium';
      const variablesStr = normalizeJsonString(item.variables);

      // Route into T3 tables when the item matches a T3 export shape; otherwise fall back to legacy Question.
      if (level === 'L1' && isT3L1(item)) {
        const groundTruth = asString(item.groundTruth) || 'NO';
        const evidenceClass = asString(annotations.trapType) || 'NONE';
        const evidenceTypeRaw = asString(annotations.trapSubtype);
        const evidenceType = evidenceTypeRaw && evidenceTypeRaw !== 'NONE' ? evidenceTypeRaw : null;
        const whyFlawedOrValid = asString(item.explanation);
        if (!whyFlawedOrValid) {
          errors.push({ index: i, error: 'L1 (T3) missing explanation' });
          continue;
        }
        await upsertL1ByDatasetSourceCase({
          dataset,
          sourceCase,
          data: {
            scenario,
            claim,
            groundTruth,
            evidenceClass,
            evidenceType,
            whyFlawedOrValid,
            domain: asString(annotations.domain) || null,
            subdomain: asString(annotations.subdomain) || null,
            difficulty,
            variables: variablesStr,
            causalStructure: asString(annotations.causalStructure) || null,
            author,
          },
        });
        imported.l1++;
        continue;
      }

      if (level === 'L2' && isT3L2(item)) {
        await upsertL2ByDatasetSourceCase({
          dataset,
          sourceCase,
          data: {
            scenario,
            variables: variablesStr,
            trapType: asString(annotations.trapType) || 'T1',
            difficulty,
            causalStructure: asString(annotations.causalStructure) || null,
            hiddenQuestion: item.hiddenQuestion as string,
            answerIfA: item.answerIfA as string,
            answerIfB: item.answerIfB as string,
            wiseRefusal: item.wiseRefusal as string,
            author,
          },
        });
        imported.l2++;
        continue;
      }

      if (level === 'L3' && isT3L3(item)) {
        const family = asString(annotations.family);
        const groundTruth = asString(item.groundTruth);
        const invariantsStr = normalizeJsonString(item.invariants);
        if (!family) {
          errors.push({ index: i, error: 'L3 (T3) missing annotations.family' });
          continue;
        }
        if (!groundTruth) {
          errors.push({ index: i, error: 'L3 (T3) missing groundTruth' });
          continue;
        }
        if (!invariantsStr) {
          errors.push({ index: i, error: 'L3 (T3) missing invariants' });
          continue;
        }
        const variablesRequired = normalizeJsonString(item.variables);
        if (!variablesRequired) {
          errors.push({ index: i, error: 'L3 (T3) missing variables' });
          continue;
        }
        await upsertL3ByDatasetSourceCase({
          dataset,
          sourceCase,
          data: {
            caseId: asString(annotations.caseId) || null,
            domain: asString(annotations.domain) || null,
            family,
            difficulty,
            scenario,
            counterfactualClaim: item.counterfactualClaim as string,
            variables: variablesRequired,
            invariants: invariantsStr,
            groundTruth,
            justification: item.justification as string,
            wiseResponse: item.wiseResponse as string,
            author,
          },
        });
        imported.l3++;
        continue;
      }

      // Legacy Question fallback
      const domain = asString(annotations.domain) || 'Unknown';
      const subdomain = asString(annotations.subdomain) || null;
      const trapType = asString(annotations.trapType) || 'UNKNOWN';
      const trapSubtype = asString(annotations.trapSubtype) || 'UNKNOWN';
      const explanation = asString(item.explanation) || '';
      const groundTruth = asString(item.groundTruth) || 'NO';

      await upsertQuestionByDatasetSourceCase({
        dataset,
        sourceCase,
        data: {
          scenario,
          claim,
          pearlLevel: level,
          domain,
          subdomain,
          trapType,
          trapSubtype,
          explanation,
          difficulty,
          groundTruth,
          variables: variablesStr,
          causalStructure: asString(annotations.causalStructure) || null,
          keyInsight: asString(annotations.keyInsight) || null,
          wiseRefusal: asString(item.wiseRefusal) || null,
          hiddenTimestamp: asString(item.hiddenTimestamp) || null,
          conditionalAnswers: normalizeJsonString(item.conditionalAnswers),
          author,
        },
      });
      imported.question++;
    }

    return NextResponse.json({
      success: true,
      dataset,
      imported,
      total: parsed.length,
      errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import dataset' },
      { status: 500 }
    );
  }
}

