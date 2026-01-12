'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { Brain, Loader2, ChevronRight, CheckCircle, XCircle, Flag } from 'lucide-react'
import { TRAP_TYPES, TRAP_TYPE_LABELS, TRAP_TYPE_DESCRIPTIONS, TRAP_SUBTYPES, TrapType, QuizQuestion } from '@/types'

function QuizContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Answer state
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState<{
    isCorrect: boolean
    isTypeCorrect: boolean
    correctType: string
    correctSubtype: string | null
    explanation: string
    groundTruth: string
    causalStructure: string | null
    keyInsight: string | null
    wiseRefusal: string | null
    variables: { X: string; Y: string; Z: string[] } | null
  } | null>(null)

  // Timer
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const includeSubtypes = searchParams.get('subtypes') === 'true'

  // Fetch questions
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      const fetchQuestions = async () => {
        const params = new URLSearchParams({
          n: searchParams.get('n') || '10',
          domains: searchParams.get('domains') || '',
          levels: searchParams.get('levels') || '',
          difficulty: searchParams.get('difficulty') || 'all',
        })

        const res = await fetch(`/api/quiz?${params.toString()}`)
        const data = await res.json()
        setQuestions(data.questions)

        // Create session
        const sessionRes = await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalQuestions: data.questions.length,
            domainsFilter: searchParams.get('domains')?.split(',') || [],
            levelsFilter: searchParams.get('levels')?.split(',') || [],
            difficulty: searchParams.get('difficulty') || 'all',
          }),
        })
        const sessionData = await sessionRes.json()
        setSessionId(sessionData.sessionId)
        setLoading(false)
        setStartTime(Date.now())
      }

      fetchQuestions()
    }
  }, [status, router, searchParams])

  const currentQuestion = questions[currentIndex]

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !sessionId || !currentQuestion) return

    setSubmitting(true)
    const timeTaken = Date.now() - startTime

    const res = await fetch('/api/quiz/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        questionId: currentQuestion.id,
        selectedType,
        selectedSubtype: includeSubtypes ? selectedSubtype : null,
        timeTakenMs: timeTaken,
      }),
    })

    const data = await res.json()
    setResult(data)
    setShowResult(true)
    setScore(prev => ({
      correct: prev.correct + (data.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }))
    setSubmitting(false)
  }, [selectedType, selectedSubtype, sessionId, currentQuestion, startTime, includeSubtypes])

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setSelectedType(null)
      setSelectedSubtype(null)
      setShowResult(false)
      setResult(null)
      setStartTime(Date.now())
    } else {
      // Quiz complete - go to results
      fetch('/api/quiz/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).then(() => {
        router.push(`/quiz/results?session=${sessionId}`)
      })
    }
  }, [currentIndex, questions.length, sessionId, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No questions found with the selected filters.</p>
          <button onClick={() => router.push('/dashboard')} className="text-primary-600 hover:underline">
            Go back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-600" />
            <span className="font-semibold text-gray-900">Quiz</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-primary-600">
              Score: {score.correct}/{score.total}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div className="h-1 bg-primary-600 transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Scenario Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 text-primary-700">
              {currentQuestion.pearlLevel}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              {currentQuestion.domain}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
              {currentQuestion.difficulty}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Scenario</h2>
          <p className="text-gray-700 leading-relaxed">{currentQuestion.scenario}</p>
          {currentQuestion.claim && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">Claim: {currentQuestion.claim}</p>
            </div>
          )}
        </div>

        {/* Answer Selection - Type Only */}
        {!showResult && <TrapTypeSelector selected={selectedType} onSelect={setSelectedType} />}
        {/* Answer Selection - Subtype */}
        {!showResult && includeSubtypes && selectedType && (
          <SubtypeSelector trapType={selectedType} selected={selectedSubtype} onSelect={setSelectedSubtype} />
        )}

        {/* Result Display */}
        {showResult && result && <ResultDisplay result={result} selectedType={selectedType!} selectedSubtype={selectedSubtype} />}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6">
          {!showResult && (
            <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">Cancel</button>
          )}
          {showResult && (
            <button className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
              <Flag className="w-4 h-4" /> Report Issue
            </button>
          )}
          {!showResult ? (
            <button onClick={handleSubmit} disabled={!selectedType || submitting}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit Answer
            </button>
          ) : (
            <button onClick={handleNext}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2">
              {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'} <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>}>
      <QuizContent />
    </Suspense>
  )
}

// Component definitions will continue in next file save...
function TrapTypeSelector({ selected, onSelect }: { selected: string | null; onSelect: (type: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
      <h3 className="text-md font-semibold text-gray-900 mb-4">What type of causal trap is this?</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TRAP_TYPES.map(type => (
          <div key={type} className="relative group">
            <button type="button" onClick={() => onSelect(type)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${selected === type ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
              <span className="font-medium text-sm">{TRAP_TYPE_LABELS[type as TrapType]}</span>
            </button>
            {TRAP_TYPE_DESCRIPTIONS[type] && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 text-center shadow-lg">
                {TRAP_TYPE_DESCRIPTIONS[type]}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SubtypeSelector({ trapType, selected, onSelect }: { trapType: string; selected: string | null; onSelect: (subtype: string) => void }) {
  const subtypes = TRAP_SUBTYPES[trapType] || []
  if (subtypes.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
      <h3 className="text-md font-semibold text-gray-900 mb-4">Select the specific subtype (optional)</h3>
      <div className="flex flex-wrap gap-2">
        {subtypes.map(subtype => (
          <button key={subtype} type="button" onClick={() => onSelect(selected === subtype ? '' : subtype)}
            className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${selected === subtype ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
            {subtype}
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultDisplay({ result, selectedType, selectedSubtype }: {
  result: {
    isCorrect: boolean
    isTypeCorrect: boolean
    correctType: string
    correctSubtype: string | null
    explanation: string
    groundTruth: string
    causalStructure: string | null
    keyInsight: string | null
    wiseRefusal: string | null
    variables: { X: string; Y: string; Z: string[] } | null
  }
  selectedType: string
  selectedSubtype: string | null
}) {
  const groundTruthLabel = {
    YES: { text: 'Yes - Claim Supported', color: 'text-green-700 bg-green-100' },
    NO: { text: 'No - Claim Invalid', color: 'text-red-700 bg-red-100' },
    AMBIGUOUS: { text: 'Ambiguous', color: 'text-yellow-700 bg-yellow-100' },
  }[result.groundTruth] || { text: result.groundTruth, color: 'text-gray-700 bg-gray-100' }

  return (
    <div className={`rounded-xl p-6 mb-4 ${result.isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
      {/* Correct/Incorrect Header */}
      <div className="flex items-center gap-2 mb-4">
        {result.isCorrect ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
        <span className={`font-semibold ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
          {result.isCorrect ? 'Correct!' : 'Incorrect'}
        </span>
        <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${groundTruthLabel.color}`}>
          {groundTruthLabel.text}
        </span>
      </div>

      {/* Your Answer vs Correct Answer */}
      <div className="space-y-2 mb-4">
        <p className="text-sm"><span className="font-medium">Your answer:</span> {TRAP_TYPE_LABELS[selectedType as TrapType] || selectedType}{selectedSubtype ? ` → ${selectedSubtype}` : ''}</p>
        <p className="text-sm"><span className="font-medium">Correct answer:</span> {TRAP_TYPE_LABELS[result.correctType as TrapType] || result.correctType}{result.correctSubtype ? ` → ${result.correctSubtype}` : ''}</p>
      </div>

      {/* Key Insight Callout */}
      {result.keyInsight && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-primary-800">💡 {result.keyInsight}</p>
        </div>
      )}

      {/* Variables */}
      {result.variables && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-gray-900 mb-2 text-sm">Causal Variables</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="font-medium text-gray-600">X (Exposure):</span> <span className="text-gray-800">{result.variables.X}</span></div>
            <div><span className="font-medium text-gray-600">Y (Outcome):</span> <span className="text-gray-800">{result.variables.Y}</span></div>
            <div><span className="font-medium text-gray-600">Z (Confounders):</span> <span className="text-gray-800">{result.variables.Z?.join(', ') || 'None'}</span></div>
          </div>
        </div>
      )}

      {/* Causal Structure */}
      {result.causalStructure && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">Causal Structure</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{result.causalStructure}</p>
        </div>
      )}

      {/* Wise Refusal (Full Answer) */}
      {result.wiseRefusal && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">Complete Answer</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{result.wiseRefusal}</p>
        </div>
      )}
    </div>
  )
}

