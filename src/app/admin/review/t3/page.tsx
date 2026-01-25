'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getL1EvidenceByClass, getAllL1EvidenceTypes } from '@/lib/l1-evidence-taxonomy';
import { getAllL2TrapTypes, getL2TrapByCode } from '@/lib/l2-trap-taxonomy';
import { getAllL3Families, getL3FamilyByCode } from '@/lib/l3-family-taxonomy';

type CaseType = 'L1' | 'L2' | 'L3' | 'all';

interface L1Case {
  id: string;
  _caseType: 'L1';
  scenario: string;
  claim: string;
  groundTruth: string;
  evidenceClass: string;
  evidenceType: string | null;
  whyFlawedOrValid: string;
  domain: string | null;
  subdomain: string | null;
  difficulty: string;
  variables: string | null;
  causalStructure: string | null;
  dataset: string;
  author: string | null;
  sourceCase: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface L2Case {
  id: string;
  _caseType: 'L2';
  scenario: string;
  variables: string | null;
  trapType: string;
  difficulty: string;
  causalStructure: string | null;
  hiddenQuestion: string;
  answerIfA: string;
  answerIfB: string;
  wiseRefusal: string;
  dataset: string;
  author: string | null;
  sourceCase: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface L3Case {
  id: string;
  _caseType: 'L3';
  caseId: string | null;
  domain: string | null;
  family: string;
  difficulty: string;
  scenario: string;
  counterfactualClaim: string;
  variables: string;
  invariants: string;
  groundTruth: string;
  justification: string;
  wiseResponse: string;
  dataset: string;
  author: string | null;
  sourceCase: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type T3Case = L1Case | L2Case | L3Case;

interface Dataset {
  name: string;
  totalCount: number;
  verifiedCount: number;
}

interface Filters {
  domains: string[];
  evidenceClasses: string[];
  trapTypes: string[];
  families: string[];
}

export default function ReviewT3Page() {
  const router = useRouter();
  const [cases, setCases] = useState<T3Case[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCaseList, setShowCaseList] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterCaseType, setFilterCaseType] = useState<CaseType>('all');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterEvidenceClass, setFilterEvidenceClass] = useState<string>('all');
  const [filterTrapType, setFilterTrapType] = useState<string>('all');
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [filterGroundTruth, setFilterGroundTruth] = useState<string>('all');
  const [filterDataset, setFilterDataset] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [availableFilters, setAvailableFilters] = useState<Filters>({
    domains: [],
    evidenceClasses: [],
    trapTypes: [],
    families: [],
  });
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);

  // Form state
  const [formData, setFormData] = useState<Partial<T3Case>>({});

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
    fetchCases();
  }, [filterCaseType, filterDomain, filterEvidenceClass, filterTrapType, filterFamily, filterGroundTruth, filterDataset, sortBy]);

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (cases.length > 0) {
      setFormData(cases[currentIndex]);
    }
  }, [currentIndex, cases]);

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

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCaseType !== 'all') params.set('caseType', filterCaseType);
      if (filterDomain !== 'all') params.set('domain', filterDomain);
      if (filterEvidenceClass !== 'all') params.set('evidenceClass', filterEvidenceClass);
      if (filterTrapType !== 'all') params.set('trapType', filterTrapType);
      if (filterFamily !== 'all') params.set('family', filterFamily);
      if (filterGroundTruth !== 'all') params.set('groundTruth', filterGroundTruth);
      if (filterDataset !== 'all') params.set('dataset', filterDataset);
      params.set('sortBy', sortBy);
      params.set('limit', '500');

      const res = await fetch(`/api/admin/t3-cases/unverified?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        setTotal(data.total);
        setAvailableFilters(data.filters || { domains: [], evidenceClasses: [], trapTypes: [], families: [] });
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (approve: boolean = false) => {
    if (!formData.id) return;

    setIsSaving(true);
    try {
      const authorToUse = globalAuthor;

      const res = await fetch(`/api/admin/t3-cases/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          _caseType: formData._caseType,
          author: authorToUse,
          isVerified: approve,
        }),
      });

      if (res.ok) {
        if (approve) {
          setApprovedIds(prev => new Set(prev).add(formData.id!));
          if (currentIndex < cases.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          }
        } else {
          alert('Saved as draft');
        }
        await fetchCases();
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!formData.id || !confirm('Delete this case?')) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/t3-cases/${formData.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const newCases = cases.filter((_, i) => i !== currentIndex);
        setCases(newCases);
        if (newCases.length === 0) {
          alert('All cases reviewed!');
          router.push('/admin/generate');
        } else {
          setCurrentIndex(Math.min(currentIndex, newCases.length - 1));
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof T3Case, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading cases...</div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No unverified T3 cases</h2>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/admin/generate')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
            >
              Generate Questions
            </button>
            <button
              onClick={() => router.push('/admin/review')}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
            >
              Review Legacy
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = formData;
  const currentCaseType = current._caseType;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review T3 Cases</h1>
            <p className="text-gray-600 mt-1">
              {total} unverified total • Showing {cases.length} matching filters
            </p>
            <p className="text-sm text-gray-500 mt-1">
              L1Case, L2Case, L3Case tables • For legacy questions, use Review Legacy
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              value={filterCaseType}
              onChange={(e) => setFilterCaseType(e.target.value as CaseType)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Types</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>

            {filterCaseType === 'L1' || filterCaseType === 'all' ? (
              <>
                <select
                  value={filterEvidenceClass}
                  onChange={(e) => setFilterEvidenceClass(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All Evidence Classes</option>
                  {availableFilters.evidenceClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            ) : null}

            {filterCaseType === 'L2' || filterCaseType === 'all' ? (
              <select
                value={filterTrapType}
                onChange={(e) => setFilterTrapType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Trap Types</option>
                {availableFilters.trapTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : null}

            {filterCaseType === 'L3' || filterCaseType === 'all' ? (
              <select
                value={filterFamily}
                onChange={(e) => setFilterFamily(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Families</option>
                {availableFilters.families.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : null}

            {(filterCaseType === 'L1' || filterCaseType === 'L3' || filterCaseType === 'all') && (
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
            )}

            <select
              value={filterGroundTruth}
              onChange={(e) => setFilterGroundTruth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Ground Truth</option>
              {(filterCaseType === 'L1' || filterCaseType === 'all') && (
                <>
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                  <option value="AMBIGUOUS">AMBIGUOUS</option>
                </>
              )}
              {(filterCaseType === 'L3' || filterCaseType === 'all') && (
                <>
                  <option value="VALID">VALID</option>
                  <option value="INVALID">INVALID</option>
                  <option value="CONDITIONAL">CONDITIONAL</option>
                </>
              )}
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
              <option value="domain">Domain (A→Z)</option>
              <option value="groundTruth">Ground Truth</option>
            </select>

            <button
              onClick={() => setShowCaseList(!showCaseList)}
              className={`ml-auto px-3 py-1.5 rounded-lg text-sm ${
                showCaseList ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              📋 Case List
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
              {currentIndex + 1} / {cases.length}
              {approvedIds.size > 0 && (
                <span className="ml-2 text-green-600">({approvedIds.size} ✓)</span>
              )}
            </span>
            <input
              type="number"
              min={1}
              max={cases.length}
              value={currentIndex + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= cases.length) {
                  setCurrentIndex(val - 1);
                }
              }}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
            />
          </div>
          <button
            onClick={() => setCurrentIndex(Math.min(cases.length - 1, currentIndex + 1))}
            disabled={currentIndex === cases.length - 1}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Case List Sidebar */}
        {showCaseList && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Jump to Case ({cases.length} total{approvedIds.size > 0 ? `, ${approvedIds.size} approved` : ''})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {cases.map((c, idx) => {
                const isApproved = approvedIds.has(c.id);
                const groundTruth = c._caseType === 'L1' ? (c as L1Case).groundTruth : 
                                   c._caseType === 'L3' ? (c as L3Case).groundTruth : null;
                const groundTruthColor = groundTruth === 'YES' || groundTruth === 'VALID' 
                  ? 'bg-green-100 text-green-700'
                  : groundTruth === 'NO' || groundTruth === 'INVALID'
                  ? 'bg-red-100 text-red-700'
                  : groundTruth === 'AMBIGUOUS' || groundTruth === 'CONDITIONAL'
                  ? 'bg-yellow-100 text-yellow-700'
                  : '';
                return (
                  <button
                    key={c.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`text-left text-xs p-2 rounded border truncate ${
                      isApproved
                        ? 'bg-green-50 border-green-400'
                        : idx === currentIndex
                          ? 'bg-primary-100 border-primary-500 text-primary-800'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      {isApproved && <span className="text-green-600">✓ </span>}
                      <span className="font-mono text-gray-500">#{idx + 1}</span>
                      <span className={`px-1 rounded ${
                        c._caseType === 'L1' ? 'bg-blue-100 text-blue-700' :
                        c._caseType === 'L2' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {c._caseType}
                      </span>
                      {groundTruth && groundTruthColor && (
                        <span className={`px-1 rounded text-[10px] font-medium ${groundTruthColor}`}>
                          {groundTruth}
                        </span>
                      )}
                    </div>
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
            <h2 className="text-xl font-semibold mb-4">Case Preview</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Case Type</h3>
                <span className={`px-2 py-1 rounded text-sm ${
                  currentCaseType === 'L1' ? 'bg-blue-100 text-blue-700' :
                  currentCaseType === 'L2' ? 'bg-purple-100 text-purple-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {currentCaseType}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Scenario</h3>
                <p className="text-gray-900">{current.scenario || '(No scenario)'}</p>
              </div>

              {currentCaseType === 'L1' && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Claim</h3>
                    <p className="text-gray-900 italic">"{(current as L1Case).claim || '(No claim)'}"</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Why Flawed/Valid</h3>
                    <p className="text-gray-900">{(current as L1Case).whyFlawedOrValid || '(No explanation)'}</p>
                  </div>
                </>
              )}

              {currentCaseType === 'L2' && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Hidden Question</h3>
                    <p className="text-gray-900">{(current as L2Case).hiddenQuestion || '(No hidden question)'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Answer if A</h3>
                    <p className="text-gray-900">{(current as L2Case).answerIfA || '(No answer)'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Answer if B</h3>
                    <p className="text-gray-900">{(current as L2Case).answerIfB || '(No answer)'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Wise Refusal</h3>
                    <p className="text-gray-900">{(current as L2Case).wiseRefusal || '(No refusal)'}</p>
                  </div>
                </>
              )}

              {currentCaseType === 'L3' && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Counterfactual Claim</h3>
                    <p className="text-gray-900 italic">"{(current as L3Case).counterfactualClaim || '(No claim)'}"</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Invariants</h3>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                      {(() => {
                        try {
                          const inv = (current as L3Case).invariants;
                          if (typeof inv === 'string') {
                            const parsed = JSON.parse(inv);
                            return Array.isArray(parsed) ? parsed.join('\n') : inv;
                          }
                          return inv || '[]';
                        } catch {
                          return (current as L3Case).invariants || '[]';
                        }
                      })()}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Justification</h3>
                    <p className="text-gray-900">{(current as L3Case).justification || '(No justification)'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Wise Response</h3>
                    <p className="text-gray-900">{(current as L3Case).wiseResponse || '(No response)'}</p>
                  </div>
                </>
              )}

              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Variables</h3>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                  {current.variables || '{}'}
                </pre>
              </div>
            </div>
          </div>

          {/* Right: Edit Form */}
          <div className="bg-white rounded-lg shadow-sm p-6 overflow-y-auto max-h-[800px]">
            <h2 className="text-xl font-semibold mb-4">Edit Case</h2>

            <div className="space-y-4">
              {/* Common fields */}
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

              {/* L1-specific fields */}
              {currentCaseType === 'L1' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Claim
                    </label>
                    <textarea
                      value={(current as L1Case).claim || ''}
                      onChange={(e) => updateField('claim', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ground Truth
                      </label>
                      <select
                        value={(current as L1Case).groundTruth || ''}
                        onChange={(e) => updateField('groundTruth', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="YES">YES</option>
                        <option value="NO">NO</option>
                        <option value="AMBIGUOUS">AMBIGUOUS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Evidence Class
                      </label>
                      <select
                        value={(current as L1Case).evidenceClass || ''}
                        onChange={(e) => {
                          updateField('evidenceClass', e.target.value);
                          if (e.target.value === 'NONE') {
                            updateField('evidenceType', null);
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="WOLF">WOLF</option>
                        <option value="SHEEP">SHEEP</option>
                        <option value="NONE">NONE</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Evidence Type
                    </label>
                    <select
                      value={(current as L1Case).evidenceType || ''}
                      onChange={(e) => updateField('evidenceType', e.target.value || null)}
                      disabled={(current as L1Case).evidenceClass === 'NONE'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
                    >
                      <option value="">None</option>
                      {(() => {
                        const cls = (current as L1Case).evidenceClass;
                        if (cls === 'WOLF' || cls === 'SHEEP') {
                          const evidenceTypes = getL1EvidenceByClass(cls);
                          return evidenceTypes.map(e => (
                            <option key={e.code} value={e.code}>{e.code} - {e.label}</option>
                          ));
                        }
                        return null;
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Why Flawed/Valid
                    </label>
                    <textarea
                      value={(current as L1Case).whyFlawedOrValid || ''}
                      onChange={(e) => updateField('whyFlawedOrValid', e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}

              {/* L2-specific fields */}
              {currentCaseType === 'L2' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trap Type
                    </label>
                    <select
                      value={(current as L2Case).trapType || ''}
                      onChange={(e) => updateField('trapType', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {getAllL2TrapTypes().map(t => {
                        const def = getL2TrapByCode(t);
                        return (
                          <option key={t} value={t}>{t} - {def?.name || t}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hidden Question
                    </label>
                    <textarea
                      value={(current as L2Case).hiddenQuestion || ''}
                      onChange={(e) => updateField('hiddenQuestion', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Answer if A
                    </label>
                    <textarea
                      value={(current as L2Case).answerIfA || ''}
                      onChange={(e) => updateField('answerIfA', e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Answer if B
                    </label>
                    <textarea
                      value={(current as L2Case).answerIfB || ''}
                      onChange={(e) => updateField('answerIfB', e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wise Refusal
                    </label>
                    <textarea
                      value={(current as L2Case).wiseRefusal || ''}
                      onChange={(e) => updateField('wiseRefusal', e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}

              {/* L3-specific fields */}
              {currentCaseType === 'L3' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Family
                      </label>
                      <select
                        value={(current as L3Case).family || ''}
                        onChange={(e) => updateField('family', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        {getAllL3Families().map(f => {
                          const def = getL3FamilyByCode(f);
                          return (
                            <option key={f} value={f}>{f} - {def?.name || f}</option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ground Truth
                      </label>
                      <select
                        value={(current as L3Case).groundTruth || ''}
                        onChange={(e) => updateField('groundTruth', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="VALID">VALID</option>
                        <option value="INVALID">INVALID</option>
                        <option value="CONDITIONAL">CONDITIONAL</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Counterfactual Claim
                    </label>
                    <textarea
                      value={(current as L3Case).counterfactualClaim || ''}
                      onChange={(e) => updateField('counterfactualClaim', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invariants (JSON array)
                    </label>
                    <textarea
                      value={(() => {
                        try {
                          const inv = (current as L3Case).invariants;
                          if (typeof inv === 'string') {
                            const parsed = JSON.parse(inv);
                            return Array.isArray(parsed) ? JSON.stringify(parsed, null, 2) : inv;
                          }
                          return inv || '[]';
                        } catch {
                          return (current as L3Case).invariants || '[]';
                        }
                      })()}
                      onChange={(e) => updateField('invariants', e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Justification
                    </label>
                    <textarea
                      value={(current as L3Case).justification || ''}
                      onChange={(e) => updateField('justification', e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wise Response
                    </label>
                    <textarea
                      value={(current as L3Case).wiseResponse || ''}
                      onChange={(e) => updateField('wiseResponse', e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}

              {/* Common fields continued */}
              <div className="grid grid-cols-2 gap-4">
                {(currentCaseType === 'L1' || currentCaseType === 'L3') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain
                    </label>
                    <input
                      value={(currentCaseType === 'L1' ? (current as L1Case).domain : (current as L3Case).domain) || ''}
                      onChange={(e) => updateField('domain', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

                {currentCaseType === 'L1' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdomain
                    </label>
                    <input
                      value={(current as L1Case).subdomain || ''}
                      onChange={(e) => updateField('subdomain', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

                {currentCaseType === 'L3' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Case ID
                    </label>
                    <input
                      value={(current as L3Case).caseId || ''}
                      onChange={(e) => updateField('caseId', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

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
                  placeholder="e.g., Z → X, Z → Y"
                />
              </div>

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
                    placeholder="e.g., G.123"
                    disabled
                  />
                </div>
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

      {/* Author Settings Modal */}
      {showAuthorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">👤 Set Your Author Name</h2>
              <p className="text-gray-600 mb-4">
                This will be used as the default author for all cases you review.
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
