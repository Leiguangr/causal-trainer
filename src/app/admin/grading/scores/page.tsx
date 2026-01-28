'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RubricScoreDisplay from './RubricScoreDisplay';

type EvaluationBatch = {
  id: string;
  dataset: string | null;
  total_count: number;
  completed_count: number;
  status: string;
  report_generated: boolean;
  created_at: string;
  completed_at: string | null;
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
  evaluation_batch_id: string | null;
  overall_verdict: string;
  priority_level: number;
  pearl_level_assessment: string | null;
  suggested_pearl_level: string | null;
  trap_type_assessment: string | null;
  suggested_trap_type: string | null;
  trap_subtype_assessment: string | null;
  suggested_trap_subtype: string | null;
  ground_truth_assessment: string | null;
  suggested_ground_truth: string | null;
  has_ambiguity: boolean;
  ambiguity_notes: string | null;
  has_logical_issues: boolean;
  logical_issue_notes: string | null;
  has_domain_errors: boolean;
  domain_error_notes: string | null;
  clarity_score: number;
  difficulty_assessment: string | null;
  structural_notes: string | null;
  causal_graph_notes: string | null;
  variable_notes: string | null;
  rubric_score: string | null;
  suggested_corrections: string | null;
  created_at: string;

  question_id: string | null;
  t3_case_id: string | null;

  evaluation_batch?: EvaluationBatch | null;
  question?: any;
  t3_case?: any;
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
      sourceCase: e.question.source_case ?? null,
      pearlLevel: e.question.pearl_level ?? null,
      trapType: e.question.trap_type ?? null,
      trapSubtype: e.question.trap_subtype ?? null,
      groundTruth: e.question.ground_truth ?? null,
      scenario: e.question.scenario ?? null,
      claim: e.question.claim ?? null,
      explanation: e.question.explanation ?? null,
      wiseRefusal: e.question.wise_refusal ?? null,
      hiddenQuestion: e.question.hidden_timestamp ?? null,
      answerIfA: e.question.conditional_answers ? (() => {
        try {
          const parsed = JSON.parse(e.question.conditional_answers);
          return parsed?.answer_if_condition_1 || parsed?.answerIfA || null;
        } catch {
          return null;
        }
      })() : null,
      answerIfB: e.question.conditional_answers ? (() => {
        try {
          const parsed = JSON.parse(e.question.conditional_answers);
          return parsed?.answer_if_condition_2 || parsed?.answerIfB || null;
        } catch {
          return null;
        }
      })() : null,
      variables: e.question.variables ?? null,
      causalStructure: e.question.causal_structure ?? null,
      domain: e.question.domain ?? null,
      subdomain: e.question.subdomain ?? null,
      difficulty: e.question.difficulty ?? null,
      dataset: e.question.dataset ?? null,
    };
  }
  if (e.t3_case) {
    // Parse conditional_answers and hidden_timestamp
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
    
    const base = {
      kind: e.t3_case.pearl_level as 'L1' | 'L2' | 'L3',
      id: e.t3_case.id,
      sourceCase: e.t3_case.source_case ?? null,
      groundTruth: e.t3_case.label ?? null,
      scenario: e.t3_case.scenario ?? null,
      variables: e.t3_case.variables ?? null,
      causalStructure: e.t3_case.causal_structure ?? null,
      domain: e.t3_case.domain ?? null,
      subdomain: e.t3_case.subdomain ?? null,
      difficulty: e.t3_case.difficulty ?? null,
      dataset: e.t3_case.dataset ?? null,
      hiddenQuestion,
      answerIfA,
      answerIfB,
      wiseRefusal: e.t3_case.wise_refusal ?? null,
      trapType: e.t3_case.trap_type ?? null,
    };
    
    if (e.t3_case.pearl_level === 'L1') {
      return {
        ...base,
        claim: e.t3_case.claim ?? null,
        whyFlawedOrValid: e.t3_case.gold_rationale ?? null,
        evidenceClass: null, // Not in unified schema
        evidenceType: e.t3_case.trap_subtype ?? null,
      };
    } else if (e.t3_case.pearl_level === 'L2') {
      return {
        ...base,
        claim: e.t3_case.claim ?? null,
      };
    } else {
      return {
        ...base,
        counterfactualClaim: e.t3_case.counterfactual_claim ?? null,
        justification: e.t3_case.gold_rationale ?? null,
        wiseResponse: e.t3_case.wise_refusal ?? null,
        family: e.t3_case.trap_type ?? null, // L3 uses trap_type for family
        invariants: e.t3_case.invariants ?? null,
      };
    }
  }
  // fallback
  return { kind: 'legacy', id: e.id, sourceCase: null };
}

export default function ScoresPage() {
  const [data, setData] = useState<GradingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyProgress, setCopyProgress] = useState<{
    isActive: boolean;
    processed: number;
    total: number;
    skipped: number;
    skipReasons?: { invalidPearlLevel: number };
    byType: { L1: number; L2: number; L3: number };
    status: string;
    errors: number;
  } | null>(null);

  const [dataset, setDataset] = useState<string>('');
  const [evaluationBatchId, setEvaluationBatchId] = useState<string>('');
  const [caseType, setCaseType] = useState<string>('all');
  const [overallVerdict, setOverallVerdict] = useState<string>('');
  const [priorityLevel, setPriorityLevel] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortOrder, setSortOrder] = useState<string>('asc');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showCaseList, setShowCaseList] = useState<boolean>(false);
  const [bulkReviseProgress, setBulkReviseProgress] = useState<{
    isActive: boolean;
    processed: number;
    total: number;
    status: string;
  } | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (dataset) p.set('dataset', dataset);
    if (evaluationBatchId) p.set('evaluationBatchId', evaluationBatchId);
    if (caseType) p.set('caseType', caseType);
    if (overallVerdict) p.set('overallVerdict', overallVerdict);
    if (priorityLevel) p.set('priorityLevel', priorityLevel);
    p.set('sortBy', sortBy);
    p.set('sortOrder', sortOrder);
    p.set('page', '1');
    p.set('pageSize', '500'); // Load all matching evaluations
    return p.toString();
  }, [dataset, evaluationBatchId, caseType, overallVerdict, priorityLevel, sortBy, sortOrder]);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/grading?${query}`, { cache: 'no-store' });
        const json = (await res.json()) as GradingResponse;
        if (!res.ok) throw new Error((json as any).error || 'Failed to load');
        setData(json);
        // Reset to first evaluation when filters change
        setCurrentIndex(0);
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
  
  // Get flagged cases (NEEDS_REVIEW or REJECTED)
  const flaggedEvaluations = evaluations.filter(e => 
    e.overall_verdict === 'NEEDS_REVIEW' || e.overall_verdict === 'REJECTED'
  );
  
  const currentEvaluation = evaluations[currentIndex] || null;

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
                  if (!confirm('Copy all APPROVED legacy cases to the new schema? This will create new L1/L2/L3 cases based on their pearl level. All fields will be validated and transformed using LLM.')) return;
                  
                  // Prompt for target dataset name (optional)
                  const targetDataset = prompt('Enter target dataset name (leave empty to auto-generate):', '');
                  
                  // Start progress tracking
                  setCopyProgress({
                    isActive: true,
                    processed: 0,
                    total: 0,
                    skipped: 0,
                    byType: { L1: 0, L2: 0, L3: 0 },
                    status: 'Starting...',
                    errors: 0,
                  });

                  try {
                    const res = await fetch('/api/admin/copy-approved-legacy-cases', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dataset: dataset || undefined,
                        targetDataset: targetDataset || undefined,
                        streamProgress: true,
                      }),
                    });

                    if (!res.ok) {
                      const error = await res.json();
                      setCopyProgress(null);
                      alert(`Failed to copy: ${error.error || 'Unknown error'}`);
                      return;
                    }

                    // Handle streaming response
                    const reader = res.body?.getReader();
                    const decoder = new TextDecoder();

                    if (!reader) {
                      setCopyProgress(null);
                      alert('Failed to start copy operation');
                      return;
                    }

                    let buffer = '';
                    let finalResult: any = null;

                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;

                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() || '';

                      for (const line of lines) {
                        if (line.startsWith('data: ')) {
                          try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'start') {
                              setCopyProgress(prev => prev ? {
                                ...prev,
                                total: data.total,
                                status: `Found ${data.total} cases to copy`,
                              } : null);
                            } else if (data.type === 'progress') {
                              setCopyProgress(prev => prev ? {
                                ...prev,
                                processed: data.processed,
                                total: data.total,
                                skipped: data.skipped,
                                skipReasons: data.skipReasons || prev?.skipReasons,
                                byType: data.byType,
                                status: data.status,
                                errors: data.errors || 0,
                              } : null);
                            } else if (data.type === 'complete') {
                              finalResult = data;
                              setCopyProgress(prev => prev ? {
                                ...prev,
                                processed: prev.total, // Show all processed
                                total: prev.total,
                                skipped: data.skippedCount || prev.skipped,
                                skipReasons: data.skipReasons || prev?.skipReasons,
                                byType: data.byType,
                                status: 'Complete!',
                                errors: data.errors?.length || 0,
                              } : null);
                            } else if (data.type === 'error') {
                              setCopyProgress(null);
                              alert(`Error: ${data.error}`);
                              return;
                            }
                          } catch (e) {
                            console.error('Error parsing progress data:', e);
                          }
                        }
                      }
                    }

                    // Show completion message
                    if (finalResult) {
                      setTimeout(() => {
                        alert(`Successfully copied ${finalResult.copiedCount} approved legacy cases to new schema in dataset "${finalResult.targetDataset}":\n- L1: ${finalResult.byType.L1}\n- L2: ${finalResult.byType.L2}\n- L3: ${finalResult.byType.L3}${finalResult.errors?.length > 0 ? `\n\n${finalResult.errors.length} errors occurred` : ''}\n\nRefreshing...`);
                        setCopyProgress(null);
                        window.location.reload();
                      }, 1000);
                    } else {
                      setCopyProgress(null);
                    }
                  } catch (error) {
                    console.error('Copy error:', error);
                    setCopyProgress(null);
                    alert('Failed to copy approved legacy cases');
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                disabled={copyProgress?.isActive}
              >
                {copyProgress?.isActive ? 'Copying...' : 'Copy Approved Legacy Cases to New Schema'}
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

        {/* Copy Progress Modal */}
        {copyProgress?.isActive && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Copying Legacy Cases</h2>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>
                    {copyProgress.processed} / {copyProgress.total} processed
                    {copyProgress.skipped > 0 && ` (${copyProgress.skipped} skipped)`}
                    {copyProgress.errors > 0 && ` (${copyProgress.errors} errors)`}
                  </span>
                  <span>{copyProgress.total > 0 ? Math.round((copyProgress.processed / copyProgress.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-purple-600 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: copyProgress.total > 0 ? `${(copyProgress.processed / copyProgress.total) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <p className="text-sm text-gray-700 font-medium mb-2">Status:</p>
                <p className="text-sm text-gray-600">{copyProgress.status}</p>
              </div>

              {/* Breakdown by Type */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600 font-medium">L1 Cases</div>
                  <div className="text-2xl font-bold text-blue-700">{copyProgress.byType.L1}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 font-medium">L2 Cases</div>
                  <div className="text-2xl font-bold text-green-700">{copyProgress.byType.L2}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-xs text-purple-600 font-medium">L3 Cases</div>
                  <div className="text-2xl font-bold text-purple-700">{copyProgress.byType.L3}</div>
                </div>
              </div>

              {/* Skip reasons */}
              {copyProgress.skipped > 0 && copyProgress.skipReasons && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    ⚠️ {copyProgress.skipped} case{copyProgress.skipped !== 1 ? 's' : ''} skipped:
                  </p>
                  <ul className="text-xs text-yellow-700 space-y-1 ml-4">
                    {copyProgress.skipReasons.invalidPearlLevel > 0 && (
                      <li>• {copyProgress.skipReasons.invalidPearlLevel} invalid pearl level (not L1/L2/L3)</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Error indicator */}
              {copyProgress.errors > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">
                    ⚠️ {copyProgress.errors} error{copyProgress.errors !== 1 ? 's' : ''} occurred during copy
                  </p>
                </div>
              )}

              {/* Loading indicator */}
              {copyProgress.status !== 'Complete!' && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Filters & Sorting</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
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
                  {new Date(b.created_at).toLocaleString()} · {b.dataset || 'All'} ·{' '}
                  {b.completed_count}/{b.total_count} · {b.status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full"
              >
                <option value="priority">Priority Level</option>
                <option value="caseType">Case Type (L1/L2/L3)</option>
                <option value="created">Created Date</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Showing <strong>{evaluations.length}</strong> of <strong>{total}</strong> evaluations.
            {flaggedEvaluations.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                {flaggedEvaluations.length} flagged for revision
              </span>
            )}
          </div>
        </div>

        {/* Bulk Revise Button */}
        {flaggedEvaluations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bulk Revision</h3>
                <p className="text-sm text-gray-600">
                  {flaggedEvaluations.length} cases flagged (NEEDS_REVIEW or REJECTED)
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`Revise all ${flaggedEvaluations.length} flagged cases using LLM? This will process them one by one.`)) return;
                  
                  setBulkReviseProgress({
                    isActive: true,
                    processed: 0,
                    total: flaggedEvaluations.length,
                    status: 'Starting bulk revision...',
                  });

                  let successCount = 0;
                  let errorCount = 0;

                  for (let i = 0; i < flaggedEvaluations.length; i++) {
                    const e = flaggedEvaluations[i];
                    const c = getCaseFromEvaluation(e);
                    
                    setBulkReviseProgress({
                      isActive: true,
                      processed: i,
                      total: flaggedEvaluations.length,
                      status: `Revising ${c.kind} case ${i + 1} of ${flaggedEvaluations.length}...`,
                    });

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
                        successCount++;
                      } else {
                        errorCount++;
                      }
                    } catch (error) {
                      console.error('Revise error:', error);
                      errorCount++;
                    }
                  }

                  setBulkReviseProgress({
                    isActive: true,
                    processed: flaggedEvaluations.length,
                    total: flaggedEvaluations.length,
                    status: 'Complete!',
                  });

                  setTimeout(() => {
                    alert(`Bulk revision complete!\n- Successfully revised: ${successCount}\n- Errors: ${errorCount}\n\nRefreshing...`);
                    setBulkReviseProgress(null);
                    window.location.reload();
                  }, 1000);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                disabled={bulkReviseProgress?.isActive}
              >
                {bulkReviseProgress?.isActive ? 'Revising...' : `Bulk Revise ${flaggedEvaluations.length} Flagged Cases`}
              </button>
            </div>
            {bulkReviseProgress?.isActive && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{bulkReviseProgress.status}</span>
                  <span>
                    {bulkReviseProgress.processed} / {bulkReviseProgress.total} ({Math.round((bulkReviseProgress.processed / bulkReviseProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${(bulkReviseProgress.processed / bulkReviseProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evaluations Display */}
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

        {!isLoading && evaluations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Case Selection Dropdown */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Evaluation ({currentIndex + 1} of {evaluations.length})
                </label>
                <div className="relative">
                  <select
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number.parseInt(e.target.value, 10))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium bg-white"
                  >
                    {evaluations.map((e, idx) => {
                      const c = getCaseFromEvaluation(e);
                      const title = c.kind === 'legacy'
                        ? `${c.sourceCase || e.question_id || 'legacy'} (${c.pearlLevel || '—'} / ${c.trapType || '—'})`
                        : `${c.sourceCase || c.id} (${c.kind})`;
                      return (
                        <option key={e.id} value={idx}>
                          [{e.overall_verdict}] {title} - {getPriorityLabel(e.priority_level)} Priority
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setCurrentIndex(Math.min(evaluations.length - 1, currentIndex + 1))}
                  disabled={currentIndex >= evaluations.length - 1}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Single Evaluation Display */}
            {currentEvaluation && (() => {
              const e = currentEvaluation;
              const c = getCaseFromEvaluation(e);
              const title = c.kind === 'legacy'
                ? `${c.sourceCase || e.question_id || 'legacy'} (${c.pearlLevel || '—'} / ${c.trapType || '—'})`
                : `${c.sourceCase || c.id} (${c.kind})`;

              return (
                <div
                  key={e.id}
                  className={`border-2 rounded-lg p-6 ${getVerdictColor(e.overall_verdict)}`}
                >
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        <span className="px-2 py-1 rounded text-xs font-bold border bg-white/80">
                          {e.overall_verdict}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                            e.priority_level
                          )}`}
                        >
                          {getPriorityLabel(e.priority_level)} Priority
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-x-3">
                        <span>Dataset: {c.dataset || '—'}</span>
                        <span>·</span>
                        <span>
                          Batch:{' '}
                          <span className="font-mono">
                            {e.evaluation_batch_id ? e.evaluation_batch_id.slice(0, 8) : '—'}
                          </span>
                        </span>
                        <span>·</span>
                        <span>Created {new Date(e.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mb-4 flex-wrap">
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
                  <RubricScoreDisplay rubricScore={e.rubric_score} />
                </div>

                {/* Assessment Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessments</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pearl Level:</span>
                        <span className="font-medium">
                          {e.pearl_level_assessment || '—'}
                          {e.suggested_pearl_level && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggested_pearl_level})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trap Type:</span>
                        <span className="font-medium">
                          {e.trap_type_assessment || '—'}
                          {e.suggested_trap_type && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggested_trap_type})
                            </span>
                          )}
                        </span>
                      </div>
                      {e.trap_subtype_assessment && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Trap Subtype:</span>
                          <span className="font-medium">
                            {e.trap_subtype_assessment}
                            {e.suggested_trap_subtype && (
                              <span className="text-gray-500 ml-1">
                                (suggested: {e.suggested_trap_subtype})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ground Truth:</span>
                        <span className="font-medium">
                          {e.ground_truth_assessment || '—'}
                          {e.suggested_ground_truth && (
                            <span className="text-gray-500 ml-1">
                              (suggested: {e.suggested_ground_truth})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Clarity Score:</span>
                        <span className="font-medium">{e.clarity_score} / 5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Difficulty:</span>
                        <span className="font-medium">{e.difficulty_assessment || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quality Flags */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality Flags</h3>
                    <div className="space-y-3">
                      {e.has_ambiguity && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-yellow-700 font-medium text-sm">⚠ Ambiguity</span>
                          </div>
                          {e.ambiguity_notes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.ambiguity_notes}
                            </p>
                          )}
                        </div>
                      )}
                      {e.has_logical_issues && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-700 font-medium text-sm">
                              ⚠ Logical Issues
                            </span>
                          </div>
                          {e.logical_issue_notes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.logical_issue_notes}
                            </p>
                          )}
                        </div>
                      )}
                      {e.has_domain_errors && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-700 font-medium text-sm">
                              ⚠ Domain Errors
                            </span>
                          </div>
                          {e.domain_error_notes && (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {e.domain_error_notes}
                            </p>
                          )}
                        </div>
                      )}
                      {!e.has_ambiguity && !e.has_logical_issues && !e.has_domain_errors && (
                        <p className="text-xs text-gray-500">No quality issues flagged</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Notes - Expandable */}
                {(e.structural_notes ||
                  e.causal_graph_notes ||
                  e.variable_notes ||
                  e.suggested_corrections) && (
                  <details className="mt-4">
                    <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                      Detailed Analysis & Notes
                    </summary>
                    <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-200">
                      {e.structural_notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Structural Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.structural_notes}
                          </p>
                        </div>
                      )}
                      {e.causal_graph_notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Causal Graph Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.causal_graph_notes}
                          </p>
                        </div>
                      )}
                      {e.variable_notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Variable Notes
                          </h4>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {e.variable_notes}
                          </p>
                        </div>
                      )}
                      {e.suggested_corrections && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">
                            Suggested Corrections
                          </h4>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap bg-yellow-50 border border-yellow-200 rounded p-3">
                            {e.suggested_corrections}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
