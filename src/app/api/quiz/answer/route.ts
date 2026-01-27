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
        trap_type: true,
        trap_subtype: true,
        explanation: true,
        ground_truth: true,
        causal_structure: true,
        key_insight: true,
        wise_refusal: true,
        variables: true,
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Check if answers are correct
    const isTypeCorrect = question.trap_type === selectedType
    const isSubtypeCorrect = !selectedSubtype || question.trap_subtype === selectedSubtype
    const isCorrect = isTypeCorrect && isSubtypeCorrect

    // Save the answer
    const answer = await prisma.answer.create({
      data: {
        session_id: sessionId,
        question_id: questionId,
        selected_type: selectedType,
        selected_subtype: selectedSubtype,
        is_correct: isCorrect,
        is_type_correct: isTypeCorrect,
        time_taken_ms: timeTakenMs,
      },
    })

    // Update session correct count if correct
    if (isCorrect) {
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { correct_answers: { increment: 1 } },
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
      correctType: question.trap_type,
      correctSubtype: question.trap_subtype,
      explanation: question.explanation,
      groundTruth: question.ground_truth,
      causalStructure: question.causal_structure,
      keyInsight: question.key_insight,
      wiseRefusal: question.wise_refusal,
      variables,
    })
  } catch (error) {
    console.error('Answer submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

