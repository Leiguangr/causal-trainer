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
    const { sessionId, questionId, selectedType, selectedSubtype, timeTakenMs } = body

    // Get the question to check the answer
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        trapType: true,
        trapSubtype: true,
        explanation: true,
        groundTruth: true,
        causalStructure: true,
        keyInsight: true,
        wiseRefusal: true,
        variables: true,
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Check if answers are correct
    const isTypeCorrect = question.trapType === selectedType
    const isSubtypeCorrect = !selectedSubtype || question.trapSubtype === selectedSubtype
    const isCorrect = isTypeCorrect && isSubtypeCorrect

    // Save the answer
    const answer = await prisma.answer.create({
      data: {
        sessionId,
        questionId,
        selectedType,
        selectedSubtype,
        isCorrect,
        isTypeCorrect,
        timeTakenMs,
      },
    })

    // Update session correct count if correct
    if (isCorrect) {
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { correctAnswers: { increment: 1 } },
      })
    }

    // Parse variables for the response
    let variables = null
    if (question.variables) {
      try {
        variables = JSON.parse(question.variables)
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      answerId: answer.id,
      isCorrect,
      isTypeCorrect,
      correctType: question.trapType,
      correctSubtype: question.trapSubtype,
      explanation: question.explanation,
      groundTruth: question.groundTruth,
      causalStructure: question.causalStructure,
      keyInsight: question.keyInsight,
      wiseRefusal: question.wiseRefusal,
      variables,
    })
  } catch (error) {
    console.error('Answer submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

