"use client";
// v2
import { useMemo, useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, BarChart, LineChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, ReferenceLine, Area, AreaChart,
} from "recharts";
import type { Profile, DailyLog, DateRange, View } from "@/app/page";
import { calcBMR, calcTDEE, estimateBodyFat, calcMaxDeficit, calcFatKgFromKcal, formatMinutes } from "@/lib/calculations";
import { allDatesInRange, fmtShort, fmtFull } from "@/lib/chartHelpers";

const DARK = {
  grid:    { stroke: "#2a3348", strokeDasharray: "3 3" },
  tick:    { fontSize: 10.5, fill: "#4d5566" },
  tooltip: {
    contentStyle: {
      background: "#1c2333", border: "1px solid #2a3348",
      borderRadius: 10, fontSize: 12.5, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      color: "#e6edf3",
    },
    labelStyle: { color: "#8b949e", marginBottom: 4, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    cursor: { fill: "rgba(0,212,180,0.04)" },
  },
};

function KpiTile({ icon, label, value, sub, color, badge }: {
  icon: string; label: string; value: string; sub?: string; color?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        <span>{icon}</span>{label}
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </div>
      <div className="kpi-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function WidgetCard({ icon, title, kpi, sub, badge, children, onClick }: {
  icon: string; title: string; kpi: string; sub?: string;
  badge?: React.ReactNode; children: React.ReactNode; onClick: () => void;
}) {
  return (
    <div className="card card-pad card-clickable" onClick={onClick}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="section-head-icon" style={{ width: 24, height: 24, fontSize: 12 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.025em", lineHeight: 1 }}>{kpi}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {badge}
          <span style={{ fontSize: 16, color: "var(--teal)", opacity: 0.6 }}>›</span>
        </div>
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, marginTop: -6 }}>{sub}</div>}
      {/* Chart */}
      <div className="widget-chart" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        {children}
      </div>
      {/* Detail-Hinweis — nur Desktop */}
      <div className="widget-detail-hint" style={{
        marginTop: 10, paddingTop: 8,
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
        fontSize: 11.5, fontWeight: 600,
        color: "var(--teal)", opacity: 0.75,
        letterSpacing: "0.02em",
      }}>
        Details ansehen
        <span style={{ fontSize: 14 }}>→</span>
      </div>
    </div>
  );
}

type Goal = { id: number; type: string; targetValue: number; targetDate?: string };

export default function Dashboard({ logs, profile, range, onGoDetail, onEditEntry }: {
  logs: DailyLog[]; profile: Profile; range: DateRange;
  onGoDetail: (v: View) => void; onEditEntry: (date: string) => void;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    fetch("/api/goals").then(r => r.json()).then(setGoals).catch(() => {});
  }, []);

  const dates = useMemo(() => allDatesInRange(range), [range]);
  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    logs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [logs]);

  const latestWithWeight = [...logs].reverse().find(l => l.weight);
  const latestWeight = latestWithWeight?.weight;
  const bodyFat = latestWithWeight?.bodyFatPercent
    ?? (latestWeight ? estimateBodyFat(latestWeight, profile.height, profile.gender, new Date(profile.birthdate)) : null);
  const bmrRef = latestWeight ? calcBMR(latestWeight, profile.height, profile.gender, new Date(profile.birthdate)) : null;
  const tdee = bmrRef ? calcTDEE(bmrRef, profile.activityLevel) : null;
  const maxDef = latestWeight && bodyFat ? calcMaxDeficit(latestWeight, bodyFat) : null;

  // ── Schritte ──────────────────────────────────
  const stepsData = dates.map(d => ({ date: fmtShort(d), steps: logMap[d]?.steps ?? null }));
  const totalSteps = stepsData.reduce((s, d) => s + (d.steps ?? 0), 0);
  const stepsCount = stepsData.filter(d => d.steps != null).length;
  const avgSteps = stepsCount ? Math.round(totalSteps / stepsCount) : null;

  // ── Gewicht ───────────────────────────────────
  const weightData = dates.map(d => ({ date: fmtShort(d), weight: logMap[d]?.weight ?? null }));
  const firstW = [...weightData].find(d => d.weight)?.weight;
  const lastW = [...weightData].reverse().find(d => d.weight)?.weight;
  const weightDiff = firstW && lastW ? +(lastW - firstW).toFixed(1) : null;

  // ── Kalorien (kombiniert Bar + Line) ──────────
  const kcalData = dates.map(d => {
    const log = logMap[d];
    const w = log?.weight ?? latestWeight;
    const bmr = log?.bmrOverride ?? (w ? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate)) : null);
    const tdeeDay = bmr ? Math.round(calcTDEE(bmr, profile.activityLevel)) : null;
    const deficit = tdeeDay != null && log?.kcalConsumed != null
      ? log.kcalConsumed - tdeeDay - (log.kcalBurned ?? 0) : null;
    return { date: fmtShort(d), deficit, consumed: log?.kcalConsumed ?? null, bmr: bmr ? Math.round(bmr) : null };
  });
  const totalDeficit = kcalData.reduce((s, d) => s + (d.deficit ?? 0), 0);
  const fatKg = calcFatKgFromKcal(totalDeficit);

  // ── Schlaf ────────────────────────────────────
  const sleepData = dates.map(d => ({
    date: fmtShort(d),
    actual: logMap[d]?.sleepActual ?? null,
    deep: logMap[d]?.sleepDeep ?? null,
  }));
  const sleepEntries = sleepData.filter(d => d.actual != null);
  const avgSleep = sleepEntries.length
    ? Math.round(sleepEntries.reduce((s, d) => s + (d.actual ?? 0), 0) / sleepEntries.length) : null;

  const today = new Date().toISOString().split("T")[0];

  // Ziele-Berechnung (außerhalb JSX um IIFE zu vermeiden)
  const weightGoal = goals.find(g => g.type === "weight");
  const proteinGoal = goals.find(g => g.type === "protein");
  const sleepGoal = goals.find(g => g.type === "sleep");
  const kcalGoal = goals.find(g => g.type === "kcal_deficit");
  const bmrForGoals = calcBMR(latestWeight ?? 80, profile.height, profile.gender, new Date(profile.birthdate));
  const tdeeForGoals = calcTDEE(bmrForGoals, profile.activityLevel);
  const proteinTarget = proteinGoal?.targetValue
    ?? (latestWeight ? Math.round(latestWeight * profile.proteinFactor) : null);
  const todayAee = logMap[today]?.kcalBurned ?? null;
  const todayProtein = logMap[today]?.proteinG ?? null;
  const proteinRemaining = proteinTarget != null && todayProtein != null
    ? Math.max(0, Math.round(proteinTarget - todayProtein))
    : null;
  const baseKcalTarget = kcalGoal
    ? Math.round(tdeeForGoals - kcalGoal.targetValue)
    : Math.round(tdeeForGoals);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>
            Dashboard
          </h1>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {new Date(range.from).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} –{" "}
            {new Date(range.to).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
        {/* Teal underline accent */}
        <div style={{ width: 40, height: 3, background: "var(--teal)", borderRadius: 99, marginTop: 8, boxShadow: "0 0 8px var(--teal-glow)" }} />
      </div>

      {/* KPI-Leiste */}
      <div className="dash-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        <KpiTile icon="⚖️" label="Gewicht aktuell" value={latestWeight ? `${latestWeight} kg` : "–"}
          sub={bodyFat ? `Körperfett: ${bodyFat.toFixed(1)} %` : "Gewicht eintragen"}
          color={latestWeight ? "var(--teal)" : undefined} />
        <KpiTile icon="⚡" label="Grundumsatz / TDEE" value={bmrRef ? `${Math.round(bmrRef)} kcal` : "–"}
          sub={tdee ? `TDEE: ${Math.round(tdee)} kcal/Tag` : undefined} />
        <KpiTile icon="⚠️" label="Max. Defizit/Tag"
          value={maxDef ? `${maxDef} kcal` : "–"}
          sub="Körperfett (kg) × 70"
          color={maxDef ? "var(--orange)" : undefined} />
        <KpiTile icon="🥩" label="Protein-Ziel"
          value={latestWeight ? `${Math.round(latestWeight * 1.6)}–${Math.round(latestWeight * profile.proteinFactor)} g` : "–"}
          sub={`Faktor: ${profile.proteinFactor} g/kg KG`}
          color={latestWeight ? "var(--teal)" : undefined} />
      </div>

      {/* Ziele-Leiste */}
      <div className="dash-goal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
        <div className="kpi-card" style={{ borderLeft: "2px solid var(--teal)", opacity: 0.9 }}>
          <div className="kpi-label"><span>🎯</span>Tagesziel Kalorien</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "var(--teal)", display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            {todayAee
              ? <>{baseKcalTarget} <span style={{ fontSize: 13, fontWeight: 700 }}>+ {todayAee} kcal</span></>
              : <>{baseKcalTarget} kcal <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>+ AEE</span></>}
          </div>
          <div className="kpi-sub">
            {kcalGoal
              ? `BMR ${Math.round(bmrForGoals)} x ${profile.activityLevel} = ${Math.round(tdeeForGoals)} - ${kcalGoal.targetValue}`
              : `BMR ${Math.round(bmrForGoals)} x ${profile.activityLevel} = ${Math.round(tdeeForGoals)} (kein Defizit)`}
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: "2px solid var(--orange)", opacity: 0.9 }}>
          <div className="kpi-label"><span>🥩</span>Proteinziel</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "var(--orange)" }}>
            {proteinTarget ? `${proteinTarget} g` : "–"}
          </div>
          <div className="kpi-sub">
            {proteinRemaining != null
              ? `Noch ${proteinRemaining} g · ${todayProtein}g gegessen`
              : latestWeight ? `${profile.proteinFactor} g x ${latestWeight} kg` : "Gewicht eintragen"}
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: "2px solid var(--green)", opacity: 0.9 }}>
          <div className="kpi-label"><span>🏆</span>Zielgewicht</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "var(--green)" }}>
            {weightGoal ? `${weightGoal.targetValue} kg` : "–"}
          </div>
          <div className="kpi-sub">
            {weightGoal && latestWeight
              ? `Noch ${Math.max(0, +(latestWeight - weightGoal.targetValue).toFixed(1))} kg`
              : weightGoal ? "Ziel gesetzt" : "Kein Ziel gesetzt"}
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: "2px solid var(--purple)", opacity: 0.9 }}>
          <div className="kpi-label"><span>😴</span>Schlafziel</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "var(--purple)" }}>
            {sleepGoal ? `${sleepGoal.targetValue} Std.` : "–"}
          </div>
          <div className="kpi-sub">{sleepGoal ? "Ziel gesetzt ✓" : "Kein Ziel gesetzt"}</div>
        </div>
      </div>

      {/* 4 Haupt-Widgets */}
      <div className="dash-widget-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>

        {/* SCHRITTE */}
        <WidgetCard icon="🚶" title="Schritte diese Woche"
          kpi={totalSteps > 0 ? totalSteps.toLocaleString("de") : "–"}
          sub={avgSteps ? `Ø ${avgSteps.toLocaleString("de")} Schritte/Tag · ${stepsCount} Einträge` : "Noch keine Daten"}
          badge={avgSteps ? <span className={`badge ${avgSteps >= 10000 ? "badge-teal" : "badge-orange"}`}>{avgSteps >= 10000 ? "✓ Ziel" : "< 10.000"}</span> : undefined}
          onClick={() => onGoDetail("detail-steps")}>
          <div className="widget-chart-inner" style={{ height: 110 }}><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stepsData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid {...DARK.grid} />
              <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
              <YAxis tick={DARK.tick} tickLine={false} axisLine={false} />
              <Tooltip {...DARK.tooltip} formatter={(v: number) => [v?.toLocaleString("de"), "Schritte"]} />
              <ReferenceLine y={10000} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5} />
              <Bar dataKey="steps" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {stepsData.map((d, i) => <Cell key={i} fill={(d.steps ?? 0) >= 10000 ? "var(--teal)" : "var(--blue)"} fillOpacity={d.steps ? 0.85 : 0} />)}
              </Bar>
              {avgSteps && <ReferenceLine y={avgSteps} stroke="var(--teal)" strokeDasharray="2 2" strokeWidth={1} />}
            </ComposedChart>
          </ResponsiveContainer></div>
        </WidgetCard>

        {/* GEWICHT */}
        <WidgetCard icon="⚖️" title="Gewichtsverlauf"
          kpi={lastW ? `${lastW} kg` : "–"}
          sub={weightDiff != null ? `${weightDiff > 0 ? "▲" : weightDiff < 0 ? "▼" : "="} ${Math.abs(weightDiff)} kg diese Woche` : "Noch keine Daten"}
          badge={weightDiff != null ? <span className={`badge ${weightDiff < 0 ? "badge-teal" : weightDiff > 0 ? "badge-red" : "badge-gray"}`}>{weightDiff > 0 ? "+" : ""}{weightDiff} kg</span> : undefined}
          onClick={() => onGoDetail("detail-weight")}>
          <div className="widget-chart-inner" style={{ height: 110 }}><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weightData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...DARK.grid} />
              <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
              <YAxis domain={["auto", "auto"]} tick={DARK.tick} tickLine={false} axisLine={false} />
              <Tooltip {...DARK.tooltip} formatter={(v: number) => [`${v} kg`, "Gewicht"]} />
              <Area type="monotone" dataKey="weight" stroke="var(--teal)" strokeWidth={2.5}
                fill="url(#wGrad)" dot={{ r: 4, fill: "var(--teal)", strokeWidth: 0 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer></div>
        </WidgetCard>

        {/* KALORIEN – kombiniert Bar (Bilanz) + Line (gegessen) */}
        <WidgetCard icon="🔥" title="Kalorienbalance"
          kpi={kcalData.some(d => d.deficit != null) ? `${totalDeficit > 0 ? "+" : ""}${Math.round(totalDeficit)} kcal` : "–"}
          sub={Math.abs(fatKg) > 0.01 ? `≈ ${fatKg > 0 ? "+" : ""}${fatKg.toFixed(2)} kg Fett` : "Noch keine Daten"}
          badge={kcalData.some(d => d.deficit != null) ? <span className={`badge ${totalDeficit <= 0 ? "badge-teal" : "badge-red"}`}>{totalDeficit <= 0 ? "Defizit ✓" : "Überschuss"}</span> : undefined}
          onClick={() => onGoDetail("detail-kcal")}>
          <div className="widget-chart-inner" style={{ height: 110 }}><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={kcalData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid {...DARK.grid} />
              <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
              <YAxis tick={DARK.tick} tickLine={false} axisLine={false} />
              <Tooltip {...DARK.tooltip}
                formatter={(v: number, name: string) => [
                  name === "deficit" ? `${v > 0 ? "+" : ""}${Math.round(v)} kcal` : `${Math.round(v)} kcal`,
                  name === "deficit" ? "Bilanz" : "Gegessen",
                ]} />
              <ReferenceLine y={0} stroke="var(--border2)" strokeWidth={1.5} />
              <Bar dataKey="deficit" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {kcalData.map((d, i) => <Cell key={i} fill={(d.deficit ?? 0) <= 0 ? "var(--teal)" : "var(--red)"} fillOpacity={d.deficit != null ? 0.8 : 0} />)}
              </Bar>
              <Line type="monotone" dataKey="consumed" stroke="var(--orange)"
                strokeWidth={1.5} strokeDasharray="4 3"
                dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer></div>
        </WidgetCard>

        {/* SCHLAF */}
        <WidgetCard icon="😴" title="Schlaf"
          kpi={avgSleep ? formatMinutes(avgSleep) : "–"}
          sub={sleepEntries.length ? `Ø pro Nacht · ${sleepEntries.length} Einträge` : "Noch keine Daten"}
          badge={avgSleep ? <span className={`badge ${avgSleep >= 420 ? "badge-teal" : avgSleep >= 300 ? "badge-orange" : "badge-red"}`}>{avgSleep >= 420 ? "Gut" : avgSleep >= 300 ? "Ok" : "Zu wenig"}</span> : undefined}
          onClick={() => onGoDetail("detail-sleep")}>
          <div className="widget-chart-inner" style={{ height: 110 }}><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sleepData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--purple)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--purple)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...DARK.grid} />
              <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
              <YAxis tick={DARK.tick} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v/60)}h`} />
              <Tooltip {...DARK.tooltip} formatter={(v: number, name: string) => [formatMinutes(v), name === "actual" ? "Schlaf" : "Tiefschlaf"]} />
              <ReferenceLine y={420} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5} />
              <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={28} fill="var(--purple)" fillOpacity={0.6} />
              <Line type="monotone" dataKey="deep" stroke="var(--teal)" strokeWidth={2}
                dot={{ r: 3, fill: "var(--teal)", strokeWidth: 0 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer></div>
        </WidgetCard>
      </div>

      {/* Tagesübersicht */}
      <div className="card">
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="section-head-icon">📋</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Tagesübersicht</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a className="btn btn-xs btn-secondary" href="/api/export?format=csv" download={`FitnessTracker-Export-${today}.csv`}>⬇ CSV</a>
            <a className="btn btn-xs btn-secondary" href="/api/export?format=json" download={`FitnessTracker-Vollexport-${today}.json`}>⬇ JSON</a>
            <button className="btn btn-xs btn-secondary" onClick={() => window.print()}>📄 PDF</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th style={{ textAlign: "right" }}>Gewicht</th>
                <th style={{ textAlign: "right" }}>Gegessen</th>
                <th style={{ textAlign: "right" }}>Bilanz</th>
                <th style={{ textAlign: "right" }}>Protein</th>
                <th style={{ textAlign: "right" }}>Schritte</th>
                <th style={{ textAlign: "right" }}>Schlaf</th>
                <th style={{ textAlign: "center" }}>Wasser</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dates.map(d => {
                const log = logMap[d];
                const w = log?.weight ?? latestWeight;
                const bmr = log?.bmrOverride ?? (w ? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate)) : null);
                const tdee = bmr != null ? Math.round(calcTDEE(bmr, profile.activityLevel)) : null;
                const bal = tdee != null && log?.kcalConsumed != null ? Math.round(log.kcalConsumed - tdee - (log.kcalBurned ?? 0)) : null;
                const isToday = d === today;
                const proteinMin = latestWeight ? Math.round(latestWeight * 1.6) : null;
                return (
                  <tr key={d} style={{ opacity: log ? 1 : 0.4, cursor: "pointer" }}
                    onDoubleClick={() => onEditEntry(d)}
                    title="Doppelklick zum Bearbeiten">
                    <td>
                      <span style={{ color: isToday ? "var(--teal)" : "var(--text-2)", fontWeight: isToday ? 700 : 400 }}>
                        {new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                      </span>
                      {isToday && <span className="badge badge-teal" style={{ marginLeft: 8 }}>Heute</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--teal)" }}>{log?.weight ? `${log.weight} kg` : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                    <td style={{ textAlign: "right" }}>{log?.kcalConsumed ? `${log.kcalConsumed}` : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: bal == null ? undefined : bal <= 0 ? "var(--green)" : "var(--red)" }}>
                      {bal != null ? `${bal > 0 ? "+" : ""}${bal}` : <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>–</span>}
                    </td>
                    <td style={{ textAlign: "right", color: log?.proteinG && proteinMin && log.proteinG >= proteinMin ? "var(--teal)" : "var(--text)" }}>
                      {log?.proteinG ? `${log.proteinG} g` : <span style={{ color: "var(--text-muted)" }}>–</span>}
                    </td>
                    <td style={{ textAlign: "right", color: (log?.steps ?? 0) >= 10000 ? "var(--teal)" : "var(--text)" }}>
                      {log?.steps ? log.steps.toLocaleString("de") : <span style={{ color: "var(--text-muted)" }}>–</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>{log?.sleepActual ? formatMinutes(log.sleepActual) : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                    <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{log?.waterMl ? `${(log.waterMl / 1000).toFixed(1)} L` : "–"}</td>
                    <td style={{ textAlign: "right", paddingRight: 16 }}>
                      <button className="btn btn-xs btn-secondary" onClick={e => { e.stopPropagation(); onEditEntry(d); }}>
                        {log ? "Bearbeiten" : "+ Eintrag"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
