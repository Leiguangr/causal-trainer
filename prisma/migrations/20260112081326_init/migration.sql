-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario" TEXT NOT NULL,
    "claim" TEXT,
    "pearlLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "trapType" TEXT NOT NULL,
    "trapSubtype" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "groundTruth" TEXT NOT NULL DEFAULT 'INVALID',
    "variables" TEXT,
    "causalStructure" TEXT,
    "keyInsight" TEXT,
    "wiseRefusal" TEXT,
    "hiddenTimestamp" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isLLMGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceCase" TEXT,
    "generationBatchId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("causalStructure", "claim", "createdAt", "difficulty", "domain", "explanation", "generationBatchId", "groundTruth", "id", "isLLMGenerated", "isVerified", "keyInsight", "pearlLevel", "reviewNotes", "scenario", "sourceCase", "subdomain", "trapSubtype", "trapType", "updatedAt", "variables", "wiseRefusal") SELECT "causalStructure", "claim", "createdAt", "difficulty", "domain", "explanation", "generationBatchId", "groundTruth", "id", "isLLMGenerated", "isVerified", "keyInsight", "pearlLevel", "reviewNotes", "scenario", "sourceCase", "subdomain", "trapSubtype", "trapType", "updatedAt", "variables", "wiseRefusal" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
