import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const phases = await prisma.dietPhase.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(phases);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await req.json();
  const [y, m, d] = data.startDate.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, 12, 0, 0);
  const phase = await prisma.dietPhase.create({
    data: { userId: session.user.id, name: data.name, startDate, notes: data.notes ?? null },
  });
  return NextResponse.json(phase);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await req.json();
  const { id, name } = data;
  const phase = await prisma.dietPhase.update({ where: { id: Number(id) }, data: { name } });
  return NextResponse.json(phase);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  await prisma.dietPhase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
