import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await req.json();
  await prisma.goal.updateMany({
    where: { userId: session.user.id, type: data.type, isActive: true },
    data: { isActive: false },
  });
  const goal = await prisma.goal.create({
    data: {
      userId: session.user.id,
      type: data.type,
      targetValue: Number(data.targetValue),
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      notes: data.notes || null,
    },
  });
  return NextResponse.json(goal);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await req.json();
  const { id, ...rest } = data;
  const goal = await prisma.goal.update({
    where: { id: Number(id) },
    data: {
      targetValue: Number(rest.targetValue),
      targetDate: rest.targetDate ? new Date(rest.targetDate) : null,
      notes: rest.notes || null,
    },
  });
  return NextResponse.json(goal);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  await prisma.goal.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
