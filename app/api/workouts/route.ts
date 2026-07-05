import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/workouts?from=&to=  — list sessions with exercises+sets
// GET /api/workouts?exercises=1 — list all unique exercise names (for autocomplete)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);

  if (searchParams.get("exercises") === "1") {
    const exs = await prisma.workoutExercise.findMany({
      where: { session: { userId: session.user.id } },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    });
    return NextResponse.json(exs.map(e => e.name));
  }

  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  const where: Record<string, unknown> = { userId: session.user.id };
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from + "T00:00:00.000Z") } : {}),
      ...(to   ? { lte: new Date(to   + "T23:59:59.999Z") } : {}),
    };
  }

  const sessions = await prisma.workoutSession.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  return NextResponse.json(sessions);
}

// POST /api/workouts — create full session with exercises+sets
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = await req.json();
  const { date, name, bodyWeight, energyLevel, startTime, endTime, notes, exercises } = body;
  if (!date || !name) return NextResponse.json({ error: "date and name required" }, { status: 400 });

  const d = new Date(date); d.setHours(12, 0, 0, 0);

  const result = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      date: d,
      name,
      bodyWeight: bodyWeight ?? null,
      energyLevel: energyLevel ?? null,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      notes: notes ?? null,
      exercises: {
        create: (exercises ?? []).map((ex: { name: string; order: number; notes?: string; sets: { setNumber: number; reps?: number; weight?: number; notes?: string }[] }) => ({
          name: ex.name,
          order: ex.order,
          notes: ex.notes ?? null,
          sets: { create: ex.sets.map(s => ({ setNumber: s.setNumber, reps: s.reps ?? null, weight: s.weight ?? null, notes: s.notes ?? null })) },
        })),
      },
    },
    include: { exercises: { include: { sets: true } } },
  });

  return NextResponse.json(result);
}

// DELETE /api/workouts?id=123
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.workoutSession.deleteMany({ where: { id: Number(id), userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
