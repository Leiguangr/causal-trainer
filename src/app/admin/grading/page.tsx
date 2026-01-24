'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  | { kind: 'legacy'; id: string; sourceCase: string | null; pearlLevel?: string | null; trapType?: string | null; groundTruth?: string | null; scenario?: string | null; dataset?: string | null }
  | { kind: 'L1'; id: string; sourceCase: string | null; groundTruth?: string | null; scenario?: string | null; dataset?: string | null }
  | { kind: 'L2'; id: string; sourceCase: string | null; scenario?: string | null; dataset?: string | null }
  | { kind: 'L3'; id: string; sourceCase: string | null; groundTruth?: string | null; scenario?: string | null; dataset?: string | null };

type CaseEvaluation = {
  id: string;
  evaluationBatchId: string | null;
  overallVerdict: string;
  priorityLevel: number;
  pearlLevelAssessment: string | null;
  trapTypeAssessment: string | null;
  groundTruthAssessment: string | null;
  hasAmbiguity: boolean;
  hasLogicalIssues: boolean;
  hasDomainErrors: boolean;
  clarityScore: number;
  rubricScore: string | null;
  suggestedCorrections: string | null;
  structuralNotes: string | null;
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

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function getVerdictColor(v: string) {
  if (v === 'APPROVED') return 'text-green-700 bg-green-50 border-green-200';
  if (v === 'NEEDS_REVIEW') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (v === 'REJECTED') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
}

function getPriorityLabel(p: number) {
  return p === 1 ? 'Urgent' : p === 2 ? 'Normal' : p === 3 ? 'Minor' : String(p);
}

function summarizeRubric(rubricScore: string | null): { total?: number; threshold?: number; version?: string } {
  const parsed = safeJsonParse<any>(rubricScore);
  if (!parsed || typeof parsed !== 'object') return {};
  return {
    total: typeof parsed.totalScore === 'number' ? parsed.totalScore : undefined,
    threshold: typeof parsed.acceptanceThreshold === 'number' ? parsed.acceptanceThreshold : undefined,
    version: typeof parsed.rubricVersion === 'string' ? parsed.rubricVersion : undefined,
  };
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
      dataset: e.l3Case.dataset ?? null,
    };
  }
  // fallback
  return { kind: 'legacy', id: e.id, sourceCase: null };
}

export default function GradingPage() {
  const [data, setData] = useState<GradingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [dataset, setDataset] = useState<string>('');
  const [evaluationBatchId, setEvaluationBatchId] = useState<string>('');
  const [caseType, setCaseType] = useState<string>('all');
  const [overallVerdict, setOverallVerdict] = useState<string>('');
  const [priorityLevel, setPriorityLevel] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

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
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="text-primary-600 hover:underline mb-2 inline-block">
            ← Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Grading Dashboard</h1>
          <p className="text-gray-600 mt-2">Browse auto-evaluator results across legacy + T3 cases</p>
        </div>

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
                  {new Date(b.createdAt).toLocaleString()} · {b.dataset || 'All'} · {b.completedCount}/{b.totalCount} · {b.status}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Showing <strong>{evaluations.length}</strong> of <strong>{total}</strong> evaluations. Page {page} of {pageCount}.
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Case Evaluations</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          {isLoading && <p className="text-gray-500">Loading…</p>}
          {!isLoading && evaluations.length === 0 && <p className="text-gray-500">No evaluations match the current filters.</p>}

          <div className="space-y-4">
            {evaluations.map((e) => {
              const c = getCaseFromEvaluation(e);
              const rubric = summarizeRubric(e.rubricScore);
              const title =
                c.kind === 'legacy'
                  ? `${c.sourceCase || e.questionId || 'legacy'} (${c.pearlLevel || '—'} / ${c.trapType || '—'})`
                  : `${c.sourceCase || (c as any).id} (${c.kind})`;

              const scenarioPreview = (c.scenario || '').slice(0, 220);

              return (
                <div key={e.id} className={`border rounded-lg p-4 ${getVerdictColor(e.overallVerdict)}`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{title}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Batch:{' '}
                        <span className="font-mono">
                          {e.evaluationBatchId ? e.evaluationBatchId.slice(0, 8) : '—'}
                        </span>{' '}
                        · Created {new Date(e.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="px-2 py-1 rounded text-xs font-bold border">{e.overallVerdict}</span>
                      <span className="text-xs">Priority: {getPriorityLabel(e.priorityLevel)}</span>
                    </div>
                  </div>

                  {scenarioPreview && <p className="text-sm text-gray-700 mt-2">{scenarioPreview}…</p>}

                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <span>Pearl: {e.pearlLevelAssessment || '—'}</span>
                    <span>Trap: {e.trapTypeAssessment || '—'}</span>
                    <span>GT: {e.groundTruthAssessment || '—'}</span>
                    <span>Clarity: {e.clarityScore}</span>
                    {e.hasAmbiguity && <span className="text-yellow-700">Ambiguity</span>}
                    {e.hasLogicalIssues && <span className="text-red-700">Logic</span>}
                    {e.hasDomainErrors && <span className="text-red-700">Domain</span>}
                    {typeof rubric.total === 'number' && (
                      <span>
                        Rubric: {rubric.total}
                        {typeof rubric.threshold === 'number' ? ` / ${rubric.threshold}` : ''}
                        {rubric.version ? ` (${rubric.version})` : ''}
                      </span>
                    )}
                  </div>

                  {(e.structuralNotes || e.suggestedCorrections) && (
                    <details className="mt-3">
                      <summary className="text-xs cursor-pointer">Details</summary>
                      <div className="mt-2 text-sm text-gray-800 space-y-2">
                        {e.structuralNotes && (
                          <div>
                            <div className="font-semibold text-xs text-gray-700">Notes</div>
                            <div className="whitespace-pre-wrap">{e.structuralNotes}</div>
                          </div>
                        )}
                        {e.suggestedCorrections && (
                          <div>
                            <div className="font-semibold text-xs text-gray-700">Suggested corrections</div>
                            <div className="whitespace-pre-wrap">{e.suggestedCorrections}</div>
                          </div>
                        )}
                        {e.rubricScore && (
                          <div>
                            <div className="font-semibold text-xs text-gray-700">Rubric JSON</div>
                            <pre className="whitespace-pre-wrap font-mono text-xs bg-white/60 border rounded p-2 overflow-x-auto">
                              {e.rubricScore}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

