'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Stats {
  L1: { current: number; target: number };
  L2: { current: number; target: number };
  L3: { current: number; target: number };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    L1: { current: 0, target: 50 },
    L2: { current: 0, target: 297 },
    L3: { current: 0, target: 103 },
  });

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

