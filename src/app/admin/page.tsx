'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TrapDistribution {
  [trapType: string]: {
    count: number;
    subtypes: { [subtype: string]: number };
  };
}

interface Stats {
  L1: { current: number; target: number };
  L2: { current: number; target: number };
  L3: { current: number; target: number };
  trapDistribution?: {
    L1: TrapDistribution;
    L2: TrapDistribution;
    L3: TrapDistribution;
  };
  coverage?: {
    trapTypes: { covered: number; total: number };
    subtypes: { covered: number; total: number };
  };
}

const TRAP_TYPE_LABELS: Record<string, string> = {
  CONFOUNDING: 'Confounding',
  REVERSE: 'Reverse Causation',
  SELECTION: 'Selection Bias',
  COLLIDER: 'Collider Bias',
  SIMPSONS: "Simpson's Paradox",
  REGRESSION: 'Regression to Mean',
  SURVIVORSHIP: 'Survivorship Bias',
  BASE_RATE: 'Base-rate Neglect',
  GOODHART: "Goodhart's Law",
  FEEDBACK: 'Feedback Loops',
  PREEMPTION: 'Preemption',
  CONFOUNDER_MEDIATOR: 'Confounder-Mediator',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    L1: { current: 0, target: 50 },
    L2: { current: 0, target: 297 },
    L3: { current: 0, target: 103 },
  });
  const [showDistribution, setShowDistribution] = useState(false);

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

  const getTotalProgress = () => {
    const total = stats.L1.current + stats.L2.current + stats.L3.current;
    const target = stats.L1.target + stats.L2.target + stats.L3.target;
    return Math.round((total / target) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Question Generation & Management System
          </p>
        </div>

        {/* Overall Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Overall Progress</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-lg font-medium">
                {stats.L1.current + stats.L2.current + stats.L3.current} / 450 Questions
              </span>
              <span className="text-lg text-gray-600">{getTotalProgress()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-600 h-4 rounded-full transition-all"
                style={{ width: `${getTotalProgress()}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium mb-1">L1 - Association</div>
              <div className="text-2xl font-bold text-blue-900">
                {stats.L1.current} / {stats.L1.target}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                {Math.round((stats.L1.current / stats.L1.target) * 100)}% complete
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 font-medium mb-1">L2 - Intervention</div>
              <div className="text-2xl font-bold text-purple-900">
                {stats.L2.current} / {stats.L2.target}
              </div>
              <div className="text-sm text-purple-600 mt-1">
                {Math.round((stats.L2.current / stats.L2.target) * 100)}% complete
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-600 font-medium mb-1">L3 - Counterfactual</div>
              <div className="text-2xl font-bold text-orange-900">
                {stats.L3.current} / {stats.L3.target}
              </div>
              <div className="text-sm text-orange-600 mt-1">
                {Math.round((stats.L3.current / stats.L3.target) * 100)}% complete
              </div>
            </div>
          </div>
        </div>

        {/* Trap Type Coverage */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Trap Type Coverage</h2>
            <button
              onClick={() => setShowDistribution(!showDistribution)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showDistribution ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {stats.coverage && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Trap Types Covered</div>
                <div className="text-xl font-bold text-green-900">
                  {stats.coverage.trapTypes.covered} / {stats.coverage.trapTypes.total}
                </div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Subtypes Covered</div>
                <div className="text-xl font-bold text-teal-900">
                  {stats.coverage.subtypes.covered} / {stats.coverage.subtypes.total}
                </div>
              </div>
            </div>
          )}

          {showDistribution && stats.trapDistribution && (
            <div className="space-y-6">
              {(['L1', 'L2', 'L3'] as const).map(level => (
                <div key={level} className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-3">
                    {level} - {level === 'L1' ? 'Association' : level === 'L2' ? 'Intervention' : 'Counterfactual'}
                  </h3>
                  <div className="grid gap-2">
                    {Object.entries(stats.trapDistribution![level]).map(([trapType, data]) => (
                      <div key={trapType} className="flex items-center gap-3">
                        <div className="w-40 text-sm font-medium text-gray-700 truncate">
                          {TRAP_TYPE_LABELS[trapType] || trapType}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              data.count === 0 ? 'bg-red-400' : data.count < 3 ? 'bg-yellow-400' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, (data.count / 10) * 100)}%` }}
                          />
                        </div>
                        <div className="w-8 text-sm text-gray-600 text-right">{data.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">Generate Questions</h3>
            <p className="text-gray-600 mb-4">
              Use AI to generate new causal reasoning questions in batches
            </p>
            <button
              onClick={() => router.push('/admin/generate')}
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
            >
              Generate →
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">✏️</div>
            <h3 className="text-xl font-semibold mb-2">Review Questions</h3>
            <p className="text-gray-600 mb-4">
              Review and annotate AI-generated questions before approval
            </p>
            <button
              onClick={() => router.push('/admin/review')}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Review →
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">Export Questions</h3>
            <p className="text-gray-600 mb-4">
              Download questions in JSON format for use in other systems
            </p>
            <button
              onClick={() => router.push('/admin/export')}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
            >
              Export →
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Evaluate Questions</h3>
            <p className="text-gray-600 mb-4">
              AI-powered proofreading and quality assessment for generated questions
            </p>
            <button
              onClick={() => router.push('/admin/evaluate')}
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
            >
              Evaluate →
            </button>
          </div>
        </div>

        {/* Back to Main */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Main Site
          </button>
        </div>
      </div>
    </div>
  );
}

