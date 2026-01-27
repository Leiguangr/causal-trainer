import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId } = body

    // Complete the session
    const quizSession = await prisma.quizSession.update({
      where: { id: sessionId },
      data: { completed_at: new Date() },
      include: {
        answers: {
          include: {
            question: {
              select: {
                scenario: true,
                trap_type: true,
                trap_subtype: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      sessionId: quizSession.id,
      totalQuestions: quizSession.total_questions,
      correctAnswers: quizSession.correct_answers,
      answers: quizSession.answers,
    })
  } catch (error) {
    console.error('Quiz completion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

