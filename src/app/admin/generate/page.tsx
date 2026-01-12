'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PEARL_LEVELS, PearlLevel } from '@/types';

interface Stats {
  L1: { current: number; target: number };
  L2: { current: number; target: number };
  L3: { current: number; target: number };
}

export default function GeneratePage() {
  const router = useRouter();
  const [pearlLevel, setPearlLevel] = useState<string>('');
  const [domain, setDomain] = useState<string>('Markets');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [promptNotes, setPromptNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<Stats>({
    L1: { current: 0, target: 50 },
    L2: { current: 0, target: 297 },
    L3: { current: 0, target: 103 },
  });
  const [lastResult, setLastResult] = useState<any>(null);

  const selectedPearlMeta =
    (['L1', 'L2', 'L3'] as PearlLevel[]).includes(pearlLevel as PearlLevel)
      ? PEARL_LEVELS[pearlLevel as PearlLevel]
      : null;

  useEffect(() => {
    fetchStats();
  }, []);

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
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pearlLevel: pearlLevel || undefined,
          domain,
          batchSize,
          promptNotes: promptNotes || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Generation failed');
      }

      const result = await res.json();
      setLastResult(result);
      await fetchStats();
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate questions. Please try again.');
    } finally {
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
                <option value="L1">L1 - {PEARL_LEVELS.L1.name}</option>
                <option value="L2">L2 - {PEARL_LEVELS.L2.name}</option>
                <option value="L3">L3 - {PEARL_LEVELS.L3.name}</option>
              </select>
              {selectedPearlMeta && (
                <p className="mt-1 text-xs text-gray-500">
                  <span className="font-semibold">{selectedPearlMeta.name}:</span>{' '}
                  {selectedPearlMeta.description}
                </p>
              )}
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
                <option value="Markets">Markets</option>
                <option value="Medicine">Medicine</option>
                <option value="Law">Law</option>
                <option value="Technology">Technology</option>
                <option value="Education">Education</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size (1-50)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
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

        {/* Last Result */}
        {lastResult && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Generation Result</h2>
            <div className="space-y-2">
              <p className="text-gray-700">
                <span className="font-medium">Generated:</span> {lastResult.generated} / {lastResult.questions?.length || 0} questions
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Batch ID:</span> {lastResult.batchId}
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => router.push('/admin/review')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Review Questions →
                </button>
                <button
                  onClick={handleGenerate}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Generate Another Batch
                </button>
              </div>
            </div>
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
