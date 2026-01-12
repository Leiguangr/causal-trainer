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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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

interface Dataset {
  name: string;
  totalCount: number;
  verifiedCount: number;
}

// Distribution matrix type
interface DistributionMatrix {
  L1: { yes: number; no: number; ambiguous: number };
  L2: { yes: number; no: number; ambiguous: number };
  L3: { yes: number; no: number; ambiguous: number };
}

type GenerationMode = 'simple' | 'matrix';

export default function GeneratePage() {
  const router = useRouter();
  const [generationMode, setGenerationMode] = useState<GenerationMode>('simple');
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

  // Dataset state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [newDatasetName, setNewDatasetName] = useState<string>('');
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Distribution matrix state (for matrix mode)
  const [distributionMatrix, setDistributionMatrix] = useState<DistributionMatrix>({
    L1: { yes: 5, no: 15, ambiguous: 5 },
    L2: { yes: 10, no: 25, ambiguous: 10 },
    L3: { yes: 5, no: 15, ambiguous: 5 },
  });

  // Helper to update matrix cell
  const updateMatrixCell = (level: 'L1' | 'L2' | 'L3', validity: 'yes' | 'no' | 'ambiguous', value: number) => {
    setDistributionMatrix(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        [validity]: Math.max(0, value),
      },
    }));
  };

  // Calculate matrix totals
  const getMatrixTotal = () => {
    return Object.values(distributionMatrix).reduce(
      (sum, level) => sum + level.yes + level.no + level.ambiguous,
      0
    );
  };

  const getLevelTotal = (level: 'L1' | 'L2' | 'L3') => {
    const l = distributionMatrix[level];
    return l.yes + l.no + l.ambiguous;
  };

  const getValidityTotal = (validity: 'yes' | 'no' | 'ambiguous') => {
    return distributionMatrix.L1[validity] + distributionMatrix.L2[validity] + distributionMatrix.L3[validity];
  };

  useEffect(() => {
    fetchStats();
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/admin/datasets');
      if (res.ok) {
        const data = await res.json();
        setDatasets(data.datasets || []);
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
    }
  };

  const handleDeleteDataset = async (datasetName: string) => {
    const displayName = datasetName || 'default';
    const confirmMsg = `Are you sure you want to delete ALL questions in dataset "${displayName}"?\n\nThis action cannot be undone.`;

    if (!confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/datasets/${encodeURIComponent(datasetName || 'default')}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete dataset');
      }

      const result = await res.json();
      alert(result.message);

      // Refresh datasets list and stats
      await fetchDatasets();
      await fetchStats();

      // If the deleted dataset was selected, switch to default
      if (selectedDataset === datasetName) {
        setSelectedDataset('');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelBatch = async () => {
    if (!currentBatchId) return;
    if (!confirm('Are you sure you want to cancel the current generation?')) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/admin/generate/${currentBatchId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel batch');
      }

      const result = await res.json();
      alert(result.message);
    } catch (error) {
      console.error('Cancel error:', error);
      alert(`Failed to cancel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // Poll for batch status when generating
  useEffect(() => {
    if (!currentBatchId || !isGenerating) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/admin/generate/${currentBatchId}/status`);
        if (res.ok) {
          const status: BatchStatus = await res.json();
          setBatchStatus(status);

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
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
      // Build request body based on generation mode
      const requestBody: Record<string, unknown> = {
        domain: domain || undefined,
        promptNotes: promptNotes || undefined,
        dataset: selectedDataset || 'default',
      };

      if (generationMode === 'matrix') {
        // Matrix mode: use distributionMatrix
        requestBody.distributionMatrix = distributionMatrix;
        requestBody.batchSize = getMatrixTotal(); // Required field, but will be ignored
      } else {
        // Simple mode: use batchSize + validityMix + pearlLevel
        requestBody.pearlLevel = pearlLevel || undefined;
        requestBody.batchSize = batchSize;
        requestBody.validityMix = {
          yes: validityMix.valid,
          no: validityMix.invalid,
          ambiguous: validityMix.conditional,
        };
      }

      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await res.json();
      setCurrentBatchId(result.batchId);
      // isGenerating stays true - will be set false when polling detects completion
    } catch (error) {
      console.error('Generation error:', error);
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Generate New Batch</h2>
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setGenerationMode('simple')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  generationMode === 'simple'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setGenerationMode('matrix')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  generationMode === 'matrix'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Matrix (Overnight)
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Dataset Selection */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-900 mb-2">
                📁 Dataset
              </label>
              {!showNewDataset ? (
                <div className="flex gap-2">
                  <select
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    className="flex-1 border border-blue-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">default</option>
                    {datasets.filter(d => d.name !== 'default').map(d => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.totalCount} questions, {d.verifiedCount} verified)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewDataset(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDataset(selectedDataset)}
                    disabled={isDeleting}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                    title="Delete all questions in this dataset"
                  >
                    {isDeleting ? '...' : '🗑️'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDatasetName}
                    onChange={(e) => setNewDatasetName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="dataset-name (letters, numbers, - or _)"
                    className="flex-1 border border-blue-300 rounded-lg px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDatasetName.trim()) {
                        const name = newDatasetName.trim();
                        setSelectedDataset(name);
                        // Add to datasets list so it appears in dropdown
                        if (!datasets.find(d => d.name === name)) {
                          setDatasets([...datasets, { name, totalCount: 0, verifiedCount: 0 }]);
                        }
                        setShowNewDataset(false);
                        setNewDatasetName('');
                      }
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDataset(false);
                      setNewDatasetName('');
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <p className="text-xs text-blue-700 mt-1">
                Questions will be added to: <strong>{selectedDataset || 'default'}</strong>
              </p>
            </div>

            {/* Domain (shared between modes) */}
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

            {/* Simple Mode Controls */}
            {generationMode === 'simple' && (
              <>
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
                      <label className="block text-xs text-green-700 mb-1">✓ YES</label>
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
                      <label className="block text-xs text-red-700 mb-1">✗ NO</label>
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
                      <label className="block text-xs text-yellow-700 mb-1">? AMBIGUOUS</label>
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
              </>
            )}

            {/* Matrix Mode Controls */}
            {generationMode === 'matrix' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-purple-900 mb-3">
                  🎯 Distribution Matrix (exact counts per cell)
                </label>
                <p className="text-xs text-purple-700 mb-3">
                  Specify exactly how many questions to generate for each Pearl Level × Validity combination. Max 500 total.
                </p>

                {/* Matrix Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-medium text-gray-700"></th>
                        <th className="p-2 text-center font-medium text-green-700">✓ YES</th>
                        <th className="p-2 text-center font-medium text-red-700">✗ NO</th>
                        <th className="p-2 text-center font-medium text-yellow-700">? AMBIGUOUS</th>
                        <th className="p-2 text-center font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['L1', 'L2', 'L3'] as const).map((level) => (
                        <tr key={level} className="border-t border-purple-200">
                          <td className={`p-2 font-medium ${
                            level === 'L1' ? 'text-blue-700' :
                            level === 'L2' ? 'text-purple-700' :
                            'text-orange-700'
                          }`}>
                            {level}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={distributionMatrix[level].yes}
                              onChange={(e) => updateMatrixCell(level, 'yes', parseInt(e.target.value) || 0)}
                              className="w-full border border-green-300 rounded px-2 py-1 text-center bg-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={distributionMatrix[level].no}
                              onChange={(e) => updateMatrixCell(level, 'no', parseInt(e.target.value) || 0)}
                              className="w-full border border-red-300 rounded px-2 py-1 text-center bg-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={distributionMatrix[level].ambiguous}
                              onChange={(e) => updateMatrixCell(level, 'ambiguous', parseInt(e.target.value) || 0)}
                              className="w-full border border-yellow-300 rounded px-2 py-1 text-center bg-white"
                            />
                          </td>
                          <td className="p-2 text-center font-medium text-gray-600">
                            {getLevelTotal(level)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-purple-300 bg-purple-100">
                        <td className="p-2 font-medium text-gray-700">Total</td>
                        <td className="p-2 text-center font-medium text-green-700">{getValidityTotal('yes')}</td>
                        <td className="p-2 text-center font-medium text-red-700">{getValidityTotal('no')}</td>
                        <td className="p-2 text-center font-medium text-yellow-700">{getValidityTotal('ambiguous')}</td>
                        <td className="p-2 text-center font-bold text-purple-900">{getMatrixTotal()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-purple-700">
                    {getMatrixTotal() === 0 ? (
                      <span className="text-red-600">⚠ Enter at least one count</span>
                    ) : getMatrixTotal() > 500 ? (
                      <span className="text-red-600">⚠ Exceeds max of 500 (current: {getMatrixTotal()})</span>
                    ) : (
                      <span className="text-green-600">✓ Will generate {getMatrixTotal()} questions</span>
                    )}
                  </span>
                  <span className="text-xs text-purple-600">
                    ~{Math.ceil(getMatrixTotal() * 8 / 60)} min estimated
                  </span>
                </div>
              </div>
            )}

            {/* Custom Instructions (shared) */}
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
              disabled={isGenerating || (generationMode === 'matrix' && (getMatrixTotal() === 0 || getMatrixTotal() > 500))}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : generationMode === 'matrix'
                ? `Generate ${getMatrixTotal()} Questions (Matrix)`
                : 'Generate Batch'}
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
                 batchStatus.status === 'failed' ? '❌ Generation Failed' :
                 batchStatus.status === 'cancelled' ? '🛑 Cancelled' : '⏸️ Pending'}
              </h2>
              <div className="flex items-center gap-2">
                {batchStatus.status === 'running' && (
                  <button
                    onClick={handleCancelBatch}
                    disabled={isCancelling}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelling...' : '⏹ Stop'}
                  </button>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  batchStatus.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  batchStatus.status === 'completed' ? 'bg-green-100 text-green-700' :
                  batchStatus.status === 'failed' ? 'bg-red-100 text-red-700' :
                  batchStatus.status === 'cancelled' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {batchStatus.status.toUpperCase()}
                </span>
              </div>
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
                    batchStatus.status === 'completed' ? 'bg-green-500' :
                    batchStatus.status === 'cancelled' ? 'bg-orange-500' : 'bg-blue-500'
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
                        q.groundTruth === 'YES' ? 'bg-green-100 text-green-700' :
                        q.groundTruth === 'NO' ? 'bg-red-100 text-red-700' :
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
            {(batchStatus.status === 'completed' || batchStatus.status === 'failed' || batchStatus.status === 'cancelled') && (
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

