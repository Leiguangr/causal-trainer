'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

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
  hiddenTimestamp: string | null;
  conditionalAnswers: string | null;
  initialAuthor: string | null;
  validator: string | null;
  validationStatus: string;
  validatorNotes: string | null;
  sourceCase: string | null;
  // Rubric scores (per revised Table 7)
  scenarioClarityScore: number | null;      // 0-1 pt
  hiddenQuestionScore: number | null;       // 0-1 pt
  conditionalAnswerAScore: number | null;   // 0-1.5 pts
  conditionalAnswerBScore: number | null;   // 0-1.5 pts
  wiseRefusalScore: number | null;          // 0-2 pts
  difficultyCalibrationScore: number | null; // 0-1 pt
  finalLabelScore: number | null;           // 0-1 pt (NEW)
  trapTypeScore: number | null;             // 0-1 pt (NEW)
  finalScore: number | null;                // 0-10 total
}

// Revised rubric scores per Table 7 (Assignment 2 Revised)
interface RubricScores {
  scenarioClarity: number;      // 0-1 pt
  hiddenQuestion: number;       // 0-1 pt
  conditionalAnswerA: number;   // 0-1.5 pts
  conditionalAnswerB: number;   // 0-1.5 pts
  wiseRefusal: number;          // 0-2 pts
  difficultyCalibration: number; // 0-1 pt
  finalLabel: number;           // 0-1 pt (NEW)
  trapType: number;             // 0-1 pt (NEW)
}

// Default scores start at 0 - scores should come from LLM auto-validation
const DEFAULT_SCORES: RubricScores = {
  scenarioClarity: 0,
  hiddenQuestion: 0,
  conditionalAnswerA: 0,
  conditionalAnswerB: 0,
  wiseRefusal: 0,
  difficultyCalibration: 0,
  finalLabel: 0,
  trapType: 0,
};

// Target distribution for CS372 Assignment 2 (Revised: 170 cases, L1:L2:L3 = 1:6:3)
const TARGETS = {
  total: 170,
  L1: 17,
  L2: 102,
  L3: 51,
};

export default function ValidatePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showQuestionList, setShowQuestionList] = useState(false);
  
  // Filter state
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all'); // 'all', 'rejected', 'revision', 'accepted'
  
  // Validator identity
  const [validator, setValidator] = useState<string>('');
  const [showValidatorModal, setShowValidatorModal] = useState(false);
  
  // Rubric scores for current question
  const [scores, setScores] = useState<RubricScores>(DEFAULT_SCORES);
  const [validatorNotes, setValidatorNotes] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    scored: 0,
    approved: 0,
    rejected: 0,
    byLevel: { L1: 0, L2: 0, L3: 0 },
  });

  // Auto-validation state
  const [isAutoValidating, setIsAutoValidating] = useState(false);
  const [autoValidationProgress, setAutoValidationProgress] = useState({ processed: 0, remaining: 0 });

  // View mode: 'card' or 'json'
  const [viewMode, setViewMode] = useState<'card' | 'json'>('card');

  // JSON editing state
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [editedJson, setEditedJson] = useState<string>('');

  // Load validator from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cs372-validator');
    if (saved) setValidator(saved);
    else setShowValidatorModal(true);
  }, []);

  // Fetch questions
  useEffect(() => {
    fetchQuestions();
  }, [filterLevel, filterStatus, filterScore]);

  // Auto-switch to 'scored' filter if no pending but there are scored cases
  useEffect(() => {
    if (stats.pending === 0 && stats.scored > 0 && filterStatus === 'pending') {
      setFilterStatus('scored');
    }
  }, [stats.pending, stats.scored, filterStatus]);

  // Update scores when question changes
  useEffect(() => {
    if (questions.length > 0) {
      const q = questions[currentIndex];
      setScores({
        scenarioClarity: q.scenarioClarityScore ?? DEFAULT_SCORES.scenarioClarity,
        hiddenQuestion: q.hiddenQuestionScore ?? DEFAULT_SCORES.hiddenQuestion,
        conditionalAnswerA: q.conditionalAnswerAScore ?? DEFAULT_SCORES.conditionalAnswerA,
        conditionalAnswerB: q.conditionalAnswerBScore ?? DEFAULT_SCORES.conditionalAnswerB,
        wiseRefusal: q.wiseRefusalScore ?? DEFAULT_SCORES.wiseRefusal,
        difficultyCalibration: q.difficultyCalibrationScore ?? DEFAULT_SCORES.difficultyCalibration,
        finalLabel: q.finalLabelScore ?? DEFAULT_SCORES.finalLabel,
        trapType: q.trapTypeScore ?? DEFAULT_SCORES.trapType,
      });
      setValidatorNotes(q.validatorNotes || '');
    }
  }, [currentIndex, questions]);

  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, s) => sum + s, 0);
  }, [scores]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('dataset', 'cs372-assignment2');
      if (filterLevel !== 'all') params.set('pearlLevel', filterLevel);
      if (filterStatus !== 'all') params.set('validationStatus', filterStatus);
      if (filterScore !== 'all') params.set('scoreFilter', filterScore);
      params.set('limit', '500');

      const res = await fetch(`/api/admin/validate?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setStats(data.stats);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (status: 'scored' | 'approved' | 'rejected') => {
    if (!questions[currentIndex] || !validator) {
      if (!validator) setShowValidatorModal(true);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/validate/${questions[currentIndex].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validator,
          validationStatus: status,
          validatorNotes,
          // Revised rubric scores (Table 7)
          scenarioClarityScore: scores.scenarioClarity,
          hiddenQuestionScore: scores.hiddenQuestion,
          conditionalAnswerAScore: scores.conditionalAnswerA,
          conditionalAnswerBScore: scores.conditionalAnswerB,
          wiseRefusalScore: scores.wiseRefusal,
          difficultyCalibrationScore: scores.difficultyCalibration,
          finalLabelScore: scores.finalLabel,
          trapTypeScore: scores.trapType,
          finalScore: totalScore,
        }),
      });

      if (res.ok) {
        // Move to next question
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
        // Refresh to update stats
        fetchQuestions();
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-validate pending cases using LLM
  const runAutoValidation = async (batchSize: number = 10) => {
    if (isAutoValidating) return;

    setIsAutoValidating(true);
    try {
      // Process in batches until no more pending
      let processed = 0;
      let remaining = stats.pending;

      while (remaining > 0) {
        const res = await fetch('/api/admin/validate/auto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: batchSize }),
        });

        if (!res.ok) break;

        const data = await res.json();
        processed += data.processed;
        remaining = data.remaining;
        setAutoValidationProgress({ processed, remaining });

        if (data.processed === 0) break;
      }

      // Refresh the list
      fetchQuestions();
      alert(`Auto-validation complete! Processed ${processed} cases.`);
    } catch (error) {
      console.error('Auto-validation error:', error);
      alert('Auto-validation failed. Check console for details.');
    } finally {
      setIsAutoValidating(false);
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = score / max;
    if (pct >= 0.8) return 'text-green-600';
    if (pct >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'scored': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Trap type code mappings (matching export route)
  // Canonical name lookup tables
  const L1_NAMES: Record<string, string> = {
    'W1': 'Selection Bias', 'W2': 'Survivorship Bias', 'W3': 'Healthy User Bias',
    'W4': 'Regression to Mean', 'W5': 'Ecological Fallacy', 'W6': 'Base Rate Neglect',
    'W7': 'Confounding', 'W8': "Simpson's Paradox", 'W9': 'Reverse Causation',
    'W10': 'Post Hoc Fallacy', 'S1': 'RCT', 'S2': 'Natural Experiment',
    'S3': 'Lottery/Quasi-Random', 'S4': 'Controlled Ablation', 'S5': 'Mechanism + Dose',
    'S6': 'Instrumental Variable', 'S7': 'Diff-in-Diff', 'S8': 'Regression Discontinuity',
    'A': 'Ambiguous',
  };
  const L2_NAMES: Record<string, string> = {
    'T1': 'Selection', 'T2': 'Survivorship', 'T3': 'Collider', 'T4': 'Immortal Time',
    'T5': 'Regression', 'T6': 'Ecological', 'T7': 'Confounder', 'T8': "Simpson's",
    'T9': 'Conf-Med', 'T10': 'Reverse', 'T11': 'Feedback', 'T12': 'Temporal',
    'T13': 'Measurement', 'T14': 'Recall', 'T15': 'Mechanism', 'T16': 'Goodhart', 'T17': 'Backfire',
  };
  const L3_NAMES: Record<string, string> = {
    'F1': 'Deterministic', 'F2': 'Probabilistic', 'F3': 'Overdetermination',
    'F4': 'Structural', 'F5': 'Temporal', 'F6': 'Epistemic',
    'F7': 'Attribution', 'F8': 'Moral/Legal',
  };

  const getTrapCode = (pearlLevel: string, trapType: string | null): { code: string; name: string } => {
    if (!trapType) return { code: '', name: '' };

    // DB format is "CODE:NAME" (e.g., "S8:Regression Discontinuity", "T8:SIMPSON'S")
    // Parse out the code and look up canonical name
    if (trapType.includes(':')) {
      const [code] = trapType.split(':');
      const nameMap = pearlLevel === 'L1' ? L1_NAMES : pearlLevel === 'L2' ? L2_NAMES : L3_NAMES;
      const canonicalName = nameMap[code];
      return { code, name: canonicalName || trapType.split(':').slice(1).join(':') };
    }

    // Fallback for old format without colon
    return { code: trapType, name: trapType };
  };

  // Generate export JSON for current case (matches revised Assignment 2 spec)
  const getExportJson = (q: Question, index: number) => {
    let variables, conditionalAnswers;
    try { variables = q.variables ? JSON.parse(q.variables) : null; } catch { variables = null; }
    try { conditionalAnswers = q.conditionalAnswers ? JSON.parse(q.conditionalAnswers) : null; } catch { conditionalAnswers = null; }

    const bucket = 'BucketLarge-G';
    const caseIdNum = q.sourceCase || `${index + 1}.1`;
    const fullId = `T3-${bucket}-${caseIdNum}`;

    // Map groundTruth to label based on Pearl level (per revised spec Table 10)
    // L1: YES, NO, AMBIGUOUS
    // L2: NO (all cases)
    // L3: VALID, INVALID, CONDITIONAL
    let label = q.groundTruth;

    if (q.pearlLevel === 'L2') {
      // All L2 cases must be labeled "NO" per revised spec
      label = 'NO';
    } else if (q.pearlLevel === 'L3') {
      // L3 uses VALID/INVALID/CONDITIONAL instead of YES/NO/AMBIGUOUS
      if (label === 'YES') {
        label = 'VALID';
      } else if (label === 'NO') {
        label = 'INVALID';
      } else if (label === 'AMBIGUOUS') {
        label = 'CONDITIONAL';
      }
    }

    // Determine if ambiguous based on label
    const isAmbiguous = label === 'AMBIGUOUS' || label === 'CONDITIONAL';

    // Format Z as array (required by revised spec)
    let zArray: string[] = [];
    if (variables?.Z) {
      zArray = Array.isArray(variables.Z) ? variables.Z : [variables.Z];
    }

    // Format X/Y as objects with name and role (per revised spec)
    const formatVar = (val: unknown, role: string) => {
      if (!val) return null;
      if (typeof val === 'object' && val !== null && 'name' in val) {
        return val; // Already in object format
      }
      return {
        name: String(val),
        role: role
      };
    };

    // Build formatted variables
    let formattedVariables: Record<string, unknown> | null = null;
    if (variables) {
      formattedVariables = {
        X: formatVar(variables.X, 'exposure'),
        Y: formatVar(variables.Y, 'outcome'),
        Z: zArray
      };
      // Add X' for L3 counterfactual cases if present
      if (q.pearlLevel === 'L3' && variables["X'"]) {
        formattedVariables["X'"] = variables["X'"];
      }
    }

    // Get trap code info
    const trapInfo = getTrapCode(q.pearlLevel, q.trapType);

    const exportCase: Record<string, unknown> = {
      id: fullId,
      case_id: caseIdNum,
      bucket: bucket,
      pearl_level: q.pearlLevel,
      domain: q.domain,
      subdomain: q.subdomain || null,
      scenario: q.scenario,
      claim: q.claim,
      label: label,
      is_ambiguous: isAmbiguous,
      variables: formattedVariables,
      trap: {
        type: trapInfo.code || null,
        type_name: trapInfo.name || null,
        subtype: q.trapSubtype || null,
        subtype_name: q.trapSubtype ? q.trapSubtype.replace(/_/g, ' ') : null
      },
      difficulty: q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1).toLowerCase() : 'Medium',
      causal_structure: q.causalStructure || null,
      key_insight: q.keyInsight || null,
      hidden_timestamp: q.hiddenTimestamp || null,
      conditional_answers: conditionalAnswers ? {
        answer_if_condition_1: Array.isArray(conditionalAnswers) ? conditionalAnswers[0] : conditionalAnswers.answer_if_condition_1 || null,
        answer_if_condition_2: Array.isArray(conditionalAnswers) ? conditionalAnswers[1] : conditionalAnswers.answer_if_condition_2 || null
      } : null,
      wise_refusal: q.wiseRefusal || null,
      gold_rationale: q.explanation || q.wiseRefusal || null,
      initial_author: q.initialAuthor || 'Unknown',
      validator: q.validator || null,
      final_score: q.finalScore || null
    };

    return exportCase;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading validation queue...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No cases to validate</h2>
          <p className="text-gray-600 mb-4">
            {filterStatus === 'pending'
              ? 'All cases have been validated!'
              : 'No cases match the current filters.'}
          </p>
          <button
            onClick={() => router.push('/admin/generate')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
          >
            Generate More Cases
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CS372 Validation</h1>
            <p className="text-gray-600 mt-1">
              {stats.total} total • {stats.pending} pending • {stats.approved} approved • {stats.rejected} rejected
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-validation button */}
            {stats.pending > 0 && (
              <button
                onClick={() => runAutoValidation(10)}
                disabled={isAutoValidating}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  isAutoValidating
                    ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <span className="text-lg">{isAutoValidating ? '⏳' : '🤖'}</span>
                <span className="text-sm font-medium">
                  {isAutoValidating
                    ? `Auto-scoring... (${autoValidationProgress.processed}/${autoValidationProgress.processed + autoValidationProgress.remaining})`
                    : `Auto-Score ${stats.pending} Pending`
                  }
                </span>
              </button>
            )}
            <button
              onClick={() => setShowValidatorModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                validator ? 'bg-green-50 border-green-300 text-green-700' : 'bg-yellow-50 border-yellow-300 text-yellow-700'
              }`}
            >
              <span className="text-lg">{validator ? '👤' : '⚠️'}</span>
              <span className="text-sm font-medium">{validator || 'Set Validator'}</span>
            </button>
            <button
              onClick={() => router.push('/admin/generate')}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              + Generate
            </button>
            <button
              onClick={() => router.push('/admin/review')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Full Editor
            </button>
          </div>
        </div>

        {/* Progress Dashboard */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          {/* Target vs Current */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.approved}</div>
              <div className="text-xs text-gray-500">Approved / {TARGETS.total}</div>
              <div className="h-1 bg-gray-200 rounded mt-2">
                <div className="h-1 bg-green-500 rounded" style={{ width: `${Math.min(100, (stats.approved / TARGETS.total) * 100)}%` }} />
              </div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{stats.byLevel.L1}</div>
              <div className="text-xs text-gray-500">L1 / {TARGETS.L1}</div>
              <div className="h-1 bg-gray-200 rounded mt-2">
                <div className="h-1 bg-blue-500 rounded" style={{ width: `${Math.min(100, (stats.byLevel.L1 / TARGETS.L1) * 100)}%` }} />
              </div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{stats.byLevel.L2}</div>
              <div className="text-xs text-gray-500">L2 / {TARGETS.L2}</div>
              <div className="h-1 bg-gray-200 rounded mt-2">
                <div className="h-1 bg-purple-500 rounded" style={{ width: `${Math.min(100, (stats.byLevel.L2 / TARGETS.L2) * 100)}%` }} />
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{stats.byLevel.L3}</div>
              <div className="text-xs text-gray-500">L3 / {TARGETS.L3}</div>
              <div className="h-1 bg-gray-200 rounded mt-2">
                <div className="h-1 bg-orange-500 rounded" style={{ width: `${Math.min(100, (stats.byLevel.L3 / TARGETS.L3) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Validation Progress */}
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Validation Progress</span>
                <span>{stats.approved + stats.rejected} / {stats.total} reviewed</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div className="bg-green-500" style={{ width: `${(stats.approved / Math.max(1, stats.total)) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(stats.rejected / Math.max(1, stats.total)) * 100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(stats.scored / Math.max(1, stats.total)) * 100}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>🟢 {stats.approved} approved</span>
                <span>🔴 {stats.rejected} rejected</span>
                <span>🔵 {stats.scored} scored</span>
                <span>⚪ {stats.pending} pending</span>
              </div>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <span className="text-sm text-gray-600 self-center mr-2">Export:</span>
            <a href="/api/admin/export/cs372?type=schema" className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">📄 Schema</a>
            <a href="/api/admin/export/cs372?type=scores" className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">📊 Scores CSV</a>
            <a href="/api/admin/export/cs372?type=dataset" className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">✅ Dataset ({stats.approved})</a>
            <a href="/admin/distribution" className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 ml-auto">📈 Distribution</a>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex gap-4 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border-2 border-blue-400 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            <option value="all">All Status</option>
            <option value="pending">⏳ Pending</option>
            <option value="scored">📝 Scored</option>
            <option value="approved">✅ Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>
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
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Scores</option>
            <option value="rejected">❌ Rejected (&lt;6)</option>
            <option value="revision">⚠️ Needs Revision (6-7)</option>
            <option value="accepted">✅ Accepted (≥8)</option>
          </select>
          {/* View Mode Toggle */}
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'card' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📄 Card
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'json' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {'{ }'} JSON
            </button>
          </div>
          <button
            onClick={() => setShowQuestionList(!showQuestionList)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              showQuestionList ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            📋 Case List
          </button>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300"
          >
            ← Previous
          </button>
          <span className="text-gray-700 font-medium">
            Case {currentIndex + 1} / {questions.length}
            <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusBadge(current.validationStatus)}`}>
              {current.validationStatus}
            </span>
          </span>
          <button
            onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300"
          >
            Next →
          </button>
        </div>

        {/* Case List (collapsible) */}
        {showQuestionList && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`text-xs p-2 rounded border truncate ${
                    idx === currentIndex ? 'bg-primary-100 border-primary-500' : getStatusBadge(q.validationStatus)
                  }`}
                >
                  #{idx + 1} {q.pearlLevel} - {q.finalScore !== null ? `${q.finalScore}/10` : '...'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content - Two Columns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Case Display (Card or JSON view) */}
          <div className="bg-white rounded-lg shadow-sm p-6 max-h-[700px] overflow-y-auto">
            {viewMode === 'json' ? (
              /* JSON View with Editing */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">
                    {isEditingJson ? '✏️ Edit JSON' : 'Export JSON Preview'}
                  </h3>
                  <div className="flex gap-2">
                    {isEditingJson ? (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              const parsed = JSON.parse(editedJson);
                              const res = await fetch(`/api/admin/validate/${current.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(parsed),
                              });
                              if (res.ok) {
                                alert('Saved successfully!');
                                setIsEditingJson(false);
                                fetchQuestions();
                              } else {
                                alert('Failed to save');
                              }
                            } catch (e) {
                              alert('Invalid JSON: ' + e);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={() => setIsEditingJson(false)}
                          className="px-3 py-1 text-sm bg-gray-300 hover:bg-gray-400 rounded"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditedJson(JSON.stringify(getExportJson(current, currentIndex), null, 2));
                            setIsEditingJson(true);
                          }}
                          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            const json = JSON.stringify(getExportJson(current, currentIndex), null, 2);
                            navigator.clipboard.writeText(json);
                            alert('JSON copied to clipboard!');
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          📋 Copy
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isEditingJson ? (
                  <textarea
                    value={editedJson}
                    onChange={(e) => setEditedJson(e.target.value)}
                    className="w-full h-[500px] bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed">
                    {JSON.stringify(getExportJson(current, currentIndex), null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              /* Card View */
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    current.pearlLevel === 'L1' ? 'bg-blue-100 text-blue-700' :
                    current.pearlLevel === 'L2' ? 'bg-purple-100 text-purple-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {current.pearlLevel}
                  </span>
                  <span className="text-gray-600">{current.domain}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{current.trapType}</span>
                  <span className={`ml-auto px-2 py-1 rounded text-sm ${
                    current.groundTruth === 'YES' ? 'bg-green-100 text-green-700' :
                    current.groundTruth === 'NO' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {current.groundTruth}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Scenario</h3>
                    <p className="text-gray-900 whitespace-pre-wrap">{current.scenario}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Claim</h3>
                    <p className="text-gray-900 italic">&quot;{current.claim}&quot;</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-700 mb-1">Variables</h3>
                    <pre className="bg-gray-50 p-2 rounded text-sm">{current.variables}</pre>
                  </div>

                  {current.hiddenTimestamp && current.hiddenTimestamp !== 'N/A' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <h3 className="font-semibold text-yellow-800 mb-1">Hidden Question</h3>
                      <p className="text-yellow-900 text-sm">{current.hiddenTimestamp}</p>
                    </div>
                  )}

                  {current.conditionalAnswers && current.conditionalAnswers !== 'N/A' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h3 className="font-semibold text-blue-800 mb-1">Conditional Answers</h3>
                      <pre className="text-blue-900 text-sm whitespace-pre-wrap">{current.conditionalAnswers}</pre>
                    </div>
                  )}

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h3 className="font-semibold text-green-800 mb-1">Wise Refusal</h3>
                    <p className="text-green-900 text-sm">{current.wiseRefusal}</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-700 mb-1">Explanation</h3>
                    <p className="text-gray-900 text-sm">{current.explanation}</p>
                  </div>

                  <div className="text-sm text-gray-500">
                    Author: {current.initialAuthor} | Difficulty: {current.difficulty}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Rubric Scoring */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
              <span>📋 Validation Rubric</span>
              <span className={`text-2xl font-bold ${getScoreColor(totalScore, 10)}`}>
                {totalScore.toFixed(1)} / 10
              </span>
            </h2>

            {/* Revised Rubric per Table 7 - 10 points total */}
            <div className="space-y-3">
              {/* Scenario Clarity - 1 point (revised from 2) */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Scenario Clarity</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.scenarioClarity, 1)}`}>
                    {scores.scenarioClarity} / 1
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">X, Y, Z clearly defined</p>
                <input
                  type="range"
                  min="0" max="1" step="0.5"
                  value={scores.scenarioClarity}
                  onChange={(e) => setScores(s => ({...s, scenarioClarity: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Hidden Question - 1 point (revised from 2) */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Hidden Question Quality</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.hiddenQuestion, 1)}`}>
                    {scores.hiddenQuestion} / 1
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Identifies causal confusion</p>
                <input
                  type="range"
                  min="0" max="1" step="0.5"
                  value={scores.hiddenQuestion}
                  onChange={(e) => setScores(s => ({...s, hiddenQuestion: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Conditional Answer A - 1.5 points */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Conditional Answer A</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.conditionalAnswerA, 1.5)}`}>
                    {scores.conditionalAnswerA} / 1.5
                  </span>
                </div>
                <input
                  type="range"
                  min="0" max="1.5" step="0.5"
                  value={scores.conditionalAnswerA}
                  onChange={(e) => setScores(s => ({...s, conditionalAnswerA: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Conditional Answer B - 1.5 points */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Conditional Answer B</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.conditionalAnswerB, 1.5)}`}>
                    {scores.conditionalAnswerB} / 1.5
                  </span>
                </div>
                <input
                  type="range"
                  min="0" max="1.5" step="0.5"
                  value={scores.conditionalAnswerB}
                  onChange={(e) => setScores(s => ({...s, conditionalAnswerB: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Wise Refusal - 2 points */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Wise Refusal Quality</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.wiseRefusal, 2)}`}>
                    {scores.wiseRefusal} / 2
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Complete answer with verdict</p>
                <input
                  type="range"
                  min="0" max="2" step="0.5"
                  value={scores.wiseRefusal}
                  onChange={(e) => setScores(s => ({...s, wiseRefusal: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Difficulty Calibration - 1 point */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Difficulty Calibration</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.difficultyCalibration, 1)}`}>
                    {scores.difficultyCalibration} / 1
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Appropriate difficulty level</p>
                <input
                  type="range"
                  min="0" max="1" step="0.5"
                  value={scores.difficultyCalibration}
                  onChange={(e) => setScores(s => ({...s, difficultyCalibration: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Final Label - 1 point (NEW) */}
              <div className="border rounded-lg p-3 bg-blue-50">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Final Label</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.finalLabel, 1)}`}>
                    {scores.finalLabel} / 1
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Correct label for Pearl level</p>
                <input
                  type="range"
                  min="0" max="1" step="0.5"
                  value={scores.finalLabel}
                  onChange={(e) => setScores(s => ({...s, finalLabel: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Trap Type - 1 point (NEW) */}
              <div className="border rounded-lg p-3 bg-blue-50">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-sm">Trap Type</label>
                  <span className={`font-bold text-sm ${getScoreColor(scores.trapType, 1)}`}>
                    {scores.trapType} / 1
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Correctly classified trap</p>
                <input
                  type="range"
                  min="0" max="1" step="0.5"
                  value={scores.trapType}
                  onChange={(e) => setScores(s => ({...s, trapType: parseFloat(e.target.value)}))}
                  className="w-full"
                />
              </div>

              {/* Validator Notes */}
              <div>
                <label className="block font-medium mb-1">Validator Notes</label>
                <textarea
                  value={validatorNotes}
                  onChange={(e) => setValidatorNotes(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Notes about this case..."
                />
              </div>
            </div>

            {/* Score Thresholds Legend */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium mb-1">Score Thresholds:</div>
              <div className="flex gap-4">
                <span className="text-green-600">≥8: Accept</span>
                <span className="text-yellow-600">6-7: Revise</span>
                <span className="text-red-600">&lt;6: Reject</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleSave('rejected')}
                disabled={isSaving}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleSave('scored')}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                💾 Save Score
              </button>
              <button
                onClick={() => handleSave('approved')}
                disabled={isSaving || totalScore < 6}
                className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Validator Modal */}
      {showValidatorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">👤 Set Validator Identity</h2>
            <p className="text-gray-600 mb-4">
              Enter your email to track your validations.
            </p>
            <input
              type="email"
              value={validator}
              onChange={(e) => setValidator(e.target.value)}
              placeholder="your-email@stanford.edu"
              className="w-full p-3 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowValidatorModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (validator) {
                    localStorage.setItem('cs372-validator', validator);
                    setShowValidatorModal(false);
                  }
                }}
                disabled={!validator}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

