import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface QuestionData {
  sourceCase: string
  scenario: string
  claim: string
  pearlLevel: string
  domain: string
  subdomain?: string
  trapType: string
  trapSubtype: string
  difficulty: string
  groundTruth: string
  explanation: string
  variables: Record<string, unknown>
  causalStructure: string
  keyInsight: string
  wiseRefusal: string
}

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@causaltrainer.com' },
    update: {},
    create: {
      email: 'admin@causaltrainer.com',
      name: 'Admin',
      password: adminPassword,
      role: 'admin',
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // Create test user
  const userPassword = await bcrypt.hash('test123', 10)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      password: userPassword,
      role: 'user',
    },
  })
  console.log('✅ Test user created:', testUser.email)

  // Load questions from JSON
  const questionsPath = path.join(__dirname, 'seed-data', 'questions.json')
  const questionsRaw = fs.readFileSync(questionsPath, 'utf-8')
  const questions: QuestionData[] = JSON.parse(questionsRaw)

  console.log(`📚 Loading ${questions.length} questions...`)

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: `seed-${q.sourceCase}` },
      update: {
        scenario: q.scenario,
        claim: q.claim,
        pearlLevel: q.pearlLevel,
        domain: q.domain,
        subdomain: q.subdomain,
        trapType: q.trapType,
        trapSubtype: q.trapSubtype,
        difficulty: q.difficulty,
        groundTruth: q.groundTruth,
        explanation: q.explanation,
        variables: JSON.stringify(q.variables),
        causalStructure: q.causalStructure,
        keyInsight: q.keyInsight,
        wiseRefusal: q.wiseRefusal,
        isVerified: true,
        isLLMGenerated: false,
      },
      create: {
        id: `seed-${q.sourceCase}`,
        scenario: q.scenario,
        claim: q.claim,
        pearlLevel: q.pearlLevel,
        domain: q.domain,
        subdomain: q.subdomain,
        trapType: q.trapType,
        trapSubtype: q.trapSubtype,
        difficulty: q.difficulty,
        groundTruth: q.groundTruth,
        explanation: q.explanation,
        variables: JSON.stringify(q.variables),
        causalStructure: q.causalStructure,
        keyInsight: q.keyInsight,
        wiseRefusal: q.wiseRefusal,
        sourceCase: q.sourceCase,
        isVerified: true,
        isLLMGenerated: false,
      },
    })
    console.log(`  ✅ Question ${q.sourceCase}: ${q.trapType}`)
  }

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

