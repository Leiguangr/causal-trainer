'use client';

interface RubricScore {
  totalScore: number;
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  acceptanceThreshold: 'ACCEPT' | 'REVISE' | 'REJECT';
  rubricVersion: string;
}

// Expected categories and their max scores by rubric level
const EXPECTED_CATEGORIES: Record<string, Record<string, number>> = {
  'L1-v1.0': {
    scenarioClarity: 2,
    causalClaimExplicitness: 1,
    wiseRefusalQuality: 2,
    groundTruthUnambiguity: 2,
    difficultyCalibration: 1,
    domainPlausibility: 1,
    noiseDiscipline: 1,
  },
  'L2-v1.0': {
    scenarioClarity: 2.0,
    hiddenQuestionQuality: 2.0,
    conditionalAnswerA: 1.5,
    conditionalAnswerB: 1.5,
    wiseRefusalQuality: 2.0,
    difficultyCalibration: 1.0,
  },
  'L3-v1.0': {
    selfContained: 2.0,
    clarity: 2.0,
    correctness: 2.0,
    familyFit: 1.5,
    novelty: 1.5,
    realism: 1.0,
  },
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
        {rubricVersion && (
          <span className="text-xs text-gray-500 font-mono">{rubricVersion}</span>
        )}
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
            
            // Determine max score: first try to get from expected categories based on rubric version
            let maxCategoryScore = 2.0;
            const expected = EXPECTED_CATEGORIES[rubricVersion];
            if (expected && expected[category] !== undefined) {
              maxCategoryScore = expected[category];
            } else {
              // Fallback: infer from category name patterns
              const categoryLower = category.toLowerCase();
              
              if (categoryLower.includes('explicitness') || categoryLower.includes('calibration') || 
                  categoryLower.includes('plausibility') || categoryLower.includes('discipline') || 
                  categoryLower.includes('realism')) {
                maxCategoryScore = 1.0;
              } else if (categoryLower.includes('answer') || categoryLower.includes('fit') || 
                         categoryLower.includes('novelty')) {
                maxCategoryScore = 1.5;
              } else if (score <= 1.0 && score > 0) {
                maxCategoryScore = 1.0;
              } else if (score <= 1.5 && score > 1.0) {
                maxCategoryScore = 1.5;
              } else if (score <= 2.0) {
                maxCategoryScore = 2.0;
              } else {
                maxCategoryScore = Math.ceil(score);
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
        {/* Debug: Show if sum doesn't match total or if expected categories are missing */}
        {(() => {
          const sum = Object.values(categoryScores).reduce((a, b) => a + b, 0);
          const diff = Math.abs(sum - totalScore);
          const expected = EXPECTED_CATEGORIES[rubricVersion];
          const missingCategories: string[] = [];
          
          if (expected) {
            Object.keys(expected).forEach(cat => {
              if (!(cat in categoryScores)) {
                missingCategories.push(cat);
              }
            });
          }
          
          if (diff > 0.1 || missingCategories.length > 0) {
            return (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                {diff > 0.1 && (
                  <div className="mb-2">
                    <strong>Score Mismatch:</strong> Sum of category scores ({sum.toFixed(1)}) 
                    does not match total score ({totalScore.toFixed(1)}). Difference: {diff.toFixed(1)} points.
                  </div>
                )}
                {missingCategories.length > 0 && (
                  <div>
                    <strong>Missing Categories:</strong> {missingCategories.map(c => formatCategoryName(c)).join(', ')} 
                    {missingCategories.length === 1 ? ' is' : ' are'} expected for {rubricVersion} but not present in the scores.
                  </div>
                )}
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}
