import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const groups = await prisma.exerciseMuscleGroup.findMany({
    where: { userId: session.user.id },
  });

  const map: Record<string, string> = {};
  groups.forEach(g => { map[g.exerciseName] = g.muscleGroup; });
  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { exerciseName, muscleGroup } = await req.json();
  if (!exerciseName) return NextResponse.json({ error: "exerciseName required" }, { status: 400 });

  if (!muscleGroup) {
    await prisma.exerciseMuscleGroup.deleteMany({
      where: { userId: session.user.id, exerciseName },
    });
    return NextResponse.json({ ok: true });
  }

  const result = await prisma.exerciseMuscleGroup.upsert({
    where: { userId_exerciseName: { userId: session.user.id, exerciseName } },
    update: { muscleGroup },
    create: { userId: session.user.id, exerciseName, muscleGroup },
  });
  return NextResponse.json(result);
}
