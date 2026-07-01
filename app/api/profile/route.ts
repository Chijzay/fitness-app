import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function parseBirthdate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  try {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json(profile ?? null);
  } catch (e) {
    console.error(e);
    return NextResponse.json(null);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const data = await req.json();
    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: {
        name: data.name,
        gender: data.gender,
        birthdate: parseBirthdate(data.birthdate),
        height: Number(data.height),
        activityLevel: Number(data.activityLevel),
        proteinFactor: Number(data.proteinFactor),
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        name: data.name,
        gender: data.gender,
        birthdate: parseBirthdate(data.birthdate),
        height: Number(data.height),
        activityLevel: Number(data.activityLevel),
        proteinFactor: Number(data.proteinFactor),
      },
    });
    return NextResponse.json(profile);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
