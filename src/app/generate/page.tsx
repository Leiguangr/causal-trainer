'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DOMAINS, PEARL_LEVELS, PearlLevel } from '@/types';
import { CHEATSHEET_TAXONOMY, getTrapTypesForLevel, getSubtypesForTypeAndLevel } from '@/lib/cheatsheet-taxonomy';
import type { GeneratedQuestion } from '@/app/api/generate/route';

export default function GeneratePage() {
  const { data: session, status } = useSession();
  const [pearlLevel, setPearlLevel] = useState<PearlLevel>('L1');
  const [trapType, setTrapType] = useState('');
  const [trapSubtype, setTrapSubtype] = useState('');
  const [domain, setDomain] = useState('Markets');
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return <div className="p-8">Loading...</div>;
  if (!session) redirect('/login');

  const availableTrapTypes = getTrapTypesForLevel(pearlLevel);
  const availableSubtypes = trapType ? getSubtypesForTypeAndLevel(trapType, pearlLevel) : [];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pearlLevel, trapType, trapSubtype: trapSubtype || undefined, domain, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setQuestions(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🎲 Problem Generator</h1>
        <p className="text-gray-600 mb-6">Generate new causal reasoning problems using GPT-5.2 and the CS372 cheatsheet taxonomy.</p>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pearl Level */}
            <div>
              <label htmlFor="pearl-level" className="block text-sm font-medium text-gray-700 mb-2">Pearl Level</label>
              <select
                id="pearl-level"
                value={pearlLevel}
                onChange={(e) => { setPearlLevel(e.target.value as PearlLevel); setTrapType(''); setTrapSubtype(''); }}
                className="w-full p-2 border rounded-md"
              >
                {Object.entries(PEARL_LEVELS).map(([level, name]) => (
                  <option key={level} value={level}>{level}: {name}</option>
                ))}
              </select>
            </div>

            {/* Domain */}
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
              <select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full p-2 border rounded-md">
                {DOMAINS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>

            {/* Trap Type */}
            <div>
              <label htmlFor="trap-type" className="block text-sm font-medium text-gray-700 mb-2">Trap Type</label>
              <select
                id="trap-type"
                value={trapType}
                onChange={(e) => { setTrapType(e.target.value); setTrapSubtype(''); }}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select a trap type...</option>
                {availableTrapTypes.map((t) => (<option key={t.type} value={t.type}>{t.label}</option>))}
              </select>
              {trapType && (
                <p className="text-xs text-gray-500 mt-1">
                  {CHEATSHEET_TAXONOMY.find(t => t.type === trapType)?.description}
                </p>
              )}
            </div>

            {/* Subtype */}
            <div>
              <label htmlFor="trap-subtype" className="block text-sm font-medium text-gray-700 mb-2">Subtype (optional)</label>
              <select id="trap-subtype" value={trapSubtype} onChange={(e) => setTrapSubtype(e.target.value)} className="w-full p-2 border rounded-md" disabled={!trapType}>
                <option value="">Auto-select...</option>
                {availableSubtypes.map((s) => (<option key={s.name} value={s.name}>{s.name.replace(/_/g, ' ')}</option>))}
              </select>
            </div>

            {/* Count */}
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">Number of Problems</label>
              <input id="count" type="number" min={1} max={5} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !trapType}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : '✨ Generate Problems'}
          </button>

          {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
        </div>

        {/* Generated Questions */}
        {questions.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Generated Problems ({questions.length})</h2>
            {questions.map((q, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{q.pearlLevel || pearlLevel}</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">{q.trapType || trapType}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">{q.difficulty}</span>
                </div>
                <p className="text-gray-800 mb-2"><strong>Scenario:</strong> {q.scenario}</p>
                <p className="text-gray-800 mb-2"><strong>Claim:</strong> {q.claim}</p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-blue-600 hover:underline">Show Explanation</summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <p className="text-gray-700">{q.explanation}</p>
                    <div className="mt-2 text-sm text-gray-500">
                      <strong>Variables:</strong> X={q.variables?.X}, Y={q.variables?.Y}, Z=[{q.variables?.Z?.join(', ')}]
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

