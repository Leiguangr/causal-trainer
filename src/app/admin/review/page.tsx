'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Question {
  id: string;
  scenario: string;
  // Legacy field: separate claim, now embedded in scenario for new questions
  claim?: string | null;
  pearlLevel: string;
  domain: string;
  subdomain: string | null;
  trapType: string;
  trapSubtype: string;
  // Legacy short explanation; canonical reasoning lives in wiseRefusal
  explanation?: string | null;
  difficulty: string;
  groundTruth: string;
  variables: string | null;
  causalStructure: string | null;
  keyInsight: string | null;
  wiseRefusal: string | null;
  hiddenTimestamp?: string | null;
  reviewNotes: string | null;
  sourceCase: string | null;
}

export default function ReviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState<Partial<Question>>({});

  useEffect(() => {
    fetchQuestions();
  }, [filterLevel]);

  useEffect(() => {
    if (questions.length > 0) {
      setFormData(questions[currentIndex]);
    }
  }, [currentIndex, questions]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') {
        params.set('pearlLevel', filterLevel);
      }
      
      const res = await fetch(`/api/admin/questions/unverified?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (approve: boolean = false) => {
    if (!formData.id) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/questions/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isVerified: approve,
        }),
      });

      if (res.ok) {
        if (approve) {
          // Move to next question
          const newQuestions = questions.filter((_, i) => i !== currentIndex);
          setQuestions(newQuestions);
          if (newQuestions.length === 0) {
            alert('All questions reviewed!');
            router.push('/admin/generate');
          } else {
            setCurrentIndex(Math.min(currentIndex, newQuestions.length - 1));
          }
        } else {
          alert('Saved as draft');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!formData.id || !confirm('Delete this question?')) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/questions/${formData.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const newQuestions = questions.filter((_, i) => i !== currentIndex);
        setQuestions(newQuestions);
        if (newQuestions.length === 0) {
          alert('All questions reviewed!');
          router.push('/admin/generate');
        } else {
          setCurrentIndex(Math.min(currentIndex, newQuestions.length - 1));
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof Question, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading questions...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No unverified questions</h2>
          <button
            onClick={() => router.push('/admin/generate')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
          >
            Generate Questions
          </button>
        </div>
      </div>
    );
  }

  const current = formData;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Questions</h1>
            <p className="text-gray-600 mt-1">
              Question {currentIndex + 1} of {questions.length} • Case {current.sourceCase || 'N/A'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">All Levels</option>
              <option value="L1">L1 Only</option>
              <option value="L2">L2 Only</option>
              <option value="L3">L3 Only</option>
            </select>
            <button
              onClick={() => router.push('/admin/generate')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Generate
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-gray-700 font-medium">
            {currentIndex + 1} / {questions.length}
          </span>
          <button
            onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Display */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Question Preview</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Scenario</h3>
                <p className="text-gray-900">{current.scenario}</p>
              </div>

              {current.claim && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Claim (legacy)</h3>
                  <p className="text-gray-900 italic">"{current.claim}"</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Variables</h3>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                  {current.variables || '{}'}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-700">Pearl Level:</span>
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                    {current.pearlLevel}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Domain:</span>
                  <span className="ml-2 text-gray-900">{current.domain}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Trap Type:</span>
                  <span className="ml-2 text-gray-900">{current.trapType}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Difficulty:</span>
                  <span className="ml-2 text-gray-900 capitalize">{current.difficulty}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Edit Form */}
          <div className="bg-white rounded-lg shadow-sm p-6 overflow-y-auto max-h-[800px]">
            <h2 className="text-xl font-semibold mb-4">Edit Annotations</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scenario
                </label>
                <textarea
                  value={current.scenario || ''}
                  onChange={(e) => updateField('scenario', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* Claim is legacy-only; new questions embed claim in scenario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Claim (legacy, optional)
                </label>
                <textarea
                  value={current.claim || ''}
                  onChange={(e) => updateField('claim', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Optional legacy field; new questions should encode the claim inside the scenario."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pearl Level
                  </label>
                  <select
                    value={current.pearlLevel || ''}
                    onChange={(e) => updateField('pearlLevel', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ground Truth
                  </label>
                  <select
                    value={current.groundTruth || ''}
                    onChange={(e) => updateField('groundTruth', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="VALID">VALID</option>
                    <option value="INVALID">INVALID</option>
                    <option value="CONDITIONAL">CONDITIONAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain
                  </label>
                  <input
                    value={current.domain || ''}
                    onChange={(e) => updateField('domain', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subdomain
                  </label>
                  <input
                    value={current.subdomain || ''}
                    onChange={(e) => updateField('subdomain', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trap Type
                  </label>
                  <input
                    value={current.trapType || ''}
                    onChange={(e) => updateField('trapType', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trap Subtype
                  </label>
                  <input
                    value={current.trapSubtype || ''}
                    onChange={(e) => updateField('trapSubtype', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={current.difficulty || ''}
                  onChange={(e) => updateField('difficulty', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variables (JSON)
                </label>
                <textarea
                  value={current.variables || ''}
                  onChange={(e) => updateField('variables', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Causal Structure
                </label>
                <input
                  value={current.causalStructure || ''}
                  onChange={(e) => updateField('causalStructure', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., Z → X, Z → Y (confounding)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Insight
                </label>
                <input
                  value={current.keyInsight || ''}
                  onChange={(e) => updateField('keyInsight', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="One-line takeaway"
                />
              </div>

              {/* Explanation is legacy; canonical reasoning should be in wiseRefusal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explanation (legacy, optional)
                </label>
                <textarea
                  value={current.explanation || ''}
                  onChange={(e) => updateField('explanation', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Legacy short explanation. Prefer putting full reasoning in Wise Refusal."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wise Refusal
                </label>
                <textarea
                  value={current.wiseRefusal || ''}
                  onChange={(e) => updateField('wiseRefusal', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="The claim is [VALID/INVALID/CONDITIONAL]..."
                />
              </div>

              {/* Hidden Timestamp (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hidden Timestamp (optional, JSON)
                </label>
                <textarea
                  value={current.hiddenTimestamp || ''}
                  onChange={(e) => updateField('hiddenTimestamp', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder='{"condition1": "Z occurs before X ...", "condition2": "X occurs before Z ..."}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use when the ordering of Z and X matters (e.g., leak vs. trade timing). Leave empty otherwise.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes (Internal)
                </label>
                <textarea
                  value={current.reviewNotes || ''}
                  onChange={(e) => updateField('reviewNotes', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Notes for other reviewers..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <button
              onClick={handleReject}
              disabled={isSaving}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              ❌ Reject & Delete
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
              >
                💾 Save Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                ✅ Approve & Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
