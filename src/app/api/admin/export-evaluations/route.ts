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

    if (evaluationBatchId) where.evaluation_batch_id = evaluationBatchId;
    if (overallVerdict) where.overall_verdict = overallVerdict;

    if (caseType === 'legacy') where.question_id = { not: null };
    if (caseType === 'L1') where.t3_case_id = { not: null };
    if (caseType === 'L2') where.t3_case_id = { not: null };
    if (caseType === 'L3') where.t3_case_id = { not: null };

    if (dataset) {
      where.OR = [
        { evaluation_batch: { is: { dataset } } },
        { question: { is: { dataset } } },
        { t3_case: { is: { dataset } } },
      ];
    }

    // Fetch all evaluations with case data
    const evaluations = await prisma.caseEvaluation.findMany({
      where,
      include: {
        evaluation_batch: true,
        question: true,
        t3_case: true,
      },
      orderBy: [{ priority_level: 'asc' }, { created_at: 'desc' }],
    });

    // Transform to export format
    const exportData = evaluations.map((e) => {
      const caseData = e.question || e.t3_case;
      const caseType_ = e.question ? 'legacy' : (e.t3_case?.pearl_level || 'UNKNOWN');

      // Parse rubric score - ensure it's always included, even if null
      let rubricScore = null;
      if (e.rubric_score && e.rubric_score !== 'N/A' && e.rubric_score.trim() !== '') {
        try {
          rubricScore = JSON.parse(e.rubric_score);
        } catch {
          // If parsing fails, try to return a basic structure
          rubricScore = {
            error: 'Failed to parse rubric score',
            rawValue: e.rubric_score,
          };
        }
      }

      const base = {
        evaluationId: e.id,
        caseId: caseData?.id || '',
        caseType: caseType_,
        overallVerdict: e.overall_verdict,
        priorityLevel: e.priority_level,
        clarityScore: e.clarity_score,
        difficultyAssessment: e.difficulty_assessment,
        rubricScore: rubricScore,
        pearlLevelAssessment: e.pearl_level_assessment,
        suggestedPearlLevel: e.suggested_pearl_level,
        trapTypeAssessment: e.trap_type_assessment,
        suggestedTrapType: e.suggested_trap_type,
        groundTruthAssessment: e.ground_truth_assessment,
        suggestedGroundTruth: e.suggested_ground_truth,
        hasAmbiguity: e.has_ambiguity,
        ambiguityNotes: e.ambiguity_notes,
        hasLogicalIssues: e.has_logical_issues,
        logicalIssueNotes: e.logical_issue_notes,
        hasDomainErrors: e.has_domain_errors,
        domainErrorNotes: e.domain_error_notes,
        structuralNotes: e.structural_notes,
        causalGraphNotes: e.causal_graph_notes,
        variableNotes: e.variable_notes,
        suggestedCorrections: e.suggested_corrections,
        evaluationBatchId: e.evaluation_batch_id,
        createdAt: e.created_at.toISOString(),
      };

      // Helper function to safely parse JSON fields
      const safeJsonParse = (value: string | null): any => {
        if (!value || value === 'N/A' || value.trim() === '') return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      // Helper function to safely extract conditional answers
      const safeParseConditionalAnswers = (value: string | null) => {
        const parsed = safeJsonParse(value);
        if (!parsed) return { answerIfA: null, answerIfB: null };
        return {
          answerIfA: parsed.answer_if_condition_1 || parsed.answerIfA || null,
          answerIfB: parsed.answer_if_condition_2 || parsed.answerIfB || null,
        };
      };

      // Add case-specific data
      if (e.question) {
        const conditionalAnswers = safeParseConditionalAnswers(e.question.conditional_answers);
        return {
          ...base,
          caseId: e.question.id, // Ensure unique case ID
          caseData: {
            scenario: e.question.scenario || null,
            claim: e.question.claim || null,
            pearlLevel: e.question.pearl_level || null,
            trapType: e.question.trap_type || null,
            trapSubtype: e.question.trap_subtype || null,
            groundTruth: e.question.ground_truth || null,
            explanation: e.question.explanation || null,
            wiseRefusal: e.question.wise_refusal || null,
            hiddenQuestion: e.question.hidden_timestamp || null,
            answerIfA: conditionalAnswers.answerIfA,
            answerIfB: conditionalAnswers.answerIfB,
            variables: safeJsonParse(e.question.variables),
            causalStructure: e.question.causal_structure || null,
            domain: e.question.domain || null,
            subdomain: e.question.subdomain || null,
            difficulty: e.question.difficulty || null,
            dataset: e.question.dataset || null,
          },
        };
      } else if (e.t3_case) {
        // Parse conditional_answers and hidden_timestamp for export
        const conditionalAnswers = safeParseConditionalAnswers(e.t3_case.conditional_answers);
        const hiddenQuestion = e.t3_case.hidden_timestamp || null;
        
        const t3Data: any = {
          scenario: e.t3_case.scenario || null,
          pearlLevel: e.t3_case.pearl_level || null,
          label: e.t3_case.label || null,
          trapType: e.t3_case.trap_type || null,
          trapSubtype: e.t3_case.trap_subtype || null,
          variables: safeJsonParse(e.t3_case.variables),
          causalStructure: e.t3_case.causal_structure || null,
          keyInsight: e.t3_case.key_insight || null,
          hiddenQuestion,
          answerIfA: conditionalAnswers.answerIfA,
          answerIfB: conditionalAnswers.answerIfB,
          wiseRefusal: e.t3_case.wise_refusal || null,
          goldRationale: e.t3_case.gold_rationale || null,
          domain: e.t3_case.domain || null,
          subdomain: e.t3_case.subdomain || null,
          difficulty: e.t3_case.difficulty || null,
          dataset: e.t3_case.dataset || null,
        };
        
        // Add level-specific fields
        if (e.t3_case.pearl_level === 'L1') {
          t3Data.claim = e.t3_case.claim || null;
          t3Data.groundTruth = e.t3_case.label || null; // L1 uses YES/NO/AMBIGUOUS
        } else if (e.t3_case.pearl_level === 'L2') {
          t3Data.claim = e.t3_case.claim || null;
          t3Data.groundTruth = 'NO'; // All L2 are NO
        } else if (e.t3_case.pearl_level === 'L3') {
          t3Data.counterfactualClaim = e.t3_case.counterfactual_claim || null;
          t3Data.groundTruth = e.t3_case.label || null; // L3 uses VALID/INVALID/CONDITIONAL
          t3Data.family = e.t3_case.trap_type || null; // L3 uses trap_type for family
          t3Data.justification = e.t3_case.gold_rationale || null;
          t3Data.wiseResponse = e.t3_case.wise_refusal || null;
          t3Data.invariants = safeJsonParse(e.t3_case.invariants);
        }
        
        return {
          ...base,
          caseId: e.t3_case.id, // Ensure unique case ID
          caseData: t3Data,
        };
      }

      // Fallback for cases without question or t3_case
      return {
        ...base,
        caseId: base.caseId || `unknown-${e.id}`, // Generate fallback ID
        caseData: null,
      };
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
