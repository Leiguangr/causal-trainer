import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { shuffleArray } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const numQuestions = parseInt(searchParams.get('n') || '10')
    const domains = searchParams.get('domains')?.split(',').filter(Boolean) || []
    const levels = searchParams.get('levels')?.split(',').filter(Boolean) || []
    const difficulty = searchParams.get('difficulty') || 'all'

    // Build query filters
    const where: Record<string, unknown> = {}
    
    if (domains.length > 0) {
      where.domain = { in: domains }
    }
    
    if (levels.length > 0) {
      where.pearlLevel = { in: levels }
    }
    
    if (difficulty !== 'all') {
      where.difficulty = difficulty
    }

    // Fetch questions
    const allQuestions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        scenario: true,
        claim: true,
        pearlLevel: true,
        domain: true,
        trapType: true,
        trapSubtype: true,
        explanation: true,
        difficulty: true,
        variables: true,
      },
    })

    // Shuffle and limit
    const shuffled = shuffleArray(allQuestions)
    const questions = shuffled.slice(0, numQuestions)

    return NextResponse.json({ questions, total: allQuestions.length })
  } catch (error) {
    console.error('Quiz fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Start a quiz session
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { totalQuestions, domainsFilter, levelsFilter, difficulty } = body

    const quizSession = await prisma.quizSession.create({
      data: {
        userId: session.user.id,
        totalQuestions,
        domainsFilter: JSON.stringify(domainsFilter),
        levelsFilter: JSON.stringify(levelsFilter),
        difficulty,
      },
    })

    return NextResponse.json({ sessionId: quizSession.id })
  } catch (error) {
    console.error('Quiz session creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

