-- CreateTable
CREATE TABLE "ExerciseMuscleGroup" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,

    CONSTRAINT "ExerciseMuscleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseMuscleGroup_userId_exerciseName_key" ON "ExerciseMuscleGroup"("userId", "exerciseName");

-- AddForeignKey
ALTER TABLE "ExerciseMuscleGroup" ADD CONSTRAINT "ExerciseMuscleGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
