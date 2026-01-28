'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EvaluationBatch {
  id: string;
  dataset: string | null;
  total_count: number;
  completed_count: number;
  status: string;
  report_generated: boolean;
  created_at: string;
}

interface CaseEvaluation {
  id: string;
  question_id?: string | null;
  t3_case_id?: string | null;
  pearl_level_assessment: string;
  trap_type_assessment: string;
  ground_truth_assessment: string;
  has_ambiguity: boolean;
  has_logical_issues: boolean;
  overall_verdict: string;
  priority_level: number;
  suggested_corrections: string | null;
  structural_notes: string | null;
  question?: {
    id: string;
    source_case: string | null;
    scenario: string;
    pearl_level: string;
    trap_type: string;
    ground_truth: string;
  } | null;
  t3_case?: {
    id: string;
    source_case: string | null;
    scenario: string;
    pearl_level: string;
    trap_type: string;
    label: string;
  } | null;
}

interface Dataset { name: string; totalCount: number; }

export default function EvaluatePage() {
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(true);
  const [caseType, setCaseType] = useState<'legacy' | 't3' | 'auto'>('auto');
  const [t3CaseType, setT3CaseType] = useState<'L1' | 'L2' | 'L3' | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<EvaluationBatch | null>(null);
  const [evaluations, setEvaluations] = useState<CaseEvaluation[]>([]);
  const [report, setReport] = useState('');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => { fetchBatches(); fetchDatasets(); }, []);

  useEffect(() => {
    if (currentBatch?.status === 'running') {
      const interval = setInterval(async () => {
        // Try both endpoints to support both legacy and T3 evaluations
        let res = await fetch(`/api/admin/evaluate?batchId=${currentBatch.id}`, { cache: 'no-store' });
        let data;
        
        if (res.ok) {
          data = await res.json();
          if (data.error) {
            // Try T3 endpoint if legacy returns error
            res = await fetch(`/api/admin/evaluate-t3-cases?batchId=${currentBatch.id}`, { cache: 'no-store' });
            if (res.ok) {
              data = await res.json();
            }
          }
        } else {
          // Try T3 endpoint if legacy fails
          res = await fetch(`/api/admin/evaluate-t3-cases?batchId=${currentBatch.id}`, { cache: 'no-store' });
          if (res.ok) {
            data = await res.json();
          }
        }
        
        if (res.ok && data?.batch) {
          setCurrentBatch(data.batch);
          if (data.batch.status === 'completed' || data.batch.status === 'failed') {
            fetchBatches();
            if (data.batch.evaluations) {
              setEvaluations(data.batch.evaluations);
            }
            // Auto-close modal after a brief delay
            setTimeout(() => {
              setCurrentBatch(null);
              // Show completion message
              if (data.batch.status === 'completed') {
                alert(`Evaluation completed! ${data.batch.completed_count} cases evaluated.`);
              } else if (data.batch.status === 'failed') {
                alert(`Evaluation failed: ${data.batch.error_message || 'Unknown error'}`);
              }
            }, 1000);
          }
        }
      }, 2000); // Poll every 2 seconds for more responsive updates
      return () => clearInterval(interval);
    }
  }, [currentBatch]);

  const fetchBatches = async () => {
    const res = await fetch('/api/admin/evaluate', { cache: 'no-store' });
    if (res.ok) { const data = await res.json(); setBatches(data.batches); }
  };
  const fetchDatasets = async () => {
    const res = await fetch('/api/admin/datasets', { cache: 'no-store' });
    if (res.ok) { const data = await res.json(); setDatasets(data.datasets); }
  };
  const startEvaluation = async () => {
    setIsLoading(true);
    try {
      let endpoint = '/api/admin/evaluate';
      let body: any = { dataset: selectedDataset || undefined, unverifiedOnly };
      
      // Auto-detect: check if dataset has T3 cases
      if (caseType === 'auto' && selectedDataset) {
        const checkRes = await fetch(`/api/admin/datasets/${encodeURIComponent(selectedDataset)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const hasT3 = (checkData.byTable?.l1 || 0) + (checkData.byTable?.l2 || 0) + (checkData.byTable?.l3 || 0) > 0;
          const hasLegacy = (checkData.byTable?.legacy || 0) > 0;
          if (hasT3 && !hasLegacy) {
            endpoint = '/api/admin/evaluate-t3-cases';
            body = { caseType: t3CaseType, dataset: selectedDataset, unverifiedOnly };
          } else if (hasT3 && hasLegacy) {
            // Both exist - use T3 by default, but could prompt user
            endpoint = '/api/admin/evaluate-t3-cases';
            body = { caseType: t3CaseType, dataset: selectedDataset, unverifiedOnly };
          }
        }
      } else if (caseType === 't3') {
        endpoint = '/api/admin/evaluate-t3-cases';
        body = { caseType: t3CaseType, dataset: selectedDataset || undefined, unverifiedOnly };
      }
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const batchId = data.evaluation_batch_id || data.evaluationBatchId;
        const pollEndpoint = endpoint === '/api/admin/evaluate-t3-cases' 
          ? `/api/admin/evaluate-t3-cases?batchId=${batchId}`
          : `/api/admin/evaluate?batchId=${batchId}`;
        const bRes = await fetch(pollEndpoint, { cache: 'no-store' });
        if (bRes.ok) { setCurrentBatch((await bRes.json()).batch); }
      } else {
        const msg = data.detail ? `${data.error || 'Error'}\n\n${data.detail}` : (data.error || 'Failed to start evaluation');
        alert(msg);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to start evaluation'}`);
    } finally {
      setIsLoading(false);
    }
  };
  const viewBatch = async (id: string) => {
    // Try legacy endpoint first, then T3 endpoint if not found
    let res = await fetch(`/api/admin/evaluate?batchId=${id}`, { cache: 'no-store' });
    let d;
    if (res.ok) {
      d = await res.json();
      if (d.error) {
        // Try T3 endpoint if legacy returns error
        res = await fetch(`/api/admin/evaluate-t3-cases?batchId=${id}`, { cache: 'no-store' });
        if (res.ok) {
          d = await res.json();
        }
      }
    } else {
      // Try T3 endpoint if legacy fails
      res = await fetch(`/api/admin/evaluate-t3-cases?batchId=${id}`, { cache: 'no-store' });
      if (res.ok) {
        d = await res.json();
      }
    }
    if (res.ok && d) {
      setCurrentBatch(d.batch);
      setEvaluations(d.batch.evaluations || []);
    }
  };
  const viewReport = async (id: string) => {
    const res = await fetch(`/api/admin/report?evaluationBatchId=${id}&format=text`);
    if (res.ok) { setReport(await res.text()); setShowReport(true); }
  };
  const deleteBatch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this evaluation batch? This will also delete all associated evaluations and cannot be undone.')) {
      return;
    }
    const res = await fetch(`/api/admin/evaluate/${id}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      alert(`Successfully deleted batch and ${data.deletedEvaluations} evaluations`);
      // Clear current batch if it was deleted
      if (currentBatch?.id === id) {
        setCurrentBatch(null);
        setEvaluations([]);
      }
      // Force refresh batches list
      await fetchBatches();
    } else {
      const error = await res.json();
      alert(`Failed to delete batch: ${error.error || 'Unknown error'}`);
    }
  };
  const getVerdictColor = (v: string) => v === 'APPROVED' ? 'text-green-600 bg-green-50' : v === 'NEEDS_REVIEW' ? 'text-yellow-600 bg-yellow-50' : v === 'REJECTED' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';
  const getPriorityLabel = (p: number) => p === 1 ? '🔴 Urgent' : p === 2 ? '🟡 Normal' : p === 3 ? '🟢 Minor' : String(p);

  function getEvalDisplay(e: CaseEvaluation): { id: string; sourceCase: string; scenario: string; pearlLevel: string; trapType: string } {
    if (e.question) {
      return {
        id: e.question.id,
        sourceCase: e.question.source_case ?? e.question_id ?? e.id,
        scenario: e.question.scenario,
        pearlLevel: e.question.pearl_level,
        trapType: e.question.trap_type,
      };
    }
    const c = e.t3_case;
    if (!c) {
      return { id: e.id, sourceCase: e.t3_case_id ?? e.id, scenario: '', pearlLevel: '?', trapType: '?' };
    }
    const level = c.pearl_level;
    const trap = c.trap_type;
    return {
      id: c.id,
      sourceCase: c.source_case ?? c.id,
      scenario: c.scenario,
      pearlLevel: level,
      trapType: trap,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="text-primary-600 hover:underline mb-2 inline-block">← Back to Admin</Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Evaluation Agent</h1>
              <p className="text-gray-600 mt-2">AI-powered proofreading and quality assessment</p>
            </div>
            <Link
              href="/admin/grading/scores"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              View Scores Dashboard
            </Link>
          </div>
        </div>
        {showReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-semibold">Evaluation Report</h2>
                <button onClick={() => setShowReport(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[70vh]"><pre className="whitespace-pre-wrap font-mono text-sm">{report}</pre></div>
              <div className="p-4 border-t flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(report); }} className="px-4 py-2 bg-primary-600 text-white rounded">Copy</button>
                <button onClick={() => setShowReport(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Close</button>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Start New Evaluation</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="">All Datasets</option>
                {datasets.map(d => <option key={d.name} value={d.name}>{d.name} ({d.totalCount})</option>)}
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={unverifiedOnly} onChange={e => setUnverifiedOnly(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm">Unverified only</span>
              </label>
              <div className="flex gap-2">
                <select value={caseType} onChange={e => setCaseType(e.target.value as 'legacy' | 't3' | 'auto')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1">
                  <option value="auto">Auto-detect</option>
                  <option value="legacy">Legacy (Question)</option>
                  <option value="t3">T3 Cases (L1/L2/L3)</option>
                </select>
              </div>
            </div>
            {caseType === 't3' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">T3 Case Type</label>
                <select value={t3CaseType} onChange={e => setT3CaseType(e.target.value as 'L1' | 'L2' | 'L3' | 'all')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="all">All (L1 + L2 + L3)</option>
                  <option value="L1">L1 Cases Only</option>
                  <option value="L2">L2 Cases Only</option>
                  <option value="L3">L3 Cases Only</option>
                </select>
              </div>
            )}
            <button onClick={startEvaluation} disabled={isLoading} className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400">
              {isLoading ? 'Starting...' : '🔍 Start Evaluation'}
            </button>
          </div>
        </div>
        {/* Evaluation Progress Modal */}
        {(currentBatch?.status === 'running' || currentBatch?.status === 'pending') && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Evaluating Cases</h2>
                <button
                  onClick={() => setCurrentBatch(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                  title="Close (evaluation will continue in background)"
                >
                  ×
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>
                    {currentBatch.completed_count} / {currentBatch.total_count} evaluated
                  </span>
                  <span>
                    {currentBatch.total_count > 0 
                      ? Math.round((currentBatch.completed_count / currentBatch.total_count) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-purple-600 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: currentBatch.total_count > 0 
                        ? `${(currentBatch.completed_count / currentBatch.total_count) * 100}%` 
                        : '0%',
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <p className="text-sm text-gray-700 font-medium mb-2">Status:</p>
                <p className="text-sm text-gray-600">
                  {currentBatch.completed_count === 0 
                    ? 'Starting evaluation...' 
                    : currentBatch.completed_count < currentBatch.total_count
                    ? `Evaluating case ${currentBatch.completed_count + 1} of ${currentBatch.total_count}...`
                    : 'Finalizing evaluation...'}
                </p>
              </div>

              {/* Batch Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Dataset:</span>
                    <span className="ml-2 font-medium">{currentBatch.dataset || 'All datasets'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <span className="ml-2 font-medium">
                      {new Date(currentBatch.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Loading indicator */}
              {currentBatch.status === 'running' && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Processing...</span>
                </div>
              )}

              {/* Pending status */}
              {currentBatch.status === 'pending' && (
                <div className="flex items-center justify-center">
                  <div className="animate-pulse text-purple-600">⏳</div>
                  <span className="ml-2 text-sm text-gray-600">Initializing evaluation...</span>
                </div>
              )}

              {/* Note */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                {currentBatch.status === 'pending' 
                  ? 'Evaluation is being prepared...'
                  : 'You can close this window - evaluation will continue in the background'}
              </p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Evaluation History</h2>
          {batches.length === 0 ? <p className="text-gray-500">No evaluations yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left p-2">Date</th><th className="text-left p-2">Dataset</th><th className="text-left p-2">Count</th><th className="text-left p-2">Status</th><th className="text-left p-2">Actions</th></tr></thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="p-2">{b.dataset || 'All'}</td>
                    <td className="p-2">{b.completed_count}/{b.total_count}</td>
                    <td className="p-2"><span className={`px-2 py-1 rounded text-xs font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{b.status}</span></td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => viewBatch(b.id)} className="text-primary-600 hover:underline">View</button>
                      {b.report_generated && <button onClick={() => viewReport(b.id)} className="text-purple-600 hover:underline">Report</button>}
                      <button onClick={() => deleteBatch(b.id)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {evaluations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Case Evaluations ({evaluations.length})</h2>
            <div className="space-y-4">
              {evaluations.map(e => {
                const d = getEvalDisplay(e);
                return (
                  <div key={e.id} className={`border rounded-lg p-4 ${getVerdictColor(e.overall_verdict)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div><span className="font-semibold">{d.sourceCase}</span> <span className="text-sm">({d.pearlLevel} / {d.trapType})</span></div>
                      <div className="flex gap-2"><span className="px-2 py-1 rounded text-xs font-bold">{e.overall_verdict}</span><span className="text-sm">{getPriorityLabel(e.priority_level)}</span></div>
                    </div>
                    {d.scenario && <p className="text-sm text-gray-700 mb-2">{d.scenario.slice(0, 200)}{d.scenario.length > 200 ? '...' : ''}</p>}
                    {e.structural_notes && <p className="text-sm"><strong>Notes:</strong> {e.structural_notes}</p>}
                    {e.suggested_corrections && <p className="text-sm mt-1"><strong>Corrections:</strong> {e.suggested_corrections}</p>}
                    <div className="flex gap-4 mt-2 text-xs">
                      <span>Pearl: {e.pearl_level_assessment}</span>
                      <span>Trap: {e.trap_type_assessment}</span>
                      <span>GT: {e.ground_truth_assessment}</span>
                      {e.has_ambiguity && <span className="text-yellow-600">⚠️ Ambiguous</span>}
                      {e.has_logical_issues && <span className="text-red-600">⚠️ Logic Issues</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
