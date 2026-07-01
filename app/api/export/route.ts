import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";
  const uid = session.user.id;

  const [logs, profile, goals, phases] = await Promise.all([
    prisma.dailyLog.findMany({ where: { userId: uid }, orderBy: { date: "asc" } }),
    prisma.profile.findUnique({ where: { userId: uid } }),
    prisma.goal.findMany({ where: { userId: uid, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.dietPhase.findMany({ where: { userId: uid }, orderBy: { startDate: "asc" } }),
  ]);

  if (format === "csv") {
    const headers = [
      "Datum", "Gewicht (kg)", "Körperfett (%)", "Muskelmasse (kg)", "KF geschätzt",
      "Kcal gegessen", "Kcal verbrannt", "BMR Override",
      "Eiweiß (g)", "Carbs (g)", "Fett (g)",
      "Schritte", "Schritte Dauer (min)", "Aktivitätsart", "Aktivitätsnotiz",
      "Schlaf gesamt (min)", "Schlaf effektiv (min)", "Tiefschlaf (min)", "Schlafqualität",
      "Wasser (ml)", "Notiz",
    ];

    const rows = logs.map(l => [
      l.date.toISOString().split("T")[0],
      l.weight ?? "",
      l.bodyFatPercent ?? "",
      l.muscleMass ?? "",
      l.bodyFatEstimated ? "Ja" : "Nein",
      l.kcalConsumed ?? "",
      l.kcalBurned ?? "",
      l.bmrOverride ?? "",
      l.proteinG ?? "",
      l.carbsG ?? "",
      l.fatG ?? "",
      l.steps ?? "",
      l.stepsDuration ?? "",
      l.stepsType ?? "",
      l.stepsNotes ?? "",
      l.sleepTotal ?? "",
      l.sleepActual ?? "",
      l.sleepDeep ?? "",
      l.sleepQuality ?? "",
      l.waterMl ?? "",
      l.notes ?? "",
    ]);

    const csvLines = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `FitnessTracker-Export-${dateStr}.csv`;
    return new Response("﻿" + csvLines, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `FitnessTracker-Vollexport-${dateStr}.json`;
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), profile, goals, phases, logs },
    {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    }
  );
}
