-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Ich',
    "gender" TEXT NOT NULL,
    "birthdate" DATETIME NOT NULL,
    "height" REAL NOT NULL,
    "activityLevel" REAL NOT NULL DEFAULT 1.55,
    "proteinFactor" REAL NOT NULL DEFAULT 1.9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DietPhase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "goalWeight" REAL,
    "goalDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "phaseId" INTEGER,
    "weight" REAL,
    "bodyFatPercent" REAL,
    "bodyFatEstimated" BOOLEAN NOT NULL DEFAULT false,
    "kcalConsumed" REAL,
    "kcalBurned" REAL,
    "bmrOverride" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "proteinG" REAL,
    "steps" INTEGER,
    "stepsDuration" INTEGER,
    "stepsType" TEXT,
    "stepsNotes" TEXT,
    "sleepTotal" INTEGER,
    "sleepActual" INTEGER,
    "sleepDeep" INTEGER,
    "sleepQuality" INTEGER,
    "waterMl" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyLog_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "DietPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "targetDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_date_key" ON "DailyLog"("date");
