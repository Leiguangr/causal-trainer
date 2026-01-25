import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get('dataset') || '';
    const evaluationBatchId = searchParams.get('evaluationBatchId') || '';
    const caseType = searchParams.get('caseType') || 'all';
    const overallVerdict = searchParams.get('overallVerdict') || '';
    const format = searchParams.get('format') || 'json';

    // Build where clause (same as grading route)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (evaluationBatchId) where.evaluationBatchId = evaluationBatchId;
    if (overallVerdict) where.overallVerdict = overallVerdict;

    if (caseType === 'legacy') where.questionId = { not: null };
    if (caseType === 'L1') where.l1CaseId = { not: null };
    if (caseType === 'L2') where.l2CaseId = { not: null };
    if (caseType === 'L3') where.l3CaseId = { not: null };

    if (dataset) {
      where.OR = [
        { evaluationBatch: { is: { dataset } } },
        { question: { is: { dataset } } },
        { l1Case: { is: { dataset } } },
        { l2Case: { is: { dataset } } },
        { l3Case: { is: { dataset } } },
      ];
    }

    // Fetch all evaluations with case data
    const evaluations = await prisma.caseEvaluation.findMany({
      where,
      include: {
        evaluationBatch: true,
        question: true,
        l1Case: true,
        l2Case: true,
        l3Case: true,
      },
      orderBy: [{ priorityLevel: 'asc' }, { createdAt: 'desc' }],
    });

    // Transform to export format
    const exportData = evaluations.map((e) => {
      const caseData = e.question || e.l1Case || e.l2Case || e.l3Case;
      const caseType_ = e.question ? 'legacy' : e.l1Case ? 'L1' : e.l2Case ? 'L2' : 'L3';

      // Parse rubric score
      let rubricScore = null;
      try {
        if (e.rubricScore) {
          rubricScore = JSON.parse(e.rubricScore);
        }
      } catch {
        // Ignore parse errors
      }

      const base = {
        evaluationId: e.id,
        caseId: caseData?.id || '',
        caseType: caseType_,
        overallVerdict: e.overallVerdict,
        priorityLevel: e.priorityLevel,
        clarityScore: e.clarityScore,
        difficultyAssessment: e.difficultyAssessment,
        rubricScore: rubricScore,
        pearlLevelAssessment: e.pearlLevelAssessment,
        suggestedPearlLevel: e.suggestedPearlLevel,
        trapTypeAssessment: e.trapTypeAssessment,
        suggestedTrapType: e.suggestedTrapType,
        groundTruthAssessment: e.groundTruthAssessment,
        suggestedGroundTruth: e.suggestedGroundTruth,
        hasAmbiguity: e.hasAmbiguity,
        ambiguityNotes: e.ambiguityNotes,
        hasLogicalIssues: e.hasLogicalIssues,
        logicalIssueNotes: e.logicalIssueNotes,
        hasDomainErrors: e.hasDomainErrors,
        domainErrorNotes: e.domainErrorNotes,
        structuralNotes: e.structuralNotes,
        causalGraphNotes: e.causalGraphNotes,
        variableNotes: e.variableNotes,
        suggestedCorrections: e.suggestedCorrections,
        evaluationBatchId: e.evaluationBatchId,
        createdAt: e.createdAt.toISOString(),
      };

      // Add case-specific data
      if (e.question) {
        return {
          ...base,
          caseData: {
            scenario: e.question.scenario,
            claim: e.question.claim,
            pearlLevel: e.question.pearlLevel,
            trapType: e.question.trapType,
            trapSubtype: e.question.trapSubtype,
            groundTruth: e.question.groundTruth,
            explanation: e.question.explanation,
            wiseRefusal: e.question.wiseRefusal,
            hiddenQuestion: e.question.hiddenQuestion,
            answerIfA: e.question.answerIfA,
            answerIfB: e.question.answerIfB,
            variables: e.question.variables,
            causalStructure: e.question.causalStructure,
            domain: e.question.domain,
            subdomain: e.question.subdomain,
            difficulty: e.question.difficulty,
            dataset: e.question.dataset,
          },
        };
      } else if (e.l1Case) {
        return {
          ...base,
          caseData: {
            scenario: e.l1Case.scenario,
            claim: e.l1Case.claim,
            groundTruth: e.l1Case.groundTruth,
            evidenceClass: e.l1Case.evidenceClass,
            evidenceType: e.l1Case.evidenceType,
            whyFlawedOrValid: e.l1Case.whyFlawedOrValid,
            variables: e.l1Case.variables,
            causalStructure: e.l1Case.causalStructure,
            domain: e.l1Case.domain,
            subdomain: e.l1Case.subdomain,
            difficulty: e.l1Case.difficulty,
            dataset: e.l1Case.dataset,
          },
        };
      } else if (e.l2Case) {
        return {
          ...base,
          caseData: {
            scenario: e.l2Case.scenario,
            trapType: e.l2Case.trapType,
            hiddenQuestion: e.l2Case.hiddenQuestion,
            answerIfA: e.l2Case.answerIfA,
            answerIfB: e.l2Case.answerIfB,
            wiseRefusal: e.l2Case.wiseRefusal,
            variables: e.l2Case.variables,
            causalStructure: e.l2Case.causalStructure,
            difficulty: e.l2Case.difficulty,
            dataset: e.l2Case.dataset,
          },
        };
      } else if (e.l3Case) {
        return {
          ...base,
          caseData: {
            scenario: e.l3Case.scenario,
            counterfactualClaim: e.l3Case.counterfactualClaim,
            groundTruth: e.l3Case.groundTruth,
            family: e.l3Case.family,
            justification: e.l3Case.justification,
            wiseResponse: e.l3Case.wiseResponse,
            variables: e.l3Case.variables,
            invariants: e.l3Case.invariants,
            domain: e.l3Case.domain,
            difficulty: e.l3Case.difficulty,
            dataset: e.l3Case.dataset,
          },
        };
      }

      return base;
    });

    if (format === 'json') {
      const filename = `evaluations-export-${new Date().toISOString().split('T')[0]}.json`;
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      // CSV format
      if (exportData.length === 0) {
        return NextResponse.json({ error: 'No data to export' }, { status: 400 });
      }

      // Flatten nested objects for CSV
      const csvRows = exportData.map((row) => {
        const flat: Record<string, any> = { ...row };
        if (row.caseData) {
          Object.entries(row.caseData).forEach(([key, value]) => {
            flat[`caseData.${key}`] = value;
          });
          delete flat.caseData;
        }
        if (row.rubricScore) {
          flat['rubricScore.totalScore'] = row.rubricScore.totalScore;
          flat['rubricScore.acceptanceThreshold'] = row.rubricScore.acceptanceThreshold;
          flat['rubricScore.rubricVersion'] = row.rubricScore.rubricVersion;
          if (row.rubricScore.categoryScores) {
            Object.entries(row.rubricScore.categoryScores).forEach(([key, value]) => {
              flat[`rubricScore.categoryScores.${key}`] = value;
            });
          }
        }
        return flat;
      });

      const headers = Object.keys(csvRows[0]);
      const csv = [
        headers.join(','),
        ...csvRows.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              const str = String(value);
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(',')
        ),
      ].join('\n');

      const filename = `evaluations-export-${new Date().toISOString().split('T')[0]}.csv`;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error('Export evaluations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export evaluations' },
      { status: 500 }
    );
  }
}
