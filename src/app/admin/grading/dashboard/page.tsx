'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface GradingStats {
  total: number;
  verdictCounts: { APPROVED: number; NEEDS_REVIEW: number; REJECTED: number };
  priorityCounts: { urgent: number; normal: number; minor: number };
  caseTypeCounts: { legacy: number; L1: number; L2: number; L3: number };
  qualityFlags: { hasAmbiguity: number; hasLogicalIssues: number; hasDomainErrors: number };
  clarity: { average: number; distribution: Record<number, number> };
  assessments: {
    pearlLevel: { CORRECT: number; INCORRECT: number; UNCERTAIN: number };
    trapType: { CORRECT: number; INCORRECT: number; UNCERTAIN: number };
    groundTruth: { CORRECT: number; INCORRECT: number; UNCERTAIN: number };
  };
  rubric: {
    average: number | null;
    min: number | null;
    max: number | null;
    distribution: Record<string, number>;
    thresholds: Record<string, number>;
    versions: Record<string, number>;
    totalWithRubric: number;
  };
  datasetCounts: Record<string, number>;
  timeSeries: Record<string, number>;
  batchCounts: Record<string, { count: number; dataset: string | null; status: string }>;
  labelDistribution: Record<string, Record<string, number>>;
  trapTypeDistribution: Record<string, Record<string, number>>;
}

interface EvaluationBatch {
  id: string;
  dataset: string | null;
  total_count: number;
  completed_count: number;
  status: string;
  created_at: string;
}

export default function GradingDashboardPage() {
  const [stats, setStats] = useState<GradingStats | null>(null);
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dataset, setDataset] = useState<string>('');
  const [evaluationBatchId, setEvaluationBatchId] = useState<string>('');
  const [caseType, setCaseType] = useState<string>('all');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (dataset) p.set('dataset', dataset);
    if (evaluationBatchId) p.set('evaluationBatchId', evaluationBatchId);
    if (caseType !== 'all') p.set('caseType', caseType);
    return p.toString();
  }, [dataset, evaluationBatchId, caseType]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [statsRes, batchesRes] = await Promise.all([
          fetch(`/api/admin/grading/stats?${query}`, { cache: 'no-store' }),
          fetch('/api/admin/grading?page=1&pageSize=1', { cache: 'no-store' }),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (batchesRes.ok) {
          const batchesData = await batchesRes.json();
          setBatches(batchesData.batches || []);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [query]);

  const verdictPercentage = (count: number) => {
    if (!stats || stats.total === 0) return 0;
    return ((count / stats.total) * 100).toFixed(1);
  };

  const getBarWidth = (count: number, max: number) => {
    if (max === 0) return 0;
    return (count / max) * 100;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center text-gray-500">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center text-red-500">Failed to load dashboard data</div>
        </div>
      </div>
    );
  }

  const maxVerdict = Math.max(stats.verdictCounts.APPROVED, stats.verdictCounts.NEEDS_REVIEW, stats.verdictCounts.REJECTED);
  const maxPriority = Math.max(stats.priorityCounts.urgent, stats.priorityCounts.normal, stats.priorityCounts.minor);
  const maxClarity = Math.max(...Object.values(stats.clarity.distribution));
  const maxRubric = Math.max(...Object.values(stats.rubric.distribution));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="text-primary-600 hover:underline mb-2 inline-block">
            ← Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Evaluation Scoring Dashboard</h1>
              <p className="text-gray-600 mt-2">Comprehensive analytics and insights for case evaluations</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/grading"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                List View
              </Link>
              <Link
                href="/admin/grading/scores"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Scores Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              placeholder="Dataset (optional)"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <select
              value={evaluationBatchId}
              onChange={(e) => setEvaluationBatchId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All evaluation batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {new Date(b.created_at).toLocaleString()} · {b.dataset || 'All'} · {b.status}
                </option>
              ))}
            </select>
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">All case types</option>
              <option value="legacy">Legacy (Question)</option>
              <option value="L1">L1Case</option>
              <option value="L2">L2Case</option>
              <option value="L3">L3Case</option>
            </select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Total Evaluations</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Approved</div>
            <div className="text-3xl font-bold text-green-600">{stats.verdictCounts.APPROVED.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{verdictPercentage(stats.verdictCounts.APPROVED)}%</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Average Clarity</div>
            <div className="text-3xl font-bold text-blue-600">{stats.clarity.average.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-1">out of 5.0</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Rubric Score</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.rubric.average !== null ? stats.rubric.average.toFixed(1) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.rubric.totalWithRubric} with rubric
            </div>
          </div>
        </div>

        {/* Verdict Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Verdict Distribution</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-700 font-medium">APPROVED</span>
                <span>{stats.verdictCounts.APPROVED} ({verdictPercentage(stats.verdictCounts.APPROVED)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full"
                  style={{ width: `${getBarWidth(stats.verdictCounts.APPROVED, maxVerdict)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-yellow-700 font-medium">NEEDS_REVIEW</span>
                <span>{stats.verdictCounts.NEEDS_REVIEW} ({verdictPercentage(stats.verdictCounts.NEEDS_REVIEW)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-yellow-600 h-4 rounded-full"
                  style={{ width: `${getBarWidth(stats.verdictCounts.NEEDS_REVIEW, maxVerdict)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-700 font-medium">REJECTED</span>
                <span>{stats.verdictCounts.REJECTED} ({verdictPercentage(stats.verdictCounts.REJECTED)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-red-600 h-4 rounded-full"
                  style={{ width: `${getBarWidth(stats.verdictCounts.REJECTED, maxVerdict)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Priority Distribution */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Priority Distribution</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-700 font-medium">Urgent</span>
                  <span>{stats.priorityCounts.urgent}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.priorityCounts.urgent, maxPriority)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-yellow-700 font-medium">Normal</span>
                  <span>{stats.priorityCounts.normal}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.priorityCounts.normal, maxPriority)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-700 font-medium">Minor</span>
                  <span>{stats.priorityCounts.minor}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.priorityCounts.minor, maxPriority)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Case Type Distribution */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Case Type Distribution</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Legacy</span>
                  <span>{stats.caseTypeCounts.legacy}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gray-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.caseTypeCounts.legacy, stats.total)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">L1</span>
                  <span>{stats.caseTypeCounts.L1}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.caseTypeCounts.L1, stats.total)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">L2</span>
                  <span>{stats.caseTypeCounts.L2}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-purple-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.caseTypeCounts.L2, stats.total)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">L3</span>
                  <span>{stats.caseTypeCounts.L3}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full"
                    style={{ width: `${getBarWidth(stats.caseTypeCounts.L3, stats.total)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Flags */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quality Issues</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Ambiguity Issues</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.qualityFlags.hasAmbiguity}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.total > 0 ? ((stats.qualityFlags.hasAmbiguity / stats.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Logical Issues</div>
              <div className="text-2xl font-bold text-red-600">{stats.qualityFlags.hasLogicalIssues}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.total > 0 ? ((stats.qualityFlags.hasLogicalIssues / stats.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Domain Errors</div>
              <div className="text-2xl font-bold text-red-600">{stats.qualityFlags.hasDomainErrors}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.total > 0 ? ((stats.qualityFlags.hasDomainErrors / stats.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>
        </div>

        {/* Clarity Score Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Clarity Score Distribution</h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(score => (
              <div key={score}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{score} {score === 1 ? 'star' : 'stars'}</span>
                  <span>{stats.clarity.distribution[score] || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      score >= 4 ? 'bg-green-600' : score >= 3 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${getBarWidth(stats.clarity.distribution[score] || 0, maxClarity)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assessment Accuracy */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Assessment Accuracy</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['pearlLevel', 'trapType', 'groundTruth'] as const).map(assessmentType => {
              const assessment = stats.assessments[assessmentType];
              const total = assessment.CORRECT + assessment.INCORRECT + assessment.UNCERTAIN;
              return (
                <div key={assessmentType} className="border rounded-lg p-4">
                  <div className="text-sm font-semibold mb-3 capitalize">{assessmentType.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">CORRECT</span>
                      <span>{assessment.CORRECT} ({total > 0 ? ((assessment.CORRECT / total) * 100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">INCORRECT</span>
                      <span>{assessment.INCORRECT} ({total > 0 ? ((assessment.INCORRECT / total) * 100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-700">UNCERTAIN</span>
                      <span>{assessment.UNCERTAIN} ({total > 0 ? ((assessment.UNCERTAIN / total) * 100).toFixed(1) : 0}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rubric Score Analysis */}
        {stats.rubric.totalWithRubric > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Rubric Score Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Score Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats.rubric.distribution).map(([range, count]) => (
                    <div key={range}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{range}</span>
                        <span>{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-purple-600 h-3 rounded-full"
                          style={{ width: `${getBarWidth(count, maxRubric)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Average Score</span>
                    <span className="font-semibold">{stats.rubric.average?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Score</span>
                    <span className="font-semibold">{stats.rubric.min?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Score</span>
                    <span className="font-semibold">{stats.rubric.max?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total with Rubric</span>
                    <span className="font-semibold">{stats.rubric.totalWithRubric}</span>
                  </div>
                </div>
                {Object.keys(stats.rubric.thresholds).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Acceptance Thresholds</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(stats.rubric.thresholds).map(([threshold, count]) => (
                        <div key={threshold} className="flex justify-between">
                          <span>{threshold}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dataset Breakdown */}
        {Object.keys(stats.datasetCounts).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Dataset Breakdown</h2>
            <div className="space-y-2">
              {Object.entries(stats.datasetCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([ds, count]) => (
                  <div key={ds} className="flex justify-between items-center">
                    <span className="font-medium">{ds || 'unknown'}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-48 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full"
                          style={{ width: `${getBarWidth(count, stats.total)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Time Series */}
        {Object.keys(stats.timeSeries).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Evaluations Over Time</h2>
            <div className="space-y-2">
              {Object.entries(stats.timeSeries)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-30) // Last 30 days
                .map(([date, count]) => (
                  <div key={date} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{new Date(date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-48 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-indigo-600 h-3 rounded-full"
                          style={{ width: `${getBarWidth(count, Math.max(...Object.values(stats.timeSeries)))}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Label Distribution by Case Type */}
        {stats.labelDistribution && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Label Distribution by Case Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(['L1', 'L2', 'L3', 'legacy'] as const).map(caseType => {
                const labels = stats.labelDistribution[caseType];
                if (!labels || Object.keys(labels).length === 0) return null;
                const maxCount = Math.max(...Object.values(labels));
                return (
                  <div key={caseType} className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3">{caseType === 'legacy' ? 'Legacy' : caseType} Cases</h3>
                    <div className="space-y-2">
                      {Object.entries(labels)
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, count]) => (
                          <div key={label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{label}</span>
                              <span>{count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${
                                  label === 'YES' || label === 'VALID' ? 'bg-green-600' :
                                  label === 'NO' || label === 'INVALID' ? 'bg-red-600' :
                                  'bg-yellow-600'
                                }`}
                                style={{ width: `${getBarWidth(count, maxCount)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trap Type Distribution by Case Type */}
        {stats.trapTypeDistribution && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Trap Type Distribution by Case Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(['L1', 'L2', 'L3', 'legacy'] as const).map(caseType => {
                const trapTypes = stats.trapTypeDistribution[caseType];
                if (!trapTypes || Object.keys(trapTypes).length === 0) return null;
                const maxCount = Math.max(...Object.values(trapTypes));
                const total = Object.values(trapTypes).reduce((a, b) => a + b, 0);
                return (
                  <div key={caseType} className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3">
                      {caseType === 'legacy' ? 'Legacy' : caseType} Cases
                      <span className="text-sm text-gray-500 ml-2">({total} total)</span>
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(trapTypes)
                        .sort(([, a], [, b]) => b - a)
                        .map(([trapType, count]) => {
                          const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                          return (
                            <div key={trapType}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">{trapType}</span>
                                <span>{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className="bg-blue-600 h-3 rounded-full"
                                  style={{ width: `${getBarWidth(count, maxCount)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
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
