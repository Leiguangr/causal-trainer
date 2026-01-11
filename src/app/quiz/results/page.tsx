'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Brain, Loader2, Trophy, Target, RotateCcw, Home, CheckCircle, XCircle } from 'lucide-react'
import { calculateAccuracy } from '@/lib/utils'
import { TRAP_TYPE_LABELS, TrapType } from '@/types'

interface SessionResult {
  sessionId: string
  totalQuestions: number
  correctAnswers: number
  answers: Array<{
    id: string
    isCorrect: boolean
    isTypeCorrect: boolean
    selectedType: string
    selectedSubtype: string | null
    question: {
      scenario: string
      trapType: string
      trapSubtype: string | null
    }
  }>
}

function ResultsContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const [results, setResults] = useState<SessionResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (!sessionId) {
      router.push('/dashboard')
      return
    }

    // Fetch results (in real app, we'd have an API for this)
    // For now, we'll show a summary based on the complete call
    setLoading(false)
  }, [status, sessionId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  // For demo purposes, show a simple results page
  // In production, we'd fetch the full session data
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-600" />
            <span className="font-semibold text-gray-900">Causal Trap Trainer</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 mb-6">
            <Trophy className="w-10 h-10 text-primary-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
          <p className="text-gray-600 mb-8">Great job finishing the quiz. Keep practicing to improve!</p>

          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto mb-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <Target className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">--</p>
              <p className="text-sm text-gray-600">Accuracy</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">--</p>
              <p className="text-sm text-gray-600">Correct</p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Link href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 transition-colors">
              <Home className="w-5 h-5" />
              Dashboard
            </Link>
            <button type="button" onClick={() => router.back()}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              <RotateCcw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tips for Improvement</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Always check for hidden common causes (confounders) that affect both X and Y</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Ask &quot;Could Y be causing X?&quot; to catch reverse causation</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Watch for selection effects - who is included/excluded from the data?</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>For counterfactuals (L3), consider whether the alternative world is coherent</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>}>
      <ResultsContent />
    </Suspense>
  )
}

