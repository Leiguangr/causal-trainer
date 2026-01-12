'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  L1: { current: number; target: number };
  L2: { current: number; target: number };
  L3: { current: number; target: number };
}

interface BatchStatus {
  batchId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentIndex: number;
  requestedCount: number;
  generatedCount: number;
  errorMessage?: string;
  questions: Array<{
    id: string;
    pearlLevel: string;
    trapType: string;
    trapSubtype: string;
    domain: string;
    groundTruth: string;
  }>;
}

export default function GeneratePage() {
  const router = useRouter();
  const [pearlLevel, setPearlLevel] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [promptNotes, setPromptNotes] = useState<string>('');
  const [validityMix, setValidityMix] = useState({ valid: 30, invalid: 50, conditional: 20 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<Stats>({
    L1: { current: 0, target: 50 },
    L2: { current: 0, target: 297 },
    L3: { current: 0, target: 103 },
  });
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  // Poll for batch status when generating
  useEffect(() => {
    if (!currentBatchId || !isGenerating) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/admin/generate/${currentBatchId}/status`);
        if (res.ok) {
          const status: BatchStatus = await res.json();
          setBatchStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            setIsGenerating(false);
            fetchStats();
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    // Also poll immediately
    pollStatus();

    return () => clearInterval(interval);
  }, [currentBatchId, isGenerating]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setBatchStatus(null);

    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pearlLevel: pearlLevel || undefined,
          domain: domain || undefined,
          batchSize,
          promptNotes: promptNotes || undefined,
          validityMix,
        }),
      });

      if (!res.ok) {
        throw new Error('Generation failed');
      }

      const result = await res.json();
      setCurrentBatchId(result.batchId);
      // isGenerating stays true - will be set false when polling detects completion
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to start generation. Please try again.');
      setIsGenerating(false);
    }
  };

  const getProgress = (level: keyof Stats) => {
    const { current, target } = stats[level];
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Generate Questions</h1>
          <p className="text-gray-600 mt-2">
            Use AI to generate new causal reasoning questions
          </p>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Progress</h2>
          
          {(['L1', 'L2', 'L3'] as const).map((level) => {
            const { current, target } = stats[level];
            const progress = getProgress(level);
            
            return (
              <div key={level} className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{level}: {current}/{target}</span>
                  <span className="text-gray-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary-600 h-3 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Generation Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Generate New Batch</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pearl Level
              </label>
              <select
                value={pearlLevel}
                onChange={(e) => setPearlLevel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">All Levels (Mixed)</option>
                <option value="L1">L1 - Association</option>
                <option value="L2">L2 - Intervention</option>
                <option value="L3">L3 - Counterfactual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Any Domain (Mixed)</option>
                <option value="Markets">Markets</option>
                <option value="Medicine">Medicine</option>
                <option value="Law">Law</option>
                <option value="Technology">Technology</option>
                <option value="Education">Education</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size (1-200)
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Validity Mix (must sum to 100%)
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-green-700 mb-1">✓ Valid</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={validityMix.valid}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setValidityMix(prev => ({ ...prev, valid: Math.min(100, Math.max(0, val)) }));
                    }}
                    className="w-full border border-green-300 rounded-lg px-3 py-2 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs text-red-700 mb-1">✗ Invalid</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={validityMix.invalid}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setValidityMix(prev => ({ ...prev, invalid: Math.min(100, Math.max(0, val)) }));
                    }}
                    className="w-full border border-red-300 rounded-lg px-3 py-2 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs text-yellow-700 mb-1">? Conditional</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={validityMix.conditional}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setValidityMix(prev => ({ ...prev, conditional: Math.min(100, Math.max(0, val)) }));
                    }}
                    className="w-full border border-yellow-300 rounded-lg px-3 py-2 text-center"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {validityMix.valid + validityMix.invalid + validityMix.conditional === 100
                  ? <span className="text-green-600">✓ Sums to 100%</span>
                  : <span className="text-red-600">⚠ Must sum to 100% (current: {validityMix.valid + validityMix.invalid + validityMix.conditional}%)</span>
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={promptNotes}
                onChange={(e) => setPromptNotes(e.target.value)}
                placeholder="E.g., 'Focus on recent events', 'Make scenarios more complex', 'Include more numerical data'"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Provide specific instructions to customize the generation
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Batch'}
            </button>
          </div>
        </div>

        {/* Real-time Progress */}
        {batchStatus && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {batchStatus.status === 'running' ? '⏳ Generating...' :
                 batchStatus.status === 'completed' ? '✅ Generation Complete' :
                 batchStatus.status === 'failed' ? '❌ Generation Failed' : '⏸️ Pending'}
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                batchStatus.status === 'running' ? 'bg-blue-100 text-blue-700' :
                batchStatus.status === 'completed' ? 'bg-green-100 text-green-700' :
                batchStatus.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {batchStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Question {batchStatus.currentIndex} of {batchStatus.requestedCount}
                </span>
                <span className="text-sm text-gray-600">{batchStatus.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    batchStatus.status === 'failed' ? 'bg-red-500' :
                    batchStatus.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${batchStatus.progress}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{batchStatus.generatedCount}</div>
                <div className="text-sm text-gray-600">Generated</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{batchStatus.requestedCount - batchStatus.currentIndex}</div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{batchStatus.currentIndex - batchStatus.generatedCount}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>

            {/* Error Message */}
            {batchStatus.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{batchStatus.errorMessage}</p>
              </div>
            )}

            {/* Generated Questions List */}
            {batchStatus.questions.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Generated Questions ({batchStatus.questions.length})
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {batchStatus.questions.map((q, idx) => (
                    <div key={q.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                      <span className="font-mono text-gray-500">#{idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        q.groundTruth === 'VALID' ? 'bg-green-100 text-green-700' :
                        q.groundTruth === 'INVALID' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {q.groundTruth}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        q.pearlLevel === 'L1' ? 'bg-blue-100 text-blue-700' :
                        q.pearlLevel === 'L2' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {q.pearlLevel}
                      </span>
                      <span className="text-gray-700">{q.trapType || 'NONE'}</span>
                      {q.trapSubtype && q.trapSubtype !== 'None' && (
                        <span className="text-gray-500">/ {q.trapSubtype.replace(/_/g, ' ')}</span>
                      )}
                      <span className="text-gray-400 ml-auto">{q.domain}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {(batchStatus.status === 'completed' || batchStatus.status === 'failed') && (
              <div className="mt-4 flex gap-3 border-t pt-4">
                <button
                  onClick={() => router.push('/admin/review')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Review Questions →
                </button>
                <button
                  onClick={() => {
                    setBatchStatus(null);
                    setCurrentBatchId(null);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Generate Another Batch
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/review')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Review Unverified
            </button>
            <button
              onClick={() => router.push('/admin/export')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Export Questions
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

