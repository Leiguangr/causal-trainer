'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getL1EvidenceByClass, getAllL1EvidenceTypes } from '@/lib/l1-evidence-taxonomy';
import { getAllL2TrapTypes, getL2TrapByCode } from '@/lib/l2-trap-taxonomy';
import { getAllL3Families, getL3FamilyByCode } from '@/lib/l3-family-taxonomy';

// No conversion needed - database returns snake_case directly

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

  // Transform unified T3Case schema to display interfaces (using snake_case directly)
  function transformToDisplayCase(c: any): T3Case {
    const pearlLevel = c.pearl_level || c._caseType || 'L1';
    
    if (pearlLevel === 'L1') {
      // Extract evidence class from label (ground truth), not trap_type
      // SHEEP can only be YES, WOLF can only be NO, AMBIGUOUS must be NONE
      const label = c.label || 'AMBIGUOUS';
      let evidenceClass: 'WOLF' | 'SHEEP' | 'NONE' = 'NONE';
      let evidenceType: string | null = null;
      
      if (label === 'YES') {
        evidenceClass = 'SHEEP';
        // Only set evidenceType if trap_type is valid SHEEP type (S1-S8)
        const trapType = c.trap_type || '';
        if (trapType.match(/^S[0-9]+/)) {
          evidenceType = trapType;
        }
      } else if (label === 'NO') {
        evidenceClass = 'WOLF';
        // Only set evidenceType if trap_type is valid WOLF type (W1-W10)
        const trapType = c.trap_type || '';
        if (trapType.match(/^W[0-9]+/)) {
          evidenceType = trapType;
        }
      } else {
        // AMBIGUOUS must always be NONE, regardless of trap_type
        evidenceClass = 'NONE';
        evidenceType = null;
      }
      
      return {
        id: c.id,
        _caseType: 'L1',
        scenario: c.scenario || '',
        claim: c.claim || '',
        groundTruth: c.label || 'AMBIGUOUS',
        evidenceClass,
        evidenceType,
        whyFlawedOrValid: c.gold_rationale || '',
        domain: c.domain || null,
        subdomain: c.subdomain || null,
        difficulty: c.difficulty || 'medium',
        variables: c.variables || null,
        causalStructure: c.causal_structure || null,
        dataset: c.dataset || 'default',
        author: c.author || null,
        sourceCase: c.source_case || null,
        isVerified: c.is_verified || false,
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
      } as L1Case;
    } else if (pearlLevel === 'L2') {
      // Parse hidden_timestamp and conditional_answers
      let hiddenQuestion = '';
      let answerIfA = '';
      let answerIfB = '';
      
      if (c.hidden_timestamp) {
        try {
          const parsed = typeof c.hidden_timestamp === 'string' ? JSON.parse(c.hidden_timestamp) : c.hidden_timestamp;
          hiddenQuestion = typeof parsed === 'string' ? parsed : parsed.question || parsed || '';
        } catch {
          hiddenQuestion = c.hidden_timestamp || '';
        }
      }
      
      if (c.conditional_answers) {
        try {
          const parsed = typeof c.conditional_answers === 'string' ? JSON.parse(c.conditional_answers) : c.conditional_answers;
          answerIfA = parsed.answer_if_condition_1 || parsed.answerIfA || parsed.answer_if_A || '';
          answerIfB = parsed.answer_if_condition_2 || parsed.answerIfB || parsed.answer_if_B || '';
        } catch {
          // If not JSON, treat as string
        }
      }
      
      return {
        id: c.id,
        _caseType: 'L2',
        scenario: c.scenario || '',
        variables: c.variables || null,
        trapType: c.trap_type || '',
        difficulty: c.difficulty || 'medium',
        causalStructure: c.causal_structure || null,
        hiddenQuestion,
        answerIfA,
        answerIfB,
        wiseRefusal: c.wise_refusal || '',
        dataset: c.dataset || 'default',
        author: c.author || null,
        sourceCase: c.source_case || null,
        isVerified: c.is_verified || false,
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
      } as L2Case;
    } else {
      // L3
      return {
        id: c.id,
        _caseType: 'L3',
        caseId: c.case_id || null,
        domain: c.domain || null,
        family: c.trap_type || '', // L3 family is stored in trap_type
        difficulty: c.difficulty || 'medium',
        scenario: c.scenario || '',
        counterfactualClaim: c.counterfactual_claim || '',
        variables: c.variables || '',
        invariants: c.invariants || '',
        groundTruth: c.label || 'CONDITIONAL',
        justification: c.gold_rationale || '',
        wiseResponse: c.wise_refusal || '',
        dataset: c.dataset || 'default',
        author: c.author || null,
        sourceCase: c.source_case || null,
        isVerified: c.is_verified || false,
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
      } as L3Case;
    }
  }

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
        // Transform unified schema to display interfaces
        const transformedCases = (data.cases || []).map((c: any) => transformToDisplayCase(c));
        setCases(transformedCases);
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

  // No conversion needed - formData already uses snake_case compatible field names

  // Transform display case back to unified T3Case schema (snake_case)
  function transformToUnifiedSchema(displayCase: Partial<T3Case>, approve: boolean): any {
    const caseType = displayCase._caseType;
    
    if (caseType === 'L1') {
      const l1 = displayCase as Partial<L1Case>;
      const label = l1.groundTruth || 'AMBIGUOUS';
      
      // Validate and enforce consistency: label determines evidence class
      // SHEEP can only be YES, WOLF can only be NO, AMBIGUOUS must be NONE
      let trapType = l1.evidenceType || '';
      
      if (label === 'AMBIGUOUS') {
        // AMBIGUOUS cases must have trap_type null (not set) and evidenceClass NONE
        trapType = null;
      } else if (label === 'YES') {
        // YES cases must have SHEEP trap types (S1-S8)
        if (!trapType || !trapType.match(/^S[0-9]+/)) {
          // If trap_type is invalid for YES, default to S1
          trapType = 'S1';
        }
      } else if (label === 'NO') {
        // NO cases must have WOLF trap types (W1-W10)
        if (!trapType || !trapType.match(/^W[0-9]+/)) {
          // If trap_type is invalid for NO, default to W1
          trapType = 'W1';
        }
      }
      
      return {
        scenario: l1.scenario,
        claim: l1.claim,
        label,
        trap_type: trapType, // null for AMBIGUOUS, S1-S8 for YES, W1-W10 for NO
        gold_rationale: l1.whyFlawedOrValid,
        domain: l1.domain,
        subdomain: l1.subdomain,
        difficulty: l1.difficulty,
        variables: l1.variables,
        causal_structure: l1.causalStructure,
        author: globalAuthor || l1.author,
        is_verified: approve,
      };
    } else if (caseType === 'L2') {
      const l2 = displayCase as Partial<L2Case>;
      
      // Transform hiddenQuestion to hidden_timestamp
      let hidden_timestamp: string | null = null;
      if (l2.hiddenQuestion) {
        hidden_timestamp = l2.hiddenQuestion;
      }
      
      // Transform answerIfA/answerIfB to conditional_answers JSON
      let conditional_answers: string | null = null;
      if (l2.answerIfA || l2.answerIfB) {
        conditional_answers = JSON.stringify({
          answer_if_condition_1: l2.answerIfA || '',
          answer_if_condition_2: l2.answerIfB || '',
        });
      }
      
      return {
        scenario: l2.scenario,
        claim: l2.claim || null,
        label: 'NO', // L2 always NO
        is_ambiguous: true,
        trap_type: l2.trapType,
        hidden_timestamp,
        conditional_answers,
        wise_refusal: l2.wiseRefusal,
        difficulty: l2.difficulty,
        variables: l2.variables,
        causal_structure: l2.causalStructure,
        author: globalAuthor || l2.author,
        is_verified: approve,
      };
    } else {
      // L3
      const l3 = displayCase as Partial<L3Case>;
      const isConditional = l3.groundTruth === 'CONDITIONAL';
      
      return {
        scenario: l3.scenario,
        counterfactual_claim: l3.counterfactualClaim,
        label: l3.groundTruth,
        is_ambiguous: isConditional,
        trap_type: isConditional ? null : (l3.family || null), // CONDITIONAL should not have trap_type (family) set
        gold_rationale: l3.justification,
        wise_refusal: l3.wiseResponse,
        invariants: l3.invariants,
        domain: l3.domain,
        case_id: l3.caseId,
        difficulty: l3.difficulty,
        variables: l3.variables,
        causal_structure: l3.causalStructure,
        author: globalAuthor || l3.author,
        is_verified: approve,
      };
    }
  }

  const handleSave = async (approve: boolean = false) => {
    if (!formData.id) return;
    
    setIsSaving(true);
    try {
      // Transform display case to unified schema (already in snake_case)
      const unifiedPayload = transformToUnifiedSchema(formData, approve);

      const res = await fetch(`/api/admin/t3-cases/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...unifiedPayload,
          id: formData.id,
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
                onClick={async () => {
                  if (!formData.id) {
                    alert('No case selected');
                    return;
                  }
                  try {
                    // Fetch the case directly from the database to get the exact snake_case format
                    const res = await fetch(`/api/admin/t3-cases/${formData.id}`);
                    if (res.ok) {
                      const data = await res.json();
                      // Format the case data to match export format (snake_case)
                      const caseData = data.case;
                      
                      // Parse JSON strings to objects for better readability
                      let variables = caseData.variables;
                      if (typeof variables === 'string') {
                        try {
                          variables = JSON.parse(variables);
                        } catch {
                          // Keep as string if parsing fails
                        }
                      }
                      
                      let conditional_answers = caseData.conditional_answers;
                      if (typeof conditional_answers === 'string') {
                        try {
                          conditional_answers = JSON.parse(conditional_answers);
                        } catch {
                          // Keep as string if parsing fails
                        }
                      }
                      
                      let hidden_timestamp = caseData.hidden_timestamp;
                      if (typeof hidden_timestamp === 'string' && hidden_timestamp.startsWith('{')) {
                        try {
                          hidden_timestamp = JSON.parse(hidden_timestamp);
                        } catch {
                          // Keep as string if parsing fails
                        }
                      }
                      
                      let invariants = caseData.invariants;
                      if (typeof invariants === 'string') {
                        try {
                          invariants = JSON.parse(invariants);
                        } catch {
                          // Keep as string if parsing fails
                        }
                      }
                      
                      // Build export format matching the database schema (snake_case)
                      const exportData = {
                        id: caseData.id,
                        case_id: caseData.case_id || null,
                        bucket: caseData.bucket || null,
                        pearl_level: caseData.pearl_level,
                        domain: caseData.domain || null,
                        subdomain: caseData.subdomain || null,
                        scenario: caseData.scenario,
                        claim: caseData.claim || null,
                        counterfactual_claim: caseData.counterfactual_claim || null,
                        label: caseData.label,
                        is_ambiguous: caseData.is_ambiguous,
                        variables: variables,
                        trap: {
                          type: caseData.trap_type,
                          type_name: caseData.trap_type_name || null,
                          subtype: caseData.trap_subtype || null,
                          subtype_name: caseData.trap_subtype_name || null,
                        },
                        difficulty: caseData.difficulty,
                        causal_structure: caseData.causal_structure || null,
                        key_insight: caseData.key_insight || null,
                        hidden_timestamp: hidden_timestamp || null,
                        conditional_answers: conditional_answers || null,
                        wise_refusal: caseData.wise_refusal || null,
                        gold_rationale: caseData.gold_rationale || null,
                        invariants: invariants || null,
                        initial_author: caseData.initial_author || null,
                        validator: caseData.validator || null,
                        final_score: caseData.final_score || null,
                        dataset: caseData.dataset,
                        author: caseData.author || null,
                        source_case: caseData.source_case || null,
                        is_verified: caseData.is_verified,
                        created_at: caseData.created_at,
                        updated_at: caseData.updated_at,
                      };
                      
                      const jsonData = JSON.stringify(exportData, null, 2);
                      navigator.clipboard.writeText(jsonData);
                      alert('JSON copied to clipboard! (snake_case format)');
                    } else {
                      alert('Failed to fetch case data');
                    }
                  } catch (error) {
                    console.error('Error copying JSON:', error);
                    alert('Error copying JSON to clipboard');
                  }
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
