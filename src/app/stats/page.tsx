'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Loader2, BarChart3, TrendingUp, Target, Award } from 'lucide-react'

interface Stats {
  totalQuizzes: number
  totalQuestions: number
  totalCorrect: number
  accuracy: number
  byTrapType: Record<string, { correct: number; total: number }>
  byLevel: Record<string, { correct: number; total: number }>
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      // Fetch stats from API
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
          setStats(data)
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Causal Trap Trainer</span>
          </Link>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Statistics</h1>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<BarChart3 className="w-6 h-6 text-primary-600" />}
            label="Total Quizzes"
            value={stats?.totalQuizzes ?? 0}
          />
          <StatCard
            icon={<Target className="w-6 h-6 text-green-600" />}
            label="Questions Answered"
            value={stats?.totalQuestions ?? 0}
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
            label="Overall Accuracy"
            value={`${stats?.accuracy ?? 0}%`}
          />
          <StatCard
            icon={<Award className="w-6 h-6 text-yellow-600" />}
            label="Correct Answers"
            value={stats?.totalCorrect ?? 0}
          />
        </div>

        {/* Empty State */}
        {(!stats || stats.totalQuizzes === 0) && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No stats yet</h2>
            <p className="text-gray-600 mb-6">Complete some quizzes to see your performance statistics.</p>
            <Link href="/dashboard"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors">
              Start a Quiz
            </Link>
          </div>
        )}

        {/* Performance by Trap Type */}
        {stats && stats.totalQuizzes > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Trap Type</h2>
            <div className="space-y-4">
              {Object.entries(stats.byTrapType || {}).map(([type, data]) => (
                <div key={type} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-gray-700">{type}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary-600 h-full rounded-full transition-all"
                      style={{ width: `${data.total > 0 ? (data.correct / data.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-20 text-sm text-gray-600 text-right">
                    {data.correct}/{data.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance by Pearl Level */}
        {stats && stats.totalQuizzes > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Pearl Level</h2>
            <div className="grid grid-cols-3 gap-4">
              {['L1', 'L2', 'L3'].map(level => {
                const data = stats.byLevel?.[level] || { correct: 0, total: 0 }
                const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                return (
                  <div key={level} className="bg-gray-50 rounded-xl p-6 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{accuracy}%</div>
                    <div className="text-sm text-gray-600">{level}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.correct}/{data.total} correct</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

