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
      trapSubtype?: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      claim?: string | null;
      explanation?: string | null;
      wiseRefusal?: string | null;
      hiddenQuestion?: string | null;
      answerIfA?: string | null;
      answerIfB?: string | null;
      variables?: string | null;
      causalStructure?: string | null;
      domain?: string | null;
      subdomain?: string | null;
      difficulty?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L1';
      id: string;
      sourceCase: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      claim?: string | null;
      whyFlawedOrValid?: string | null;
      evidenceClass?: string | null;
      evidenceType?: string | null;
      variables?: string | null;
      causalStructure?: string | null;
      domain?: string | null;
      subdomain?: string | null;
      difficulty?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L2';
      id: string;
      sourceCase: string | null;
      scenario?: string | null;
      hiddenQuestion?: string | null;
      answerIfA?: string | null;
      answerIfB?: string | null;
      wiseRefusal?: string | null;
      trapType?: string | null;
      variables?: string | null;
      causalStructure?: string | null;
      difficulty?: string | null;
      dataset?: string | null;
    }
  | {
      kind: 'L3';
      id: string;
      sourceCase: string | null;
      groundTruth?: string | null;
      scenario?: string | null;
      counterfactualClaim?: string | null;
      justification?: string | null;
      wiseResponse?: string | null;
      family?: string | null;
      domain?: string | null;
      variables?: string | null;
      invariants?: string | null;
      difficulty?: string | null;
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
      trapSubtype: e.question.trapSubtype ?? null,
      groundTruth: e.question.groundTruth ?? null,
      scenario: e.question.scenario ?? null,
      claim: e.question.claim ?? null,
      explanation: e.question.explanation ?? null,
      wiseRefusal: e.question.wiseRefusal ?? null,
      hiddenQuestion: e.question.hiddenQuestion ?? null,
      answerIfA: e.question.answerIfA ?? null,
      answerIfB: e.question.answerIfB ?? null,
      variables: e.question.variables ?? null,
      causalStructure: e.question.causalStructure ?? null,
      domain: e.question.domain ?? null,
      subdomain: e.question.subdomain ?? null,
      difficulty: e.question.difficulty ?? null,
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
      whyFlawedOrValid: e.l1Case.whyFlawedOrValid ?? null,
      evidenceClass: e.l1Case.evidenceClass ?? null,
      evidenceType: e.l1Case.evidenceType ?? null,
      variables: e.l1Case.variables ?? null,
      causalStructure: e.l1Case.causalStructure ?? null,
      domain: e.l1Case.domain ?? null,
      subdomain: e.l1Case.subdomain ?? null,
      difficulty: e.l1Case.difficulty ?? null,
      dataset: e.l1Case.dataset ?? null,
    };
  }
  if (e.l2Case) {
    return {
      kind: 'L2',
      id: e.l2Case.id,
      sourceCase: e.l2Case.sourceCase ?? null,
      scenario: e.l2Case.scenario ?? null,
      hiddenQuestion: e.l2Case.hiddenQuestion ?? null,
      answerIfA: e.l2Case.answerIfA ?? null,
      answerIfB: e.l2Case.answerIfB ?? null,
      wiseRefusal: e.l2Case.wiseRefusal ?? null,
      trapType: e.l2Case.trapType ?? null,
      variables: e.l2Case.variables ?? null,
      causalStructure: e.l2Case.causalStructure ?? null,
      difficulty: e.l2Case.difficulty ?? null,
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
      justification: e.l3Case.justification ?? null,
      wiseResponse: e.l3Case.wiseResponse ?? null,
      family: e.l3Case.family ?? null,
      domain: e.l3Case.domain ?? null,
      variables: e.l3Case.variables ?? null,
      invariants: e.l3Case.invariants ?? null,
      difficulty: e.l3Case.difficulty ?? null,
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    const params = new URLSearchParams();
                    if (dataset) params.set('dataset', dataset);
                    if (evaluationBatchId) params.set('evaluationBatchId', evaluationBatchId);
                    if (caseType !== 'all') params.set('caseType', caseType);
                    if (overallVerdict) params.set('overallVerdict', overallVerdict);
                    params.set('format', 'json');
                    
                    const url = `/api/admin/export-evaluations?${params.toString()}`;
                    window.open(url, '_blank');
                  } catch (error) {
                    console.error('Export error:', error);
                    alert('Failed to export evaluations');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Export Evaluations
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Copy all APPROVED legacy cases to the new schema? This will create new L1/L2/L3 cases based on their pearl level.')) return;
                  try {
                    const res = await fetch('/api/admin/copy-approved-legacy-cases', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dataset: dataset || undefined,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      alert(`Successfully copied ${data.copiedCount} approved legacy cases to new schema:\n- L1: ${data.byType.L1}\n- L2: ${data.byType.L2}\n- L3: ${data.byType.L3}\n\nRefreshing...`);
                      window.location.reload();
                    } else {
                      const error = await res.json();
                      alert(`Failed to copy: ${error.error || 'Unknown error'}`);
                    }
                  } catch (error) {
                    console.error('Copy error:', error);
                    alert('Failed to copy approved legacy cases');
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Copy Approved Legacy Cases to New Schema
              </button>
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

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={async () => {
                      if (!confirm(`Use LLM to revise this ${c.kind} case based on the rubric feedback?`)) return;
                      try {
                        const res = await fetch('/api/admin/revise-case', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            caseId: c.id,
                            caseType: c.kind,
                            evaluationId: e.id,
                          }),
                        });
                        if (res.ok) {
                          alert('Case revised successfully! Refreshing...');
                          window.location.reload();
                        } else {
                          const error = await res.json();
                          alert(`Failed to revise: ${error.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Revise error:', error);
                        alert('Failed to revise case');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    LLM Revise
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete this ${c.kind} case? This will also delete its evaluation.`)) return;
                      try {
                        const endpoint = c.kind === 'legacy' 
                          ? `/api/admin/questions/${c.id}`
                          : `/api/admin/t3-cases/${c.id}`;
                        const res = await fetch(endpoint, { method: 'DELETE' });
                        if (res.ok) {
                          alert('Case deleted. Refreshing...');
                          window.location.reload();
                        } else {
                          const error = await res.json();
                          alert(`Failed to delete: ${error.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Delete error:', error);
                        alert('Failed to delete case');
                      }
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>

                {/* Case Content - Expanded */}
                <div className="mb-6 space-y-4 bg-gray-50 rounded-lg p-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Case Data</h3>
                  
                  {c.scenario && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Scenario</h4>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-2 rounded border">{c.scenario}</p>
                    </div>
                  )}
                  
                  {c.claim && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Claim</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border">{c.claim}</p>
                    </div>
                  )}

                  {c.kind === 'L3' && c.counterfactualClaim && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Counterfactual Claim</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border">{c.counterfactualClaim}</p>
                    </div>
                  )}

                  {c.kind === 'L1' && c.whyFlawedOrValid && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Why Flawed/Valid</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.whyFlawedOrValid}</p>
                    </div>
                  )}

                  {c.kind === 'L3' && c.justification && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Justification</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.justification}</p>
                    </div>
                  )}

                  {(c.kind === 'legacy' || c.kind === 'L2') && c.wiseRefusal && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Wise Refusal</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.wiseRefusal}</p>
                    </div>
                  )}

                  {c.kind === 'L3' && c.wiseResponse && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Wise Response</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.wiseResponse}</p>
                    </div>
                  )}

                  {c.kind === 'legacy' && c.explanation && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Explanation</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.explanation}</p>
                    </div>
                  )}

                  {(c.kind === 'L2' || c.kind === 'legacy') && c.hiddenQuestion && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Hidden Question</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border">{c.hiddenQuestion}</p>
                    </div>
                  )}

                  {(c.kind === 'L2' || c.kind === 'legacy') && c.answerIfA && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Answer If A</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.answerIfA}</p>
                    </div>
                  )}

                  {(c.kind === 'L2' || c.kind === 'legacy') && c.answerIfB && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Answer If B</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border whitespace-pre-wrap">{c.answerIfB}</p>
                    </div>
                  )}

                  {c.variables && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Variables</h4>
                      <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                          {(() => {
                            try {
                              const parsed = typeof c.variables === 'string' ? JSON.parse(c.variables) : c.variables;
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return c.variables;
                            }
                          })()}
                        </pre>
                      </div>
                    </div>
                  )}

                  {c.kind === 'L3' && c.invariants && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Invariants</h4>
                      <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                          {(() => {
                            try {
                              const parsed = typeof c.invariants === 'string' ? JSON.parse(c.invariants) : c.invariants;
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return c.invariants;
                            }
                          })()}
                        </pre>
                      </div>
                    </div>
                  )}

                  {c.causalStructure && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Causal Structure</h4>
                      <p className="text-sm text-gray-800 bg-white p-2 rounded border">{c.causalStructure}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {c.domain && (
                      <div>
                        <span className="text-gray-600">Domain:</span> <span className="font-medium">{c.domain}</span>
                      </div>
                    )}
                    {c.subdomain && (
                      <div>
                        <span className="text-gray-600">Subdomain:</span> <span className="font-medium">{c.subdomain}</span>
                      </div>
                    )}
                    {c.difficulty && (
                      <div>
                        <span className="text-gray-600">Difficulty:</span> <span className="font-medium">{c.difficulty}</span>
                      </div>
                    )}
                    {c.kind === 'L1' && c.evidenceClass && (
                      <div>
                        <span className="text-gray-600">Evidence Class:</span> <span className="font-medium">{c.evidenceClass}</span>
                      </div>
                    )}
                    {c.kind === 'L1' && c.evidenceType && (
                      <div>
                        <span className="text-gray-600">Evidence Type:</span> <span className="font-medium">{c.evidenceType}</span>
                      </div>
                    )}
                    {c.kind === 'L2' && c.trapType && (
                      <div>
                        <span className="text-gray-600">Trap Type:</span> <span className="font-medium">{c.trapType}</span>
                      </div>
                    )}
                    {c.kind === 'L3' && c.family && (
                      <div>
                        <span className="text-gray-600">Family:</span> <span className="font-medium">{c.family}</span>
                      </div>
                    )}
                    {c.kind === 'legacy' && c.trapType && (
                      <div>
                        <span className="text-gray-600">Trap Type:</span> <span className="font-medium">{c.trapType}</span>
                      </div>
                    )}
                    {c.kind === 'legacy' && c.trapSubtype && (
                      <div>
                        <span className="text-gray-600">Trap Subtype:</span> <span className="font-medium">{c.trapSubtype}</span>
                      </div>
                    )}
                    {c.groundTruth && (
                      <div>
                        <span className="text-gray-600">Ground Truth:</span> <span className="font-medium">{c.groundTruth}</span>
                      </div>
                    )}
                  </div>
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
