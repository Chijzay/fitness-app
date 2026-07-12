"use client";
import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from "recharts";
import { RangeSelector, KpiCard, SectionHeader, PageHeader, tickStyle, gridStyle, tooltipStyle } from "@/lib/chartHelpers";
import type { DateRange } from "@/app/page";

export type CardioSession = {
  id: number; date: string; type: string;
  distanceM?: number; durationS?: number; kcal?: number; steps?: number; notes?: string;
};

const TYPE_COLORS: Record<string, string> = {
  "Joggen":    "var(--teal)",
  "Spazieren": "var(--green)",
  "Radfahren": "var(--blue)",
  "Schwimmen": "var(--purple)",
  "Wandern":   "var(--orange)",
};
function typeColor(t: string) { return TYPE_COLORS[t] ?? "#94a3b8"; }

function fmtDuration(s?: number) {
  if (!s) return "–";
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
function fmtDist(m?: number) {
  if (!m) return "–";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`;
}
function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function fmtDateShort(s: string) {
  const d = new Date(s + "T12:00:00");
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
}

export default function CardioDetail({
  range, setRange,
}: {
  range: DateRange; setRange: (r: DateRange) => void;
}) {
  const [sessions, setSessions] = useState<CardioSession[]>([]);

  useEffect(() => {
    fetch(`/api/cardio?from=${range.from}&to=${range.to}`)
      .then(r => r.json()).then(setSessions).catch(() => {});
  }, [range]);

  async function deleteSession(id: number) {
    await fetch(`/api/cardio?id=${id}`, { method: "DELETE" });
    setSessions(s => s.filter(x => x.id !== id));
  }

  const totalKcal     = sessions.reduce((s, x) => s + (x.kcal ?? 0), 0);
  const totalDistM    = sessions.reduce((s, x) => s + (x.distanceM ?? 0), 0);
  const totalDurS     = sessions.reduce((s, x) => s + (x.durationS ?? 0), 0);
  const avgDistM      = sessions.filter(x => x.distanceM).length
    ? Math.round(totalDistM / sessions.filter(x => x.distanceM).length) : 0;

  // Chart: distance/kcal per session
  const sessionChart = useMemo(() => sessions.map(s => ({
    date:  fmtDateShort(s.date.split("T")[0]),
    type:  s.type,
    distKm: s.distanceM ? +(s.distanceM / 1000).toFixed(2) : null,
    kcal:  s.kcal ?? null,
    durMin: s.durationS ? Math.round(s.durationS / 60) : null,
  })), [sessions]);

  // Breakdown by type
  const byType = useMemo(() => {
    const map: Record<string, { count: number; distKm: number; kcal: number }> = {};
    sessions.forEach(s => {
      if (!map[s.type]) map[s.type] = { count: 0, distKm: 0, kcal: 0 };
      map[s.type].count++;
      map[s.type].distKm += (s.distanceM ?? 0) / 1000;
      map[s.type].kcal   += s.kcal ?? 0;
    });
    return Object.entries(map).map(([type, v]) => ({ type, ...v, distKm: +v.distKm.toFixed(2) }));
  }, [sessions]);

  const tt = tooltipStyle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="🏃 Cardio" sub="Ausdauer-Sessions" entryCount={sessions.length} />

      <div style={{ marginBottom: 4 }}>
        <RangeSelector range={range} setRange={setRange} />
      </div>

      {sessions.length === 0 && (
        <div className="card card-pad" style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 40 }}>
          Noch keine Cardio-Sessions im ausgewählten Zeitraum eingetragen.
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* KPIs */}
          <div className="card card-pad">
            <SectionHeader title="Übersicht" icon="🏃" />
            <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <KpiCard label="Sessions" value={`${sessions.length}`} sub={`im Zeitraum`} />
              <KpiCard label="Gesamt Strecke" value={fmtDist(totalDistM)} sub={`Ø ${fmtDist(avgDistM)}/Session`} color="var(--teal)" />
              <KpiCard label="Gesamt Zeit" value={fmtDuration(totalDurS)} sub={`Ø ${fmtDuration(Math.round(totalDurS / sessions.length))}/Session`} color="var(--blue)" />
              <KpiCard label="Gesamt kcal" value={totalKcal > 0 ? `${totalKcal} kcal` : "–"} sub={totalKcal > 0 ? `Ø ${Math.round(totalKcal / sessions.length)} kcal/Session` : undefined} color="var(--orange)" />
            </div>
          </div>

          {/* Strecke je Session */}
          {sessionChart.some(s => s.distKm) && (
            <div className="card card-pad">
              <SectionHeader title="Strecke pro Session (km)" icon="📍" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sessionChart} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                  <YAxis tick={tickStyle} unit=" km" width={44} />
                  <Tooltip {...tt} formatter={(v: unknown) => [`${v} km`, "Strecke"]} />
                  <Bar dataKey="distKm" maxBarSize={28} radius={[4, 4, 0, 0]}>
                    {sessionChart.map((s, i) => <Cell key={i} fill={typeColor(s.type)} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* kcal je Session */}
          {sessionChart.some(s => s.kcal) && (
            <div className="card card-pad">
              <SectionHeader title="Kalorienverbrauch pro Session" icon="🔥" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sessionChart} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                  <YAxis tick={tickStyle} unit=" kcal" width={52} />
                  <Tooltip {...tt} formatter={(v: unknown) => [`${v} kcal`, "Verbrannt"]} />
                  <Bar dataKey="kcal" maxBarSize={28} radius={[4, 4, 0, 0]}>
                    {sessionChart.map((s, i) => <Cell key={i} fill={typeColor(s.type)} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Aufteilung nach Typ */}
          {byType.length > 1 && (
            <div className="card card-pad">
              <SectionHeader title="Aufteilung nach Typ" icon="📊" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={tickStyle} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={tickStyle} width={80} />
                  <Tooltip {...tt} formatter={(v: unknown, name: unknown) => [`${v}`, name === "count" ? "Sessions" : name === "distKm" ? "km" : "kcal"]} />
                  <Bar dataKey="count" maxBarSize={20} radius={[0, 4, 4, 0]} name="Sessions">
                    {byType.map((t, i) => <Cell key={i} fill={typeColor(t.type)} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabelle */}
          <div className="card">
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
              📋 Alle Sessions
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["Datum", "Typ", "Strecke", "Zeit", "kcal", "Schritte", "Notiz", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...sessions].reverse().map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "var(--text)", fontWeight: 600 }}>{fmtDate(s.date.split("T")[0])}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: typeColor(s.type) + "22", color: typeColor(s.type), fontWeight: 700 }}>{s.type}</span>
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--text-2)" }}>{fmtDist(s.distanceM)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-2)" }}>{fmtDuration(s.durationS)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-2)" }}>{s.kcal ? `${s.kcal} kcal` : "–"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-2)" }}>{s.steps ? s.steps.toLocaleString("de") : "–"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-muted)", fontSize: 11 }}>{s.notes ?? ""}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <button onClick={() => deleteSession(s.id)}
                          style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
