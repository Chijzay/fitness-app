import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from + "T00:00:00.000Z") } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
    };
  }

  const sessions = await prisma.cardioSession.findMany({ where, orderBy: { date: "asc" } });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = await req.json();
  const { date, type, distanceM, durationS, kcal, steps, notes } = body;
  if (!date || !type) return NextResponse.json({ error: "date and type required" }, { status: 400 });

  const d = new Date(date); d.setHours(12, 0, 0, 0);

  const result = await prisma.cardioSession.create({
    data: {
      userId: session.user.id,
      date: d,
      type,
      distanceM: distanceM ?? null,
      durationS: durationS ?? null,
      kcal: kcal ?? null,
      steps: steps ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.cardioSession.deleteMany({
    where: { id: Number(id), userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
