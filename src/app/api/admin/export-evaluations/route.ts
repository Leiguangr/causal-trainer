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

      // Parse rubric score
      let rubricScore = null;
      try {
        if (e.rubric_score) {
          rubricScore = JSON.parse(e.rubric_score);
        }
      } catch {
        // Ignore parse errors
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

      // Add case-specific data
      if (e.question) {
        return {
          ...base,
          caseData: {
            scenario: e.question.scenario,
            claim: e.question.claim,
            pearlLevel: e.question.pearl_level,
            trapType: e.question.trap_type,
            trapSubtype: e.question.trap_subtype,
            groundTruth: e.question.ground_truth,
            explanation: e.question.explanation,
            wiseRefusal: e.question.wise_refusal,
            hiddenQuestion: e.question.hidden_timestamp,
            answerIfA: e.question.conditional_answers ? (JSON.parse(e.question.conditional_answers)?.answer_if_condition_1 || '') : '',
            answerIfB: e.question.conditional_answers ? (JSON.parse(e.question.conditional_answers)?.answer_if_condition_2 || '') : '',
            variables: e.question.variables,
            causalStructure: e.question.causal_structure,
            domain: e.question.domain,
            subdomain: e.question.subdomain,
            difficulty: e.question.difficulty,
            dataset: e.question.dataset,
          },
        };
      } else if (e.t3_case) {
        // Parse conditional_answers and hidden_timestamp for export
        let hiddenQuestion = e.t3_case.hidden_timestamp;
        let answerIfA = '';
        let answerIfB = '';
        if (e.t3_case.conditional_answers) {
          try {
            const parsed = JSON.parse(e.t3_case.conditional_answers);
            answerIfA = parsed.answer_if_condition_1 || parsed.answerIfA || '';
            answerIfB = parsed.answer_if_condition_2 || parsed.answerIfB || '';
          } catch {
            // ignore
          }
        }
        
        const t3Data: any = {
          scenario: e.t3_case.scenario,
          pearlLevel: e.t3_case.pearl_level,
          label: e.t3_case.label,
          trapType: e.t3_case.trap_type,
          trapSubtype: e.t3_case.trap_subtype || null,
          variables: e.t3_case.variables,
          causalStructure: e.t3_case.causal_structure,
          keyInsight: e.t3_case.key_insight,
          hiddenQuestion,
          answerIfA,
          answerIfB,
          wiseRefusal: e.t3_case.wise_refusal,
          goldRationale: e.t3_case.gold_rationale,
          domain: e.t3_case.domain,
          subdomain: e.t3_case.subdomain,
          difficulty: e.t3_case.difficulty,
          dataset: e.t3_case.dataset,
        };
        
        // Add level-specific fields
        if (e.t3_case.pearl_level === 'L1') {
          t3Data.claim = e.t3_case.claim;
          t3Data.groundTruth = e.t3_case.label; // L1 uses YES/NO/AMBIGUOUS
        } else if (e.t3_case.pearl_level === 'L2') {
          t3Data.claim = e.t3_case.claim;
          t3Data.groundTruth = 'NO'; // All L2 are NO
        } else if (e.t3_case.pearl_level === 'L3') {
          t3Data.counterfactualClaim = e.t3_case.counterfactual_claim;
          t3Data.groundTruth = e.t3_case.label; // L3 uses VALID/INVALID/CONDITIONAL
          t3Data.family = e.t3_case.trap_type; // L3 uses trap_type for family
          t3Data.justification = e.t3_case.gold_rationale;
          t3Data.wiseResponse = e.t3_case.wise_refusal;
          t3Data.invariants = e.t3_case.invariants;
        }
        
        return {
          ...base,
          caseData: t3Data,
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
