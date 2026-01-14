'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  L1: { current: number; verified: number; target: number };
  L2: { current: number; verified: number; target: number };
  L3: { current: number; verified: number; target: number };
}

export default function ExportPage() {
  const router = useRouter();
  const [includeL1, setIncludeL1] = useState(true);
  const [includeL2, setIncludeL2] = useState(true);
  const [includeL3, setIncludeL3] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [stats, setStats] = useState<Stats>({
    L1: { current: 0, verified: 0, target: 50 },
    L2: { current: 0, verified: 0, target: 297 },
    L3: { current: 0, verified: 0, target: 103 },
  });
  const [preview, setPreview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const levels = [];
      if (includeL1) levels.push('L1');
      if (includeL2) levels.push('L2');
      if (includeL3) levels.push('L3');

      const params = new URLSearchParams({
        pearlLevels: levels.join(','),
        verifiedOnly: verifiedOnly.toString(),
      });

      const res = await fetch(`/api/admin/export?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    const levels = [];
    if (includeL1) levels.push('L1');
    if (includeL2) levels.push('L2');
    if (includeL3) levels.push('L3');

    const params = new URLSearchParams({
      pearlLevels: levels.join(','),
      verifiedOnly: verifiedOnly.toString(),
      format: 'json',
    });

    window.open(`/api/admin/export?${params}`, '_blank');
  };

  const getTotalQuestions = () => {
    let total = 0;
    const key = verifiedOnly ? 'verified' : 'current';
    if (includeL1) total += stats.L1[key];
    if (includeL2) total += stats.L2[key];
    if (includeL3) total += stats.L3[key];
    return total;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Export Questions</h1>
          <p className="text-gray-600 mt-2">
            Download questions in JSON format
          </p>
        </div>

        {/* Export Configuration */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Export Filters</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Pearl Levels</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeL1}
                    onChange={(e) => setIncludeL1(e.target.checked)}
                    className="mr-2"
                  />
                  <span>
                    Include L1 — <span className="text-green-600 font-medium">{stats.L1.verified} verified</span>
                    <span className="text-gray-400"> / {stats.L1.current} total</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeL2}
                    onChange={(e) => setIncludeL2(e.target.checked)}
                    className="mr-2"
                  />
                  <span>
                    Include L2 — <span className="text-green-600 font-medium">{stats.L2.verified} verified</span>
                    <span className="text-gray-400"> / {stats.L2.current} total</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeL3}
                    onChange={(e) => setIncludeL3(e.target.checked)}
                    className="mr-2"
                  />
                  <span>
                    Include L3 — <span className="text-green-600 font-medium">{stats.L3.verified} verified</span>
                    <span className="text-gray-400"> / {stats.L3.current} total</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="mr-2"
                />
                <span className="font-medium">Verified questions only</span>
              </label>
              <p className="text-sm text-gray-500 ml-6">
                Only include questions that have been reviewed and approved
              </p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-lg font-semibold">
                Export: {getTotalQuestions()} {verifiedOnly ? 'verified' : 'total'} questions
              </p>
              {verifiedOnly && getTotalQuestions() === 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  ⚠️ No verified questions yet. Review and approve questions first.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isLoading || getTotalQuestions() === 0}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Loading...' : 'Preview'}
            </button>
            <button
              onClick={handleDownload}
              disabled={getTotalQuestions() === 0}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              Download JSON
            </button>
            <button
              onClick={() => router.push('/admin/generate')}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
            >
              Back to Generate
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>

            <div className="mb-4">
              <h3 className="font-medium text-gray-700 mb-2">Metadata</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p><span className="font-medium">Export Date:</span> {preview.metadata.exportDate}</p>
                <p><span className="font-medium">Total Questions:</span> {preview.metadata.totalQuestions}</p>
                <p><span className="font-medium">Distribution:</span></p>
                <ul className="ml-4">
                  <li>L1: {preview.metadata.distribution.L1}</li>
                  <li>L2: {preview.metadata.distribution.L2}</li>
                  <li>L3: {preview.metadata.distribution.L3}</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-700 mb-2">Sample Questions (First 3)</h3>
              <div className="space-y-4">
                {preview.questions.slice(0, 3).map((q: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="font-medium text-sm text-gray-600 mb-1">
                      Case {q.annotations?.caseId || idx + 1} • {q.annotations?.pearlLevel} • {q.annotations?.domain}
                    </p>
                    <p className="text-sm mb-2">
                      <span className="font-medium">Scenario:</span> {q.scenario?.substring(0, 200)}...
                    </p>
                    <p className="text-sm mt-2">
                      <span className="font-medium">Trap:</span> {q.annotations?.trapType || 'NONE'} ({q.annotations?.trapSubtype || 'NONE'})
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Ground Truth:</span> {q.groundTruth}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Author:</span> {q.annotations?.author || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={handleDownload}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
              >
                Download Full Export ({preview.metadata.totalQuestions} questions)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

