import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all completed quiz sessions for the user
    const sessions = await prisma.quizSession.findMany({
      where: {
        userId: session.user.id,
        completedAt: { not: null },
      },
      include: {
        answers: {
          include: {
            question: {
              select: {
                trapType: true,
                pearlLevel: true,
              },
            },
          },
        },
      },
    })

    // Calculate stats
    const totalQuizzes = sessions.length
    let totalQuestions = 0
    let totalCorrect = 0
    const byTrapType: Record<string, { correct: number; total: number }> = {}
    const byLevel: Record<string, { correct: number; total: number }> = {}

    for (const quizSession of sessions) {
      for (const answer of quizSession.answers) {
        totalQuestions++
        if (answer.isCorrect) totalCorrect++

        // By trap type
        const trapType = answer.question.trapType
        if (!byTrapType[trapType]) {
          byTrapType[trapType] = { correct: 0, total: 0 }
        }
        byTrapType[trapType].total++
        if (answer.isCorrect) byTrapType[trapType].correct++

        // By Pearl level
        const level = answer.question.pearlLevel
        if (!byLevel[level]) {
          byLevel[level] = { correct: 0, total: 0 }
        }
        byLevel[level].total++
        if (answer.isCorrect) byLevel[level].correct++
      }
    }

    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

    return NextResponse.json({
      totalQuizzes,
      totalQuestions,
      totalCorrect,
      accuracy,
      byTrapType,
      byLevel,
    })
  } catch (error) {
    console.error('Stats fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

