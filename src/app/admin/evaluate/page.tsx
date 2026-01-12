'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EvaluationBatch {
  id: string;
  dataset: string | null;
  totalCount: number;
  completedCount: number;
  status: string;
  reportGenerated: boolean;
  createdAt: string;
}

interface CaseEvaluation {
  id: string;
  questionId: string;
  pearlLevelAssessment: string;
  trapTypeAssessment: string;
  groundTruthAssessment: string;
  hasAmbiguity: boolean;
  hasLogicalIssues: boolean;
  overallVerdict: string;
  priorityLevel: number;
  suggestedCorrections: string | null;
  structuralNotes: string | null;
  question: {
    id: string;
    sourceCase: string | null;
    scenario: string;
    pearlLevel: string;
    trapType: string;
    groundTruth: string;
  };
}

interface Dataset { name: string; totalCount: number; }

export default function EvaluatePage() {
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<EvaluationBatch | null>(null);
  const [evaluations, setEvaluations] = useState<CaseEvaluation[]>([]);
  const [report, setReport] = useState('');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => { fetchBatches(); fetchDatasets(); }, []);

  useEffect(() => {
    if (currentBatch?.status === 'running') {
      const interval = setInterval(async () => {
        const res = await fetch(`/api/admin/evaluate?batchId=${currentBatch.id}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentBatch(data.batch);
          if (data.batch.status === 'completed') {
            fetchBatches();
            setEvaluations(data.batch.evaluations);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentBatch]);

  const fetchBatches = async () => {
    const res = await fetch('/api/admin/evaluate');
    if (res.ok) { const data = await res.json(); setBatches(data.batches); }
  };
  const fetchDatasets = async () => {
    const res = await fetch('/api/admin/datasets');
    if (res.ok) { const data = await res.json(); setDatasets(data.datasets); }
  };
  const startEvaluation = async () => {
    setIsLoading(true);
    const res = await fetch('/api/admin/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset: selectedDataset || undefined, unverifiedOnly }),
    });
    const data = await res.json();
    if (res.ok) {
      const bRes = await fetch(`/api/admin/evaluate?batchId=${data.evaluationBatchId}`);
      if (bRes.ok) { setCurrentBatch((await bRes.json()).batch); }
    } else { alert(data.error); }
    setIsLoading(false);
  };
  const viewBatch = async (id: string) => {
    const res = await fetch(`/api/admin/evaluate?batchId=${id}`);
    if (res.ok) { const d = await res.json(); setCurrentBatch(d.batch); setEvaluations(d.batch.evaluations || []); }
  };
  const viewReport = async (id: string) => {
    const res = await fetch(`/api/admin/report?evaluationBatchId=${id}&format=text`);
    if (res.ok) { setReport(await res.text()); setShowReport(true); }
  };
  const getVerdictColor = (v: string) => v === 'APPROVED' ? 'text-green-600 bg-green-50' : v === 'NEEDS_REVIEW' ? 'text-yellow-600 bg-yellow-50' : v === 'REJECTED' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';
  const getPriorityLabel = (p: number) => p === 1 ? '🔴 Urgent' : p === 2 ? '🟡 Normal' : p === 3 ? '🟢 Minor' : String(p);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="text-primary-600 hover:underline mb-2 inline-block">← Back to Admin</Link>
          <h1 className="text-3xl font-bold text-gray-900">Evaluation Agent</h1>
          <p className="text-gray-600 mt-2">AI-powered proofreading and quality assessment</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">All Datasets</option>
              {datasets.map(d => <option key={d.name} value={d.name}>{d.name} ({d.totalCount})</option>)}
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={unverifiedOnly} onChange={e => setUnverifiedOnly(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Unverified only</span>
            </label>
            <button onClick={startEvaluation} disabled={isLoading} className="bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400">
              {isLoading ? 'Starting...' : '🔍 Start Evaluation'}
            </button>
          </div>
        </div>
        {currentBatch?.status === 'running' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-purple-900 mb-2">Evaluation in Progress...</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-purple-200 rounded-full h-4"><div className="bg-purple-600 h-4 rounded-full" style={{ width: `${(currentBatch.completedCount / currentBatch.totalCount) * 100}%` }} /></div>
              <span className="text-purple-900 font-mono">{currentBatch.completedCount}/{currentBatch.totalCount}</span>
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
                    <td className="p-2">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="p-2">{b.dataset || 'All'}</td>
                    <td className="p-2">{b.completedCount}/{b.totalCount}</td>
                    <td className="p-2"><span className={`px-2 py-1 rounded text-xs font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{b.status}</span></td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => viewBatch(b.id)} className="text-primary-600 hover:underline">View</button>
                      {b.reportGenerated && <button onClick={() => viewReport(b.id)} className="text-purple-600 hover:underline">Report</button>}
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
              {evaluations.map(e => (
                <div key={e.id} className={`border rounded-lg p-4 ${getVerdictColor(e.overallVerdict)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div><span className="font-semibold">{e.question.sourceCase || e.questionId}</span> <span className="text-sm">({e.question.pearlLevel} / {e.question.trapType})</span></div>
                    <div className="flex gap-2"><span className="px-2 py-1 rounded text-xs font-bold">{e.overallVerdict}</span><span className="text-sm">{getPriorityLabel(e.priorityLevel)}</span></div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{e.question.scenario.slice(0, 200)}...</p>
                  {e.structuralNotes && <p className="text-sm"><strong>Notes:</strong> {e.structuralNotes}</p>}
                  {e.suggestedCorrections && <p className="text-sm mt-1"><strong>Corrections:</strong> {e.suggestedCorrections}</p>}
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Pearl: {e.pearlLevelAssessment}</span>
                    <span>Trap: {e.trapTypeAssessment}</span>
                    <span>GT: {e.groundTruthAssessment}</span>
                    {e.hasAmbiguity && <span className="text-yellow-600">⚠️ Ambiguous</span>}
                    {e.hasLogicalIssues && <span className="text-red-600">⚠️ Logic Issues</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
