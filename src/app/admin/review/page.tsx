'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CHEATSHEET_TAXONOMY } from '@/lib/cheatsheet-taxonomy';

interface Question {
  id: string;
  scenario: string;
  claim: string;
  pearlLevel: string;
  domain: string;
  subdomain: string | null;
  trapType: string;
  trapSubtype: string;
  explanation: string;
  difficulty: string;
  groundTruth: string;
  variables: string | null;
  causalStructure: string | null;
  keyInsight: string | null;
  wiseRefusal: string | null;
  reviewNotes: string | null;
  sourceCase: string | null;
  dataset: string;
  // New metadata fields
  author: string | null;
  hiddenTimestamp: string | null;
  conditionalAnswers: string | null;
}

interface Dataset {
  name: string;
  totalCount: number;
  verifiedCount: number;
}

interface Filters {
  domains: string[];
  trapTypes: string[];
}

export default function ReviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterGroundTruth, setFilterGroundTruth] = useState<string>('all');
  const [filterTrapType, setFilterTrapType] = useState<string>('all');
  const [filterDataset, setFilterDataset] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [availableFilters, setAvailableFilters] = useState<Filters>({ domains: [], trapTypes: [] });
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);

  // Form state
  const [formData, setFormData] = useState<Partial<Question>>({});

  // Challenge AI state
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Global author setting (persisted in localStorage)
  const [globalAuthor, setGlobalAuthor] = useState<string>('');
  const [showAuthorModal, setShowAuthorModal] = useState(false);

  // Load global author from localStorage on mount
  useEffect(() => {
    const savedAuthor = localStorage.getItem('causal-trainer-author');
    if (savedAuthor) {
      setGlobalAuthor(savedAuthor);
    }
  }, []);

  // Save global author to localStorage when changed
  const updateGlobalAuthor = (author: string) => {
    setGlobalAuthor(author);
    if (author) {
      localStorage.setItem('causal-trainer-author', author);
    } else {
      localStorage.removeItem('causal-trainer-author');
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filterLevel, filterDomain, filterGroundTruth, filterTrapType, filterDataset, sortBy]);

  useEffect(() => {
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

  useEffect(() => {
    if (questions.length > 0) {
      setFormData(questions[currentIndex]);
    }
  }, [currentIndex, questions]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.set('pearlLevel', filterLevel);
      if (filterDomain !== 'all') params.set('domain', filterDomain);
      if (filterGroundTruth !== 'all') params.set('groundTruth', filterGroundTruth);
      if (filterTrapType !== 'all') params.set('trapType', filterTrapType);
      if (filterDataset !== 'all') params.set('dataset', filterDataset);
      params.set('sortBy', sortBy);
      params.set('limit', '500');

      const res = await fetch(`/api/admin/questions/unverified?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setTotal(data.total);
        setAvailableFilters(data.filters || { domains: [], trapTypes: [] });
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
      // Always use global author
      const authorToUse = globalAuthor;

      const res = await fetch(`/api/admin/questions/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          author: authorToUse,
          isVerified: approve,
        }),
      });

      if (res.ok) {
        if (approve) {
          // Track approved ID and move to next question
          setApprovedIds(prev => new Set(prev).add(formData.id!));
          // Move to next question (but keep in list with approved badge)
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateFields = (updates: Partial<Question>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleChallenge = async () => {
    if (!challengeText.trim() || !formData.id) return;

    setIsRevising(true);
    try {
      const res = await fetch('/api/admin/questions/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: formData,
          challenge: challengeText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Revision response:', data);
        console.log('Revised fields:', Object.keys(data.revised || {}));

        if (!data.revised || Object.keys(data.revised).length === 0) {
          alert('AI did not suggest any changes. It may have agreed with the current assessment or misunderstood the challenge.');
          return;
        }

        // Update form with revised data, keeping the id
        const updatedFormData = {
          ...formData,
          ...data.revised,
          id: formData.id,
        };

        // Auto-save revision as draft to prevent hot-reload from losing changes
        const savePayload = {
          ...updatedFormData,
          isVerified: false, // Keep as draft for review
          reviewNotes: `[AI Revised] Challenge: ${challengeText.substring(0, 100)}...`,
        };
        console.log('Saving revised question with payload:', savePayload);
        console.log('Revised scenario:', savePayload.scenario?.substring(0, 100));
        console.log('Revised groundTruth:', savePayload.groundTruth);

        const saveRes = await fetch(`/api/admin/questions/${formData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savePayload),
        });

        if (saveRes.ok) {
          // Refresh the question from database
          await fetchQuestions();
          setShowChallengeModal(false);
          setChallengeText('');

          const changedFields = Object.keys(data.revised).join(', ');
          alert(`Question revised and saved as draft!\n\nChanged fields: ${changedFields}\n\nReview and click "Verify & Save" when ready.`);
        } else {
          // Still update form even if save failed
          setFormData(updatedFormData);
          setShowChallengeModal(false);
          setChallengeText('');
          alert('Revision applied to form but auto-save failed. Please click Save manually.');
        }
      } else {
        const error = await res.json();
        alert(`Failed to revise: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Challenge error:', error);
      alert('Failed to revise question');
    } finally {
      setIsRevising(false);
    }
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
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Questions</h1>
            <p className="text-gray-600 mt-1">
              {total} unverified total • Showing {questions.length} matching filters
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Author indicator */}
            <button
              onClick={() => setShowAuthorModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                globalAuthor
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-yellow-50 border-yellow-300 text-yellow-700'
              }`}
            >
              <span className="text-lg">{globalAuthor ? '👤' : '⚠️'}</span>
              <span className="text-sm font-medium">
                {globalAuthor || 'Set Author'}
              </span>
            </button>
            <button
              onClick={() => router.push('/admin/generate')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Generate
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Dataset Filter - prominent */}
            <select
              value={filterDataset}
              onChange={(e) => setFilterDataset(e.target.value)}
              className="border-2 border-blue-400 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <option value="all">📁 All Datasets</option>
              {datasets.map(d => (
                <option key={d.name} value={d.name}>
                  📁 {d.name} ({d.totalCount - d.verifiedCount} pending)
                </option>
              ))}
            </select>

            <div className="border-l border-gray-300 h-6 mx-1" />

            <span className="text-sm font-medium text-gray-700">Filters:</span>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>

            <select
              value={filterGroundTruth}
              onChange={(e) => setFilterGroundTruth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Validity</option>
              <option value="YES">✓ Yes</option>
              <option value="NO">✗ No</option>
              <option value="AMBIGUOUS">? Ambiguous</option>
            </select>

            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Domains</option>
              {availableFilters.domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={filterTrapType}
              onChange={(e) => setFilterTrapType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Trap Types</option>
              {availableFilters.trapTypes.map(t => (
                <option key={t} value={t}>{t || 'NONE'}</option>
              ))}
            </select>

            <div className="border-l border-gray-300 h-6 mx-2" />

            <span className="text-sm font-medium text-gray-700">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="random">🎲 Random</option>
              <option value="level-asc">Level (L1→L3)</option>
              <option value="level-desc">Level (L3→L1)</option>
              <option value="domain">Domain (A→Z)</option>
              <option value="groundTruth">Validity</option>
            </select>

            <button
              onClick={() => setShowQuestionList(!showQuestionList)}
              className={`ml-auto px-3 py-1.5 rounded-lg text-sm ${
                showQuestionList ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              📋 Question List
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <div className="flex items-center gap-3">
            <span className="text-gray-700 font-medium">
              {currentIndex + 1} / {questions.length}
              {approvedIds.size > 0 && (
                <span className="ml-2 text-green-600">({approvedIds.size} ✓)</span>
              )}
            </span>
            <input
              type="number"
              min={1}
              max={questions.length}
              value={currentIndex + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= questions.length) {
                  setCurrentIndex(val - 1);
                }
              }}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
            />
          </div>
          <button
            onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Question List Sidebar (collapsible) */}
        {showQuestionList && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Jump to Question ({questions.length} total{approvedIds.size > 0 ? `, ${approvedIds.size} approved` : ''})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isApproved = approvedIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`text-left text-xs p-2 rounded border truncate ${
                      isApproved
                        ? 'bg-green-50 border-green-400'
                        : idx === currentIndex
                          ? 'bg-primary-100 border-primary-500 text-primary-800'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {isApproved && <span className="text-green-600">✓ </span>}
                    <span className="font-mono text-gray-500">#{idx + 1}</span>
                    {' '}
                    <span className={`px-1 rounded ${
                      q.pearlLevel === 'L1' ? 'bg-blue-100 text-blue-700' :
                      q.pearlLevel === 'L2' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {q.pearlLevel}
                    </span>
                    {' '}
                    <span className={`px-1 rounded ${
                      q.groundTruth === 'YES' ? 'bg-green-100 text-green-700' :
                      q.groundTruth === 'NO' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {q.groundTruth?.charAt(0)}
                    </span>
                    {' '}
                    <span className="text-gray-600">{q.domain}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Claim</h3>
                <p className="text-gray-900 italic">"{current.claim}"</p>
              </div>

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

              {/* AI Reasoning */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-2">🤖 AI Reasoning</h3>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="font-medium text-amber-800 mb-1">Explanation</div>
                  <p className="text-amber-900 text-sm">{current.explanation || '(No explanation provided)'}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="font-medium text-blue-800 mb-1">Wise Refusal Response</div>
                  <p className="text-blue-900 text-sm">{current.wiseRefusal || '(No response provided)'}</p>
                </div>

                {current.keyInsight && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="font-medium text-green-800 mb-1">Key Insight</div>
                    <p className="text-green-900 text-sm">{current.keyInsight}</p>
                  </div>
                )}

                {current.causalStructure && (
                  <div className="mt-3 text-sm text-gray-600">
                    <span className="font-medium">Causal Structure:</span> {current.causalStructure}
                  </div>
                )}
              </div>

              {/* AI Review Notes (if present) */}
              {current.reviewNotes && current.reviewNotes.includes('[AI Review') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">🔍 AI Review</h3>
                  <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${
                    current.reviewNotes.includes('Verdict: APPROVE')
                      ? 'bg-green-50 border border-green-200 text-green-900'
                      : current.reviewNotes.includes('Verdict: REJECT')
                      ? 'bg-red-50 border border-red-200 text-red-900'
                      : 'bg-yellow-50 border border-yellow-200 text-yellow-900'
                  }`}>
                    {current.reviewNotes}
                  </div>
                </div>
              )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Claim
                </label>
                <textarea
                  value={current.claim || ''}
                  onChange={(e) => updateField('claim', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                    <option value="AMBIGUOUS">AMBIGUOUS</option>
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
                  <select
                    value={current.trapType || ''}
                    onChange={(e) => {
                      const newTrapType = e.target.value;
                      // Update both trapType and trapSubtype atomically
                      if (newTrapType === 'NONE') {
                        updateFields({ trapType: 'NONE', trapSubtype: 'NONE' });
                      } else {
                        const trapDef = CHEATSHEET_TAXONOMY.find(t => t.type === newTrapType);
                        const firstSubtype = trapDef?.subtypes[0]?.name || 'NONE';
                        updateFields({ trapType: newTrapType, trapSubtype: firstSubtype });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="NONE">NONE (for YES/AMBIGUOUS)</option>
                    {CHEATSHEET_TAXONOMY.map(t => (
                      <option key={t.type} value={t.type}>{t.label} ({t.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trap Subtype
                  </label>
                  <select
                    value={current.trapSubtype || ''}
                    onChange={(e) => updateField('trapSubtype', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    disabled={!current.trapType || current.trapType === 'NONE'}
                  >
                    <option value="NONE">NONE</option>
                    {current.trapType && current.trapType !== 'NONE' && (
                      CHEATSHEET_TAXONOMY.find(t => t.type === current.trapType)?.subtypes.map(s => (
                        <option key={s.name} value={s.name}>{s.name.replace(/_/g, ' ')} ({s.pearlLevel})</option>
                      ))
                    )}
                  </select>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explanation
                </label>
                <textarea
                  value={current.explanation || ''}
                  onChange={(e) => updateField('explanation', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  placeholder="YES/NO/AMBIGUOUS - The claim is..."
                />
              </div>

              {/* AMBIGUOUS-specific fields */}
              {current.groundTruth === 'AMBIGUOUS' && (
                <div className="border-t border-b border-yellow-200 bg-yellow-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-medium text-yellow-800 flex items-center gap-2">
                    ⚠️ AMBIGUOUS Case Fields
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hidden Timestamp Question
                      <span className="text-gray-400 ml-2 font-normal">
                        (What temporal/causal ordering would resolve this?)
                      </span>
                    </label>
                    <textarea
                      value={current.hiddenTimestamp === 'TBD' ? '' : (current.hiddenTimestamp || '')}
                      onChange={(e) => updateField('hiddenTimestamp', e.target.value || 'TBD')}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Did sales lag throughout the quarter (tX effect), or only during the storm window (tZ effect)?"
                    />
                    {current.hiddenTimestamp === 'TBD' && (
                      <p className="text-xs text-yellow-600 mt-1">⚠️ Needs annotation</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conditional Answers
                      <span className="text-gray-400 ml-2 font-normal">
                        (JSON: &quot;Answer if...&quot; sections)
                      </span>
                    </label>
                    <textarea
                      value={current.conditionalAnswers === 'TBD' ? '' : (current.conditionalAnswers || '')}
                      onChange={(e) => updateField('conditionalAnswers', e.target.value || 'TBD')}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                      placeholder={`{
  "ifScenarioA": "Answer if tZ dominates: The storm (Z) prevented shoppers...",
  "ifScenarioB": "Answer if tX dominates: Sales were bad (Y) due to mix (X)..."
}`}
                    />
                    {current.conditionalAnswers === 'TBD' && (
                      <p className="text-xs text-yellow-600 mt-1">⚠️ Needs annotation</p>
                    )}
                  </div>
                </div>
              )}

              {/* Author field */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Author/Annotator
                    {globalAuthor && (
                      <span className="ml-2 text-green-600 font-normal text-xs">
                        ✓ Using: {globalAuthor}
                      </span>
                    )}
                  </label>
                  {globalAuthor ? (
                    <div className="w-full border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-green-700 font-medium">
                      {globalAuthor}
                    </div>
                  ) : (
                    <input
                      value={current.author || ''}
                      onChange={(e) => updateField('author', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Set global author in header →"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Case
                  </label>
                  <input
                    value={current.sourceCase || ''}
                    onChange={(e) => updateField('sourceCase', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., 3.15"
                    disabled
                  />
                </div>
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
                onClick={() => {
                  const jsonData = JSON.stringify(formData, null, 2);
                  navigator.clipboard.writeText(jsonData);
                  alert('JSON copied to clipboard!');
                }}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
              >
                📋 Copy JSON
              </button>
              <button
                onClick={() => setShowChallengeModal(true)}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700"
              >
                🤔 Challenge AI
              </button>
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

      {/* Challenge AI Modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">🤔 Challenge AI Response</h2>
              <p className="text-gray-600 mb-4">
                Explain why you think the current answer is incorrect or incomplete.
                The AI will revise the question based on your feedback.
              </p>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Current Ground Truth:</p>
                <p className={`font-bold ${
                  formData.groundTruth === 'YES' ? 'text-green-600' :
                  formData.groundTruth === 'NO' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {formData.groundTruth}
                </p>
                <p className="text-sm text-gray-500 mt-2 mb-1">Trap Type:</p>
                <p className="font-medium">{formData.trapType} / {formData.trapSubtype}</p>
              </div>

              <textarea
                value={challengeText}
                onChange={(e) => setChallengeText(e.target.value)}
                placeholder="Example: The study only looks at surviving companies that are still listed. Companies that failed during 2010-2015 when consumer sentiment dropped would be excluded from the sample, creating survivorship bias. This makes the observed correlation unreliable..."
                className="w-full h-48 p-3 border rounded-lg resize-none"
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowChallengeModal(false);
                    setChallengeText('');
                  }}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChallenge}
                  disabled={isRevising || !challengeText.trim()}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                >
                  {isRevising ? 'Revising...' : '🔄 Revise Question'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Author Settings Modal */}
      {showAuthorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">👤 Set Your Author Name</h2>
              <p className="text-gray-600 mb-4">
                This will be used as the default author for all questions you review.
                It&apos;s saved in your browser.
              </p>

              <input
                type="text"
                value={globalAuthor}
                onChange={(e) => setGlobalAuthor(e.target.value)}
                placeholder="e.g., your-email@stanford.edu"
                className="w-full p-3 border rounded-lg mb-4"
                autoFocus
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    updateGlobalAuthor('');
                    setShowAuthorModal(false);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowAuthorModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateGlobalAuthor(globalAuthor);
                    setShowAuthorModal(false);
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

