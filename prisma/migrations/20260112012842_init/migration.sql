-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "pearlLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "trapType" TEXT NOT NULL,
    "trapSubtype" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "groundTruth" TEXT NOT NULL DEFAULT 'INVALID',
    "variables" TEXT,
    "causalStructure" TEXT,
    "keyInsight" TEXT,
    "wiseRefusal" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isLLMGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceCase" TEXT,
    "generationBatchId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "domainsFilter" TEXT,
    "levelsFilter" TEXT,
    "difficulty" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedType" TEXT NOT NULL,
    "selectedSubtype" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "isTypeCorrect" BOOLEAN NOT NULL,
    "timeTakenMs" INTEGER,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "suggestedType" TEXT,
    "suggestedSubtype" TEXT,
    "suggestedExplanation" TEXT,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "Correction_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Correction_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Correction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pearlLevel" TEXT,
    "domain" TEXT,
    "requestedCount" INTEGER NOT NULL,
    "generatedCount" INTEGER NOT NULL,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "promptNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "GenerationBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
