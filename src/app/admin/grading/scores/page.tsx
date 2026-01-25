'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RubricScoreDisplay from './RubricScoreDisplay';

type EvaluationBatch = {
  id: string;
  dataset: string | null;
  totalCount: number;
  completedCount: number;
  status: string;
  reportGenerated: boolean;
  createdAt: string;
};

type AnyCase =
  | {
      kind: 'legacy';
      id: string;
      sourceCase: string | null;
      pearlLevel?: string | null;
      trapType?: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      claim?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L1';
      id: string;
      sourceCase: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      claim?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L2';
      id: string;
      sourceCase: string | null;
      scenario?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L3';
      id: string;
      sourceCase: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      counterfactualClaim?: string | null;
      dataset?: string | null;
    };

type CaseEvaluation = {
  id: string;
  evaluationBatchId: string | null;
  overallVerdict: string;
  priorityLevel: number;
  pearlLevelAssessment: string | null;
  suggestedPearlLevel: string | null;
  trapTypeAssessment: string | null;
  suggestedTrapType: string | null;
  trapSubtypeAssessment: string | null;
  suggestedTrapSubtype: string | null;
  groundTruthAssessment: string | null;
  suggestedGroundTruth: string | null;
  hasAmbiguity: boolean;
  ambiguityNotes: string | null;
  hasLogicalIssues: boolean;
  logicalIssueNotes: string | null;
  hasDomainErrors: boolean;
  domainErrorNotes: string | null;
  clarityScore: number;
  difficultyAssessment: string | null;
  structuralNotes: string | null;
  causalGraphNotes: string | null;
  variableNotes: string | null;
  rubricScore: string | null;
  suggestedCorrections: string | null;
  createdAt: string;

  questionId: string | null;
  l1CaseId: string | null;
  l2CaseId: string | null;
  l3CaseId: string | null;

  evaluationBatch?: EvaluationBatch | null;
  question?: any;
  l1Case?: any;
  l2Case?: any;
  l3Case?: any;
};

type GradingResponse = {
  batches: EvaluationBatch[];
  page: number;
  pageSize: number;
  total: number;
  evaluations: CaseEvaluation[];
};

function getVerdictColor(v: string) {
  if (v === 'APPROVED') return 'text-green-700 bg-green-50 border-green-200';
  if (v === 'NEEDS_REVIEW') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (v === 'REJECTED') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
}

function getPriorityLabel(p: number) {
  return p === 1 ? 'Urgent' : p === 2 ? 'Normal' : p === 3 ? 'Minor' : String(p);
}

function getPriorityColor(p: number) {
  return p === 1 ? 'text-red-700 bg-red-50' : p === 2 ? 'text-yellow-700 bg-yellow-50' : 'text-gray-700 bg-gray-50';
}

function getCaseFromEvaluation(e: CaseEvaluation): AnyCase {
  if (e.question) {
    return {
      kind: 'legacy',
      id: e.question.id,
      sourceCase: e.question.sourceCase ?? null,
      pearlLevel: e.question.pearlLevel ?? null,
      trapType: e.question.trapType ?? null,
      groundTruth: e.question.groundTruth ?? null,
      scenario: e.question.scenario ?? null,
      claim: e.question.claim ?? null,
      dataset: e.question.dataset ?? null,
    };
  }
  if (e.l1Case) {
    return {
      kind: 'L1',
      id: e.l1Case.id,
      sourceCase: e.l1Case.sourceCase ?? null,
      groundTruth: e.l1Case.groundTruth ?? null,
      scenario: e.l1Case.scenario ?? null,
      claim: e.l1Case.claim ?? null,
      dataset: e.l1Case.dataset ?? null,
    };
  }
  if (e.l2Case) {
    return {
      kind: 'L2',
      id: e.l2Case.id,
      sourceCase: e.l2Case.sourceCase ?? null,
      scenario: e.l2Case.scenario ?? null,
      dataset: e.l2Case.dataset ?? null,
    };
  }
  if (e.l3Case) {
    return {
      kind: 'L3',
      id: e.l3Case.id,
      sourceCase: e.l3Case.sourceCase ?? null,
      groundTruth: e.l3Case.groundTruth ?? null,
      scenario: e.l3Case.scenario ?? null,
      counterfactualClaim: e.l3Case.counterfactualClaim ?? null,
      dataset: e.l3Case.dataset ?? null,
    };
  }
  // fallback
  return { kind: 'legacy', id: e.id, sourceCase: null };
}

export default function ScoresPage() {
  const [data, setData] = useState<GradingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [dataset, setDataset] = useState<string>('');
  const [evaluationBatchId, setEvaluationBatchId] = useState<string>('');
  const [caseType, setCaseType] = useState<string>('all');
  const [overallVerdict, setOverallVerdict] = useState<string>('');
  const [priorityLevel, setPriorityLevel] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20; // Smaller page size for detailed view

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (dataset) p.set('dataset', dataset);
    if (evaluationBatchId) p.set('evaluationBatchId', evaluationBatchId);
    if (caseType) p.set('caseType', caseType);
    if (overallVerdict) p.set('overallVerdict', overallVerdict);
    if (priorityLevel) p.set('priorityLevel', priorityLevel);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p.toString();
  }, [dataset, evaluationBatchId, caseType, overallVerdict, priorityLevel, page]);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/grading?${query}`);
        const json = (await res.json()) as GradingResponse;
        if (!res.ok) throw new Error((json as any).error || 'Failed to load');
        setData(json);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [query]);

  const batches = data?.batches ?? [];
  const evaluations = data?.evaluations ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="text-primary-600 hover:underline mb-2 inline-block">
            ← Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Case Evaluation Scores</h1>
              <p className="text-gray-600 mt-2">
                Detailed rubric scores and evaluation comments for each case
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/grading"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                List View
              </Link>
              <Link
                href="/admin/grading/dashboard"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Analytics Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              value={dataset}
              onChange={(e) => {
                setDataset(e.target.value);
                setPage(1);
              }}
              placeholder="dataset (optional)"
              className="border border-gray-300 rounded-lg px-3 py-2 md:col-span-2"
            />
            <select
              value={caseType}
              onChange={(e) => {
                setCaseType(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">All case types</option>
              <option value="legacy">Legacy (Question)</option>
              <option value="L1">L1Case</option>
              <option value="L2">L2Case</option>
              <option value="L3">L3Case</option>
            </select>
            <select
              value={overallVerdict}
              onChange={(e) => {
                setOverallVerdict(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All verdicts</option>
              <option value="APPROVED">APPROVED</option>
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            <select
              value={priorityLevel}
              onChange={(e) => {
                setPriorityLevel(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All priorities</option>
              <option value="1">Urgent</option>
              <option value="2">Normal</option>
              <option value="3">Minor</option>
            </select>
            <select
              value={evaluationBatchId}
              onChange={(e) => {
                setEvaluationBatchId(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 md:col-span-2"
            >
              <option value="">All evaluation batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {new Date(b.createdAt).toLocaleString()} · {b.dataset || 'All'} ·{' '}
                  {b.completedCount}/{b.totalCount} · {b.status}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Showing <strong>{evaluations.length}</strong> of <strong>{total}</strong> evaluations.
            Page {page} of {pageCount}.
          </div>
        </div>

        {/* Evaluations List */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading evaluations...</p>
          </div>
        )}

        {!isLoading && evaluations.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No evaluations match the current filters.</p>
          </div>
        )}

        <div className="space-y-6">
          {evaluations.map((e) => {
            const c = getCaseFromEvaluation(e);
            const title =
              c.kind === 'legacy'
                ? `${c.sourceCase || e.questionId || 'legacy'} (${c.pearlLevel || '—'} / ${c.trapType || '—'})`
                : `${c.sourceCase || c.id} (${c.kind})`;

            return (
              <div
                key={e.id}
                className={`bg-white border-2 rounded-lg p-6 ${getVerdictColor(e.overallVerdict)}`}
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                      <span className="px-2 py-1 rounded text-xs font-bold border bg-white/80">
                        {e.overallVerdict}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                          e.priorityLevel
                        )}`}
                      >
                        {getPriorityLabel(e.priorityLevel)} Priority
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-x-3">
                      <span>Dataset: {c.dataset || '—'}</span>
                      <span>·</span>
                      <span>
                        Batch:{' '}
                        <span className="font-mono">
                          {e.evaluationBatchId ? e.evaluationBatchId.slice(0, 8) : '—'}
                        </span>
                      </span>
                      <span>·</span>
                      <span>Created {new Date(e.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Case Content */}
                <div className="mb-6 space-y-3">
                  {c.scenario && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Scenario</h3>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.scenario}</p>
                    </div>
                  )}
                  {c.claim && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Claim</h3>
                      <p className="text-sm text-gray-800">{c.claim}</p>
                    </div>
                  )}
                  {c.kind === 'L3' && c.counterfactualClaim && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">
                        Counterfactual Claim
                      </h3>
                      <p className="text-sm text-gray-800">{c.counterfactualClaim}</p>
                    </div>
                  )}
                </div>

                {/* Rubric Score Section - Prominently Displayed */}
                <div className="mb-6">
                  <RubricScoreDisplay rubricScore={e.rubricScore} />
                </div>

                {/* Assessment Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessments</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pearl Level:</span>
                        <span className="font-medium">
                          {e.pearlLevelAssessment || '—'}
                          {e.suggestedPearlLevel && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggestedPearlLevel})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trap Type:</span>
                        <span className="font-medium">
                          {e.trapTypeAssessment || '—'}
                          {e.suggestedTrapType && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggestedTrapType})
                            </span>
                          )}
                        </span>
                      </div>
                      {e.trapSubtypeAssessment && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Trap Subtype:</span>
                          <span className="font-medium">
                            {e.trapSubtypeAssessment}
                            {e.suggestedTrapSubtype && (
                              <span className="text-gray-500 ml-1">
                                (suggested: {e.suggestedTrapSubtype})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ground Truth:</span>
                        <span className="font-medium">
                          {e.groundTruthAssessment || '—'}
                          {e.suggestedGroundTruth && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggestedGroundTruth})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Clarity Score:</span>
                        <span className="font-medium">{e.clarityScore} / 5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Difficulty:</span>
                        <span className="font-medium">{e.difficultyAssessment || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quality Flags */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality Flags</h3>
                    <div className="space-y-3">
                      {e.hasAmbiguity && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-yellow-700 font-medium text-sm">⚠ Ambiguity</span>
                          </div>
                          {e.ambiguityNotes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.ambiguityNotes}
                            </p>
                          )}
                        </div>
                      )}
                      {e.hasLogicalIssues && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-700 font-medium text-sm">
                              ⚠ Logical Issues
                            </span>
                          </div>
                          {e.logicalIssueNotes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.logicalIssueNotes}
                            </p>
                          )}
                        </div>
                      )}
                      {e.hasDomainErrors && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-700 font-medium text-sm">
                              ⚠ Domain Errors
                            </span>
                          </div>
                          {e.domainErrorNotes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.domainErrorNotes}
                            </p>
                          )}
                        </div>
                      )}
                      {!e.hasAmbiguity && !e.hasLogicalIssues && !e.hasDomainErrors && (
                        <p className="text-xs text-gray-500">No quality issues flagged</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Notes - Expandable */}
                {(e.structuralNotes ||
                  e.causalGraphNotes ||
                  e.variableNotes ||
                  e.suggestedCorrections) && (
                  <details className="mt-4">
                    <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                      Detailed Analysis & Notes
                    </summary>
                    <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-200">
                      {e.structuralNotes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Structural Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.structuralNotes}
                          </p>
                        </div>
                      )}
                      {e.causalGraphNotes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Causal Graph Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.causalGraphNotes}
                          </p>
                        </div>
                      )}
                      {e.variableNotes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Variable Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.variableNotes}
                          </p>
                        </div>
                      )}
                      {e.suggestedCorrections && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Suggested Corrections
                          </h4>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap bg-yellow-50 border border-yellow-200 rounded p-3">
                            {e.suggestedCorrections}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {evaluations.length > 0 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">
              Page {page} of {pageCount} ({total} total evaluations)
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
