'use client';

interface RubricScore {
  totalScore: number;
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  rubricVersion: string;
}

// Unified T3 Rubric: Maximum scores for each category (applies to all Pearl levels)
const UNIFIED_RUBRIC_MAX_SCORES: Record<string, number> = {
  scenario_clarity: 1.0,
  scenarioClarity: 1.0, // camelCase variant
  hidden_question_quality: 1.0,
  hiddenQuestionQuality: 1.0, // camelCase variant
  conditional_answer_a: 1.5,
  conditionalAnswerA: 1.5, // camelCase variant
  conditional_answer_b: 1.5,
  conditionalAnswerB: 1.5, // camelCase variant
  wise_refusal_quality: 2.0,
  wiseRefusalQuality: 2.0, // camelCase variant
  difficulty_calibration: 1.0,
  difficultyCalibration: 1.0, // camelCase variant
  final_label: 1.0,
  finalLabel: 1.0, // camelCase variant
  trap_type: 1.0,
  trapType: 1.0, // camelCase variant
};

interface RubricScoreDisplayProps {
  rubricScore: string | null;
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function getThresholdColor(threshold: string): string {
  if (threshold === 'ACCEPT') return 'bg-green-100 text-green-800 border-green-300';
  if (threshold === 'REVISE') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (threshold === 'REJECT') return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
}

function formatCategoryName(name: string): string {
  // Convert camelCase to Title Case
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export default function RubricScoreDisplay({ rubricScore }: RubricScoreDisplayProps) {
  const parsed = safeJsonParse<RubricScore>(rubricScore);

  if (!parsed) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500">No rubric score available</p>
      </div>
    );
  }

  const { totalScore, categoryScores, categoryNotes, acceptanceThreshold, rubricVersion } = parsed;
  const maxScore = 10; // Rubrics are out of 10 points
  const scorePercentage = (totalScore / maxScore) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Rubric Score</h3>
      </div>

      {/* Total Score Display */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Total Score</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{totalScore.toFixed(1)}</span>
            <span className="text-sm text-gray-500">/ {maxScore}</span>
            <span
              className={`px-2 py-1 rounded text-xs font-semibold border ${getThresholdColor(
                acceptanceThreshold
              )}`}
            >
              {acceptanceThreshold}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              acceptanceThreshold === 'ACCEPT'
                ? 'bg-green-600'
                : acceptanceThreshold === 'REVISE'
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
            }`}
            style={{ width: `${Math.min(100, scorePercentage)}%` }}
          />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Category Breakdown</h4>
          <span className="text-xs text-gray-500">
            Sum: {Object.values(categoryScores).reduce((a, b) => a + b, 0).toFixed(1)} / {totalScore.toFixed(1)} total
          </span>
        </div>
        <div className="space-y-3">
          {Object.entries(categoryScores).map(([category, score]) => {
            const note = categoryNotes[category] || '';
            
            // Determine max score: use unified rubric max scores
            let maxCategoryScore = UNIFIED_RUBRIC_MAX_SCORES[category];
            
            // If not found, try camelCase/snake_case variants
            if (maxCategoryScore === undefined) {
              // Try converting snake_case to camelCase and vice versa
              const camelCase = category.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              const snakeCase = category.replace(/([A-Z])/g, '_$1').toLowerCase();
              maxCategoryScore = UNIFIED_RUBRIC_MAX_SCORES[camelCase] || 
                                 UNIFIED_RUBRIC_MAX_SCORES[snakeCase];
            }
            
            // Final fallback: infer from score value (should rarely be needed)
            if (maxCategoryScore === undefined) {
              const categoryLower = category.toLowerCase();
              if (categoryLower.includes('scenario') && categoryLower.includes('clarity')) {
                maxCategoryScore = 1.0;
              } else if (categoryLower.includes('hidden') && categoryLower.includes('question')) {
                maxCategoryScore = 1.0;
              } else if (categoryLower.includes('conditional') && categoryLower.includes('answer')) {
                maxCategoryScore = 1.5;
              } else if (categoryLower.includes('wise') && categoryLower.includes('refusal')) {
                maxCategoryScore = 2.0;
              } else if (categoryLower.includes('difficulty') || categoryLower.includes('calibration') ||
                         categoryLower.includes('final') || categoryLower.includes('label') ||
                         categoryLower.includes('trap') && categoryLower.includes('type')) {
                maxCategoryScore = 1.0;
              } else {
                // Last resort: infer from score value
                if (score <= 1.0 && score > 0) {
                  maxCategoryScore = 1.0;
                } else if (score <= 1.5 && score > 1.0) {
                  maxCategoryScore = 1.5;
                } else if (score <= 2.0) {
                  maxCategoryScore = 2.0;
                } else {
                  maxCategoryScore = Math.ceil(score);
                }
              }
            }

            const categoryPercentage = maxCategoryScore > 0 ? (score / maxCategoryScore) * 100 : 0;

            return (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCategoryName(category)}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {score.toFixed(score % 1 === 0 ? 0 : 1)} / {maxCategoryScore}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full ${
                      categoryPercentage >= 80
                        ? 'bg-green-500'
                        : categoryPercentage >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, categoryPercentage)}%` }}
                  />
                </div>
                {note && (
                  <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{note}</p>
                )}
              </div>
            );
          })}
        </div>
        {/* Debug: Show if sum doesn't match total */}
        {(() => {
          const sum = Object.values(categoryScores).reduce((a, b) => a + b, 0);
          const diff = Math.abs(sum - totalScore);
          
          if (diff > 0.1) {
            return (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <strong>Score Mismatch:</strong> Sum of category scores ({sum.toFixed(1)}) 
                does not match total score ({totalScore.toFixed(1)}). Difference: {diff.toFixed(1)} points.
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}
