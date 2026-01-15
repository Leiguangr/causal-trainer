'use client';

import { useState } from 'react';

interface FailureModeAnalysisProps {
  onAnalysisComplete?: (analysis: any) => void;
}

interface FailurePattern {
  patternId: string;
  patternType: string;
  severity: string;
  description: string;
  examples: string[];
  frequencyCount: number;
  suggestedNewCases: string[];
}

interface KeyFindings {
  criticalPatterns: FailurePattern[];
  coverageGaps: FailurePattern[];
  modelWeaknesses: {
    model: string;
    weaknesses: string[];
    recommendations: string[];
  }[];
  emergencyPriorities: string[];
  justification: string;
}

export default function FailureModeAnalysis({ onAnalysisComplete }: FailureModeAnalysisProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisType, setAnalysisType] = useState<'lightweight' | 'comprehensive'>('lightweight');
  const [questionLimit, setQuestionLimit] = useState(45);

  async function runFailureAnalysis() {
    setIsRunning(true);
    try {
      const response = await fetch('/api/admin/failure-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType,
          questionLimit: analysisType === 'lightweight' ? Math.min(questionLimit, 20) : questionLimit,
          focusAreas: [] // Can be extended for targeted analysis
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
      onAnalysisComplete?.(result);
    } catch (error) {
      console.error('Failed to run failure mode analysis:', error);
      alert(`Failed to run analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🔍 Failure-Mode Analysis
        </h3>
        <p className="text-blue-700 text-sm mb-4">
          Run 1–2 representative models to identify qualitative failure patterns and justify why new cases are needed.
          Focus: "These cases expose weaknesses but coverage is sparse/unstable" (not model comparison).
        </p>
        
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Analysis Type
              </label>
              <select 
                value={analysisType} 
                onChange={(e) => setAnalysisType(e.target.value as 'lightweight' | 'comprehensive')}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="lightweight">Lightweight (Focus on patterns)</option>
                <option value="comprehensive">Comprehensive (Full analysis)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Limit
              </label>
              <input
                type="number"
                value={questionLimit}
                onChange={(e) => setQuestionLimit(parseInt(e.target.value) || 45)}
                min="10"
                max="200"
                className="border border-gray-300 rounded px-3 py-1.5 w-20 text-sm"
              />
            </div>
          </div>

          <button
            onClick={runFailureAnalysis}
            disabled={isRunning}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? '🔄 Running Analysis...' : '🚀 Run Failure Analysis'}
          </button>
        </div>
      </div>

      {analysisResult && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">📊 Analysis Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Questions Analyzed:</span>
                <div className="font-semibold">{analysisResult.questionsAnalyzed}</div>
              </div>
              <div>
                <span className="text-gray-600">Analysis Type:</span>
                <div className="font-semibold capitalize">{analysisResult.analysisType}</div>
              </div>
              {analysisResult.summary && (
                <>
                  <div>
                    <span className="text-gray-600">Total Patterns:</span>
                    <div className="font-semibold">{analysisResult.summary.totalPatterns}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Critical Issues:</span>
                    <div className="font-semibold text-red-600">{analysisResult.summary.criticalCount}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Key Findings (Lightweight Analysis) */}
          {analysisResult.analysisType === 'lightweight' && analysisResult.keyFindings && (
            <div className="space-y-4">
              <LightweightFindings findings={analysisResult.keyFindings} />
            </div>
          )}

          {/* Full Analysis Results */}
          {analysisResult.analysis && (
            <div className="space-y-4">
              <FullAnalysisResults analysis={analysisResult.analysis} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LightweightFindings({ findings }: { findings: KeyFindings }) {
  return (
    <div className="space-y-4">
      {/* Justification Summary */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">🎯 Justification for New Cases</h4>
        <div className="text-sm text-yellow-800 whitespace-pre-line">
          {findings.justification}
        </div>
      </div>

      {/* Critical Patterns */}
      {findings.criticalPatterns.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">❌ Critical Failure Patterns</h4>
          {findings.criticalPatterns.map((pattern, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <div className="font-medium text-red-800">{pattern.description}</div>
              <div className="text-sm text-red-600 mt-1">
                Frequency: {pattern.frequencyCount} | 
                Suggested: {pattern.suggestedNewCases.join('; ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coverage Gaps */}
      {findings.coverageGaps.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-900 mb-2">📊 Coverage Gaps</h4>
          {findings.coverageGaps.slice(0, 3).map((gap, idx) => (
            <div key={idx} className="mb-2 last:mb-0 text-sm">
              <span className="font-medium text-orange-800">{gap.description}</span>
              <span className="text-orange-600 ml-2">({gap.frequencyCount} cases)</span>
            </div>
          ))}
        </div>
      )}

      {/* Model Weaknesses */}
      {findings.modelWeaknesses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">🤖 Representative Model Patterns</h4>
          {findings.modelWeaknesses.map((model, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <div className="font-medium text-blue-800">{model.model}</div>
              {model.weaknesses.length > 0 && (
                <div className="text-sm text-blue-600 mt-1">
                  Weaknesses: {model.weaknesses.join('; ')}
                </div>
              )}
              {model.recommendations.length > 0 && (
                <div className="text-sm text-blue-500 mt-1">
                  Recommendations: {model.recommendations.join('; ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Emergency Priorities */}
      {findings.emergencyPriorities.length > 0 && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">🚨 Emergency Priorities</h4>
          <ul className="space-y-1 text-sm text-red-800">
            {findings.emergencyPriorities.map((priority, idx) => (
              <li key={idx}>• {priority}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FullAnalysisResults({ analysis }: { analysis: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pearl Level Coverage */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">📊 Pearl Level Coverage</h4>
          <div className="space-y-2 text-sm">
            {analysis.pearlLevelCoverage?.map((level: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span>{level.level}:</span>
                <span>
                  {level.totalQuestions} total, {level.stableQuestions} stable 
                  ({(level.instabilityRate * 100).toFixed(1)}% unstable)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trap Type Coverage */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">🎯 Trap Type Coverage</h4>
          <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
            {analysis.trapTypeCoverage?.map((trap: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate">{trap.trapType}:</span>
                <span>{trap.totalQuestions}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Case Recommendations */}
      {analysis.newCaseRecommendations?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">💡 New Case Recommendations</h4>
          <ul className="space-y-1 text-sm text-green-800">
            {analysis.newCaseRecommendations.slice(0, 10).map((rec: string, idx: number) => (
              <li key={idx}>• {rec}</li>
            ))}
            {analysis.newCaseRecommendations.length > 10 && (
              <li className="text-green-600 italic">...and {analysis.newCaseRecommendations.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Systemic Fixes */}
      {analysis.systemicFixesNeeded?.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">🔧 Systemic Fixes Needed</h4>
          <ul className="space-y-1 text-sm text-purple-800">
            {analysis.systemicFixesNeeded.map((fix: string, idx: number) => (
              <li key={idx}>• {fix}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}