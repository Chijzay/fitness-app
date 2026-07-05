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

  const measurements = await prisma.bodyMeasurement.findMany({ where, orderBy: { date: "asc" } });
  return NextResponse.json(measurements);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = await req.json();
  const { date, waist, belly, hip, chest, upperArm, thigh, neck, calf, notes } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const d = new Date(date); d.setHours(12, 0, 0, 0);

  const data = {
    userId: session.user.id,
    date: d,
    waist: waist ?? null,
    belly: belly ?? null,
    hip: hip ?? null,
    chest: chest ?? null,
    upperArm: upperArm ?? null,
    thigh: thigh ?? null,
    neck: neck ?? null,
    calf: calf ?? null,
    notes: notes ?? null,
  };

  const result = await prisma.bodyMeasurement.upsert({
    where: { userId_date: { userId: session.user.id, date: d } },
    update: data,
    create: data,
  });

  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const d = new Date(date); d.setHours(12, 0, 0, 0);
  await prisma.bodyMeasurement.deleteMany({ where: { userId: session.user.id, date: d } });
  return NextResponse.json({ ok: true });
}
