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

  const logs = await prisma.dailyLog.findMany({ where, orderBy: { date: "asc" } });
  return NextResponse.json(logs);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const d = new Date(date);
  d.setHours(12, 0, 0, 0);

  await prisma.dailyLog.deleteMany({ where: { userId: session.user.id, date: d } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await req.json();
  const date = new Date(data.date);
  date.setHours(12, 0, 0, 0);

  const { date: _d, id: _id, userId: _u, ...rest } = data;
  void _d; void _id; void _u;

  const log = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { ...rest, date, updatedAt: new Date() },
    create: { ...rest, userId: session.user.id, date },
  });
  return NextResponse.json(log);
}
