'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Play, BarChart3, LogOut, Settings, Loader2, Sparkles } from 'lucide-react'
import { DOMAINS, PEARL_LEVELS, PearlLevel } from '@/types'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Quiz configuration state
  const [numQuestions, setNumQuestions] = useState(10)
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['Markets'])
  const [selectedLevels, setSelectedLevels] = useState<PearlLevel[]>(['L1', 'L2', 'L3'])
  const [difficulty, setDifficulty] = useState<string>('all')
  const [includeSubtypes, setIncludeSubtypes] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!session) return null

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  const toggleLevel = (level: PearlLevel) => {
    setSelectedLevels(prev =>
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    )
  }

  const startQuiz = () => {
    const params = new URLSearchParams({
      n: numQuestions.toString(),
      domains: selectedDomains.join(','),
      levels: selectedLevels.join(','),
      difficulty,
      subtypes: includeSubtypes.toString(),
    })
    router.push(`/quiz?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Causal Trap Trainer</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {session.user.name}</span>
            <button onClick={() => signOut()} className="text-gray-500 hover:text-gray-700">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Start a Quiz</h1>

        {/* Quiz Configuration Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quiz Settings
          </h2>

          {/* Number of Questions */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumQuestions(n)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    numQuestions === n
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Pearl Levels */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pearl Levels
            </label>
            <div className="flex gap-2">
              {(Object.keys(PEARL_LEVELS) as PearlLevel[]).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedLevels.includes(level)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {level}: {PEARL_LEVELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Domains */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Domains
            </label>
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map(domain => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm transition-colors ${
                    selectedDomains.includes(domain)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <div className="flex gap-2">
              {['all', 'easy', 'medium', 'hard'].map(d => (
                <button key={d} type="button" onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-lg border-2 capitalize transition-colors ${
                    difficulty === d ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Include Subtypes */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeSubtypes} onChange={e => setIncludeSubtypes(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm text-gray-700">Include subtype questions (harder)</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button type="button" onClick={startQuiz} disabled={selectedDomains.length === 0 || selectedLevels.length === 0}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg font-medium">
            <Play className="w-5 h-5" /> Start Quiz
          </button>
          <Link href="/stats"
            className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 transition-colors flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> View Stats
          </Link>
          <Link href="/generate"
            className="px-6 py-3 border-2 border-purple-200 bg-purple-50 rounded-lg hover:border-purple-300 transition-colors flex items-center gap-2 text-purple-700">
            <Sparkles className="w-5 h-5" /> Generate
          </Link>
        </div>
      </main>
    </div>
  )
}

