"use client";
// v3
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
  tick:    { fontSize: 10.5, fill: "#8b949e" },
  tooltip: {
    contentStyle: {
      background: "#1c2333", border: "1px solid #2a3348",
      borderRadius: 10, fontSize: 12.5, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      color: "#e6edf3",
    },
    labelStyle: { color: "#8b949e", marginBottom: 4, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    itemStyle: { color: "#e6edf3" },
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

function WidgetCard({ icon, title, kpi, sub, badge, children, onClick, wide }: {
  icon: string; title: string; kpi: string; sub?: string;
  badge?: React.ReactNode; children: React.ReactNode; onClick: () => void; wide?: boolean;
}) {
  return (
    <div className="card card-pad card-clickable" style={wide ? { gridColumn: "1 / -1" } : undefined} onClick={onClick}>
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

export default function Dashboard({ logs, allLogs, profile, range, today: todayProp, onGoDetail, onEditEntry }: {
  logs: DailyLog[]; allLogs: DailyLog[]; profile: Profile; range: DateRange; today: string;
  onGoDetail: (v: View) => void; onEditEntry: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayProp);
  useEffect(() => { setSelectedDate(todayProp); }, [todayProp]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [noteText, setNoteText]   = useState<string>("");
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteSaving, setNoteSaving]   = useState(false);
  const [widgetMeas,    setWidgetMeas]    = useState<{ belly?: number; waist?: number; hip?: number; chest?: number; date: string }[]>([]);
  const [widgetCardio,  setWidgetCardio]  = useState<{ date: string; distKm: number; type: string }[]>([]);
  // widgetWorkout removed (Training widget moved to Nav tab)
  useEffect(() => {
    fetch("/api/goals").then(r => r.json()).then(g => { setGoals(g); setGoalsLoaded(true); }).catch(() => setGoalsLoaded(true));
  }, []);
  useEffect(() => {
    const from30 = (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().split("T")[0]; })();
    const to = todayProp;
    fetch(`/api/measurements?from=${from30}&to=${to}`).then(r => r.json())
      .then((ms: { date: string; belly?: number; waist?: number; hip?: number; chest?: number }[]) => setWidgetMeas(ms)).catch(() => {});
    fetch(`/api/cardio?from=${from30}&to=${to}`).then(r => r.json())
      .then((cs: { date: string; distanceM?: number; type: string }[]) => setWidgetCardio(
        cs.map(c => ({ date: `${String(new Date(c.date.split("T")[0]+"T12:00:00").getDate()).padStart(2,"0")}.${String(new Date(c.date.split("T")[0]+"T12:00:00").getMonth()+1).padStart(2,"0")}`, distKm: +((c.distanceM??0)/1000).toFixed(2), type: c.type }))
      )).catch(() => {});
  }, [todayProp]);

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

  const today = selectedDate;

  // ── Streak ────────────────────────────────────
  const streak = useMemo(() => {
    const logDateSet = new Set(allLogs.map(l => l.date.split("T")[0]));
    let count = 0;
    const base = new Date(todayProp + "T12:00:00");
    for (let i = 0; i < 365; i++) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (logDateSet.has(ds)) count++; else break;
    }
    return count;
  }, [allLogs, todayProp]);

  // ── Längste Streak (Benchmarks) ──────────────
  const longestStreak = useMemo(() => {
    const dates = [...new Set(allLogs.map(l => l.date.split("T")[0]))].sort();
    let max = 0; let cur = 0; let prev = "";
    for (const d of dates) {
      if (prev) {
        const diff = (new Date(d + "T12:00:00").getTime() - new Date(prev + "T12:00:00").getTime()) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      } else { cur = 1; }
      if (cur > max) max = cur;
      prev = d;
    }
    return max;
  }, [allLogs]);

  // ── Wöchentliche Zusammenfassung ─────────────
  const lastWeekSummary = useMemo(() => {
    const base = new Date(todayProp + "T12:00:00");
    const dow = base.getDay(); // 0=So,1=Mo..6=Sa
    // Days since last completed Sunday
    const daysSinceSunday = dow === 0 ? 7 : dow;
    const lastSun = new Date(base); lastSun.setDate(base.getDate() - daysSinceSunday);
    const lastMon = new Date(lastSun); lastMon.setDate(lastSun.getDate() - 6);
    const from = `${lastMon.getFullYear()}-${String(lastMon.getMonth()+1).padStart(2,"0")}-${String(lastMon.getDate()).padStart(2,"0")}`;
    const to   = `${lastSun.getFullYear()}-${String(lastSun.getMonth()+1).padStart(2,"0")}-${String(lastSun.getDate()).padStart(2,"0")}`;
    const wLogs = allLogs.filter(l => { const d = l.date.split("T")[0]; return d >= from && d <= to; });
    if (wLogs.length === 0) return null;
    const kcalLogs = wLogs.filter(l => l.kcalConsumed);
    const sleepLogs = wLogs.filter(l => l.sleepActual);
    const wts = wLogs.filter(l => l.weight).map(l => l.weight as number);
    const avgKcal  = kcalLogs.length  ? Math.round(kcalLogs.reduce((s,l) => s+(l.kcalConsumed??0),0)/kcalLogs.length)  : null;
    const avgSleepW= sleepLogs.length ? Math.round(sleepLogs.reduce((s,l) => s+(l.sleepActual??0),0)/sleepLogs.length) : null;
    const wtDelta  = wts.length >= 2  ? +(wts[wts.length-1] - wts[0]).toFixed(1) : null;
    // Ø deficit
    const deficits = wLogs.map(l => {
      if (!l.kcalConsumed) return null;
      const w = l.weight ?? latestWeight;
      const bmr = l.bmrOverride ?? (w ? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate)) : null);
      if (!bmr) return null;
      return l.kcalConsumed - Math.round(calcTDEE(bmr, profile.activityLevel)) - (l.kcalBurned ?? 0);
    }).filter(d => d != null) as number[];
    const avgDeficit = deficits.length ? Math.round(deficits.reduce((s,d)=>s+d,0)/deficits.length) : null;
    return { from, to, avgKcal, avgSleepW, wtDelta, avgDeficit, days: wLogs.length };
  }, [allLogs, todayProp, latestWeight, profile]);

  // ── Trend-Projektion ─────────────────────────
  const projection = useMemo(() => {
    if (!latestWeight) return null;
    const wg = goals.find(g => g.type === "weight");
    if (!wg || wg.targetValue >= latestWeight) return null;
    const kgToLose = latestWeight - wg.targetValue;
    // Average daily deficit from last 14 days with data
    const recent = allLogs.filter(l => l.kcalConsumed).slice(-14);
    if (recent.length < 3) return null;
    const avgDef = recent.map(l => {
      const w = l.weight ?? latestWeight;
      const bmr = l.bmrOverride ?? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate));
      return -(l.kcalConsumed! - Math.round(calcTDEE(bmr, profile.activityLevel)) - (l.kcalBurned ?? 0));
    }).reduce((s,d)=>s+d,0) / recent.length;
    if (avgDef <= 50) return null; // basically no deficit
    const daysLeft = Math.round((kgToLose * 7700) / avgDef);
    const target = new Date(todayProp + "T12:00:00");
    target.setDate(target.getDate() + daysLeft);
    const dateStr = target.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
    return { dateStr, daysLeft, avgDef: Math.round(avgDef), kgToLose: +kgToLose.toFixed(1) };
  }, [allLogs, goals, latestWeight, profile, todayProp]);

  // ── Benchmarks ────────────────────────────────
  const benchmarks = useMemo(() => {
    const logsLast90 = allLogs.filter(l => {
      const d = new Date(l.date.split("T")[0] + "T12:00:00");
      const cutoff = new Date(todayProp + "T12:00:00"); cutoff.setDate(cutoff.getDate() - 90);
      return d >= cutoff;
    });
    // Niedrigstes Gewicht
    const weights = logsLast90.filter(l => l.weight).map(l => ({ w: l.weight as number, d: l.date.split("T")[0] }));
    const lowestW = weights.length ? weights.reduce((a,b) => b.w < a.w ? b : a) : null;
    // Beste Woche (höchstes Ø Defizit)
    const byWeek: Record<string, number[]> = {};
    logsLast90.forEach(l => {
      if (!l.kcalConsumed) return;
      const d = new Date(l.date.split("T")[0] + "T12:00:00");
      const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay()+6)%7));
      const key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
      const w = l.weight ?? latestWeight;
      if (!w) return;
      const bmr = l.bmrOverride ?? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate));
      const def = -(l.kcalConsumed - Math.round(calcTDEE(bmr, profile.activityLevel)) - (l.kcalBurned ?? 0));
      if (!byWeek[key]) byWeek[key] = [];
      byWeek[key].push(def);
    });
    const weekEntries = Object.entries(byWeek).filter(([,v]) => v.length >= 3);
    const bestWeek = weekEntries.length
      ? weekEntries.map(([k,v]) => ({ k, avg: Math.round(v.reduce((s,d)=>s+d,0)/v.length) })).sort((a,b)=>b.avg-a.avg)[0]
      : null;
    const bestWeekDate = bestWeek ? new Date(bestWeek.k + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) : null;
    return { lowestW, bestWeek, bestWeekDate, longestStreak };
  }, [allLogs, todayProp, latestWeight, profile, longestStreak]);

  // ── Notizen-Sync ──────────────────────────────
  useEffect(() => {
    const log = allLogs.find(l => l.date.split("T")[0] === todayProp);
    setNoteText(log?.notes ?? "");
    setNoteEditing(false);
  }, [todayProp, allLogs]);

  async function saveNote() {
    setNoteSaving(true);
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayProp, notes: noteText }),
    });
    setNoteSaving(false);
    setNoteEditing(false);
  }

  // Heutiger Tag spezifisch
  const todayLog = logMap[today] ?? null;
  const todaySteps = todayLog?.steps ?? null;
  const todayBmrCalc = todayLog?.bmrOverride ?? (latestWeight ? calcBMR(latestWeight, profile.height, profile.gender, new Date(profile.birthdate)) : null);
  const todayTdeeCalc = todayBmrCalc ? Math.round(calcTDEE(todayBmrCalc, profile.activityLevel)) : null;
  const todayKcalDeficit = todayTdeeCalc != null && todayLog?.kcalConsumed != null
    ? Math.round(todayLog.kcalConsumed - todayTdeeCalc - (todayLog.kcalBurned ?? 0))
    : null;

  // Ziele-Berechnung (außerhalb JSX um IIFE zu vermeiden)
  const weightGoal = goals.find(g => g.type === "weight");
  const proteinGoal = goals.find(g => g.type === "protein");
  const sleepGoal = goals.find(g => g.type === "sleep");
  const kcalGoal = goals.find(g => g.type === "kcal_deficit");
  const bmrForGoals = calcBMR(latestWeight ?? 80, profile.height, profile.gender, new Date(profile.birthdate));
  const tdeeForGoals = calcTDEE(bmrForGoals, profile.activityLevel);
  const proteinTarget = !goalsLoaded ? null : (proteinGoal?.targetValue
    ?? (latestWeight ? Math.round(latestWeight * profile.proteinFactor) : null));
  const todayAee = logMap[today]?.kcalBurned ?? null;
  const todayProtein = logMap[today]?.proteinG ?? null;
  const sleepGoalMins = sleepGoal ? Math.round(sleepGoal.targetValue * 60) : 420;
  const todaySleep = logMap[today]?.sleepActual ?? null;
  const stepsGoal = goals.find(g => g.type === "steps")?.targetValue ?? 10000;
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>
              Dashboard
            </h1>
            <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {new Date(range.from + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} –{" "}
              {new Date(range.to + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            {streak > 0 && (
              <span title={`${streak} Tag${streak !== 1 ? "e" : ""} in Folge mit Eintrag`}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap", background: streak >= 7 ? "var(--teal-dim)" : "var(--surface2)", color: streak >= 7 ? "var(--teal)" : "var(--text-muted)", border: `1px solid ${streak >= 7 ? "var(--teal)" : "var(--border2)"}` }}>
                🔥 {streak} Tag{streak !== 1 ? "e" : ""} Streak
              </span>
            )}
          </div>
          {/* Tagesauswahl */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tagesansicht</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ fontSize: 12.5, padding: "5px 10px", width: 145 }}
            />
            {selectedDate !== todayProp && (
              <button className="btn btn-xs btn-secondary" onClick={() => setSelectedDate(todayProp)}>
                Heute
              </button>
            )}
          </div>
        </div>
        <div style={{ width: 40, height: 3, background: "var(--teal)", borderRadius: 99, marginTop: 10, boxShadow: "0 0 8px var(--teal-glow)" }} />
      </div>

      {/* Heute-Statusleiste — nur Metriken mit gesetztem Ziel */}
      {goalsLoaded && goals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {selectedDate === todayProp ? "Heute" : new Date(selectedDate + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            {
              goalType: "weight",
              icon: "⚖️", label: "Gewicht",
              value: todayLog?.weight != null ? `${todayLog.weight} kg` : null,
              ok: todayLog?.weight != null && weightGoal
                ? todayLog.weight <= weightGoal.targetValue
                : todayLog?.weight != null ? true : undefined,
            },
            {
              goalType: "kcal_deficit",
              icon: "🔥", label: "Kalorien",
              value: todayLog?.kcalConsumed != null
                ? (todayTdeeCalc != null
                    ? `${todayLog.kcalConsumed} / ${baseKcalTarget + (todayLog.kcalBurned ?? 0)}`
                    : `${todayLog.kcalConsumed} kcal`)
                : null,
              ok: todayKcalDeficit != null ? todayKcalDeficit <= 0 : undefined,
            },
            {
              goalType: "protein",
              icon: "🥩", label: "Protein",
              value: todayProtein != null ? `${todayProtein} g` : null,
              ok: proteinTarget != null && todayProtein != null ? todayProtein >= proteinTarget : undefined,
            },
            {
              goalType: "steps",
              icon: "🚶", label: "Schritte",
              value: todaySteps != null ? todaySteps.toLocaleString("de") : null,
              ok: todaySteps != null ? todaySteps >= stepsGoal : undefined,
            },
            {
              goalType: "sleep",
              icon: "😴", label: "Schlaf",
              value: todaySleep != null ? formatMinutes(todaySleep) : null,
              ok: todaySleep != null ? todaySleep >= sleepGoalMins : undefined,
            },
          ] as { goalType: string; icon: string; label: string; value: string | null; ok?: boolean }[])
            .filter(chip => goals.some(g => g.type === chip.goalType))
            .map(({ icon, label, value, ok }) => {
              const filled = value != null;
              const color  = filled ? (ok === true ? "var(--teal)" : ok === false ? "var(--red)" : "var(--text)") : "var(--text-muted)";
              const bg     = filled ? (ok === true ? "rgba(0,212,180,.10)" : ok === false ? "rgba(239,68,68,.08)" : "var(--surface2)") : "var(--surface2)";
              const border = filled ? (ok === true ? "var(--teal)" : ok === false ? "var(--red)" : "var(--border2)") : "var(--border2)";
              return (
                <button key={label} onClick={() => onEditEntry(selectedDate)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: bg, border: `1px solid ${border}`, color }}>
                  <span style={{ fontSize: 12 }}>{icon}</span>
                  <span>{filled ? value : label}</span>
                  {filled && ok === true && <span style={{ fontSize: 10 }}>✓</span>}
                  {!filled && <span style={{ fontSize: 10, opacity: 0.5 }}>?</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        {(() => {
          const gw = goals.find(g => g.type === "weight");
          if (!gw) return (
            <div className="kpi-card" style={{ borderLeft: "2px solid var(--border2)", opacity: 0.9 }}>
              <div className="kpi-label"><span>🎯</span>Zielgewicht</div>
              <div className="kpi-value" style={{ fontSize: 13, color: "var(--text-muted)" }}>Nicht gesetzt</div>
              <div className="kpi-sub">Unter Ziele eintragen</div>
            </div>
          );
          const diff = latestWeight != null ? +(latestWeight - gw.targetValue).toFixed(1) : null;
          const color = diff == null ? "var(--text-muted)" : diff <= 0 ? "var(--green)" : "var(--red)";
          const border = diff == null ? "var(--border2)" : diff <= 0 ? "var(--green)" : "var(--red)";
          return (
            <div className="kpi-card" style={{ borderLeft: `2px solid ${border}`, opacity: 0.9 }}>
              <div className="kpi-label"><span>🎯</span>Zielgewicht-Abstand</div>
              <div className="kpi-value" style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>
                {diff == null ? "–" : diff <= 0 ? `${Math.abs(diff)} kg ✓` : `${diff} kg`}
              </div>
              <div className="kpi-sub">
                Ziel: {gw.targetValue} kg
                {diff != null && diff > 0 && ` · noch ${diff} kg`}
                {diff != null && diff <= 0 && " · Ziel erreicht!"}
              </div>
            </div>
          );
        })()}
        <div className="kpi-card" style={{ borderLeft: "2px solid var(--purple)", opacity: 0.9 }}>
          <div className="kpi-label"><span>😴</span>Schlaf heute</div>
          <div className="kpi-value" style={{ fontSize: 18, color: todaySleep ? "var(--purple)" : "var(--text-muted)" }}>
            {todaySleep ? formatMinutes(todaySleep) : !goalsLoaded ? "–" : sleepGoal ? `${sleepGoal.targetValue} Std.` : "7–9 Std."}
          </div>
          <div className="kpi-sub">
            {todaySleep
              ? (sleepGoal ? `Ziel: ${sleepGoal.targetValue} Std. ${todaySleep >= sleepGoalMins ? "✓" : `· noch ${formatMinutes(sleepGoalMins - todaySleep)}`}` : "Eingetragen")
              : "Noch kein Eintrag · Empfehlung"}
          </div>
        </div>
      </div>

      {/* 4 Haupt-Widgets */}
      <div className="dash-widget-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>

        {/* SCHRITTE */}
        <WidgetCard icon="🚶" title="Schritte heute"
          kpi={todaySteps != null ? todaySteps.toLocaleString("de") : "–"}
          sub={todaySteps != null
            ? `Heute · Ø ${avgSteps ? avgSteps.toLocaleString("de") : "–"}/Tag diese Woche`
            : avgSteps ? `Ø ${avgSteps.toLocaleString("de")}/Tag · ${stepsCount} Einträge` : "Noch kein Eintrag"}
          badge={todaySteps != null
            ? <span className={`badge ${todaySteps >= stepsGoal ? "badge-teal" : "badge-orange"}`}>{todaySteps >= stepsGoal ? "✓ Ziel" : `${Math.round(todaySteps/stepsGoal*100)} %`}</span>
            : avgSteps ? <span className={`badge ${avgSteps >= stepsGoal ? "badge-teal" : "badge-orange"}`}>Ø {avgSteps >= stepsGoal ? "✓" : "< Ziel"}</span> : undefined}
          onClick={() => onGoDetail("detail-steps")}>
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </WidgetCard>

        {/* GEWICHT */}
        <WidgetCard icon="⚖️" title="Gewichtsverlauf"
          kpi={lastW ? `${lastW} kg` : "–"}
          sub={weightDiff != null ? `${weightDiff > 0 ? "▲" : weightDiff < 0 ? "▼" : "="} ${Math.abs(weightDiff)} kg diese Woche` : "Noch keine Daten"}
          badge={weightDiff != null ? <span className={`badge ${weightDiff < 0 ? "badge-teal" : weightDiff > 0 ? "badge-red" : "badge-gray"}`}>{weightDiff > 0 ? "+" : ""}{weightDiff} kg</span> : undefined}
          onClick={() => onGoDetail("detail-weight")}>
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </WidgetCard>

        {/* KALORIEN – Heute spezifisch, Chart zeigt 7-Tage-Trend */}
        <WidgetCard icon="🔥" title="Kalorien heute"
          kpi={todayLog?.kcalConsumed != null
            ? (todayTdeeCalc != null ? `${todayLog.kcalConsumed} / ${baseKcalTarget + (todayLog.kcalBurned ?? 0)}` : `${todayLog.kcalConsumed} kcal`)
            : "–"}
          sub={todayLog?.kcalConsumed != null && todayTdeeCalc != null
            ? (todayKcalDeficit! <= 0
                ? `Defizit ${Math.abs(todayKcalDeficit!)} kcal · ${Math.abs(todayKcalDeficit!/7700).toFixed(3)} kg Fett`
                : `${todayKcalDeficit} kcal über Budget · Heute gegessen`)
            : kcalData.some(d => d.deficit != null)
              ? `Ø ${Math.round(totalDeficit / kcalData.filter(d => d.deficit != null).length)} kcal/Tag · 7 Tage`
              : "Noch kein Eintrag"}
          badge={todayKcalDeficit != null
            ? <span className={`badge ${todayKcalDeficit <= 0 ? "badge-teal" : "badge-red"}`}>{todayKcalDeficit <= 0 ? `${Math.abs(todayKcalDeficit)} kcal frei` : "Überschuss"}</span>
            : kcalData.some(d => d.deficit != null) ? <span className={`badge ${totalDeficit <= 0 ? "badge-teal" : "badge-red"}`}>{totalDeficit <= 0 ? "Ø Defizit" : "Ø Überschuss"}</span> : undefined}
          onClick={() => onGoDetail("detail-kcal")}>
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </WidgetCard>

        {/* SCHLAF */}
        <WidgetCard icon="😴" title="Schlaf"
          kpi={todaySleep != null ? formatMinutes(todaySleep) : "–"}
          sub={todaySleep != null
            ? `Heute · Ø ${avgSleep ? formatMinutes(avgSleep) : "–"} (${sleepEntries.length} Nächte)`
            : avgSleep ? `Ø ${formatMinutes(avgSleep)} pro Nacht · ${sleepEntries.length} Einträge` : "Noch kein Eintrag"}
          badge={todaySleep != null
            ? <span className={`badge ${todaySleep >= 420 ? "badge-teal" : todaySleep >= 300 ? "badge-orange" : "badge-red"}`}>{todaySleep >= 420 ? "Gut" : todaySleep >= 300 ? "Ok" : "Zu wenig"}</span>
            : avgSleep ? <span className={`badge ${avgSleep >= 420 ? "badge-teal" : avgSleep >= 300 ? "badge-orange" : "badge-red"}`}>{avgSleep >= 420 ? "Ø Gut" : avgSleep >= 300 ? "Ø Ok" : "Ø Wenig"}</span> : undefined}
          onClick={() => onGoDetail("detail-sleep")}>
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </WidgetCard>

        {(() => {
          const latestMeas = widgetMeas.at(-1);
          const bellyData  = widgetMeas.filter(m => m.belly != null).map(m => ({
            date: `${String(new Date(m.date.split("T")[0]+"T12:00:00").getDate()).padStart(2,"0")}.${String(new Date(m.date.split("T")[0]+"T12:00:00").getMonth()+1).padStart(2,"0")}`,
            belly: m.belly,
          }));
          const first = bellyData[0]?.belly;
          const last  = bellyData.at(-1)?.belly;
          const delta = first && last && bellyData.length >= 2 ? +(last - first).toFixed(1) : null;
          return (
            <WidgetCard icon="📏" title="Körpermaße"
              kpi={latestMeas?.belly ? `${latestMeas.belly} cm` : latestMeas?.waist ? `${latestMeas.waist} cm` : "–"}
              sub={latestMeas ? `Bauchumfang${delta != null ? ` · ${delta > 0 ? "+" : ""}${delta} cm` : ""} · 30 Tage` : "Umfänge tracken"}
              badge={delta != null ? <span className={`badge ${delta <= 0 ? "badge-teal" : "badge-red"}`}>{delta > 0 ? "+" : ""}{delta} cm</span> : undefined}
              onClick={() => onGoDetail("detail-measurements")}>
              {bellyData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bellyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid {...DARK.grid} />
                    <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={DARK.tick} tickLine={false} axisLine={false} />
                    <Tooltip {...DARK.tooltip} formatter={(v: unknown) => [`${v} cm`, "Bauch"]} />
                    <Line type="monotone" dataKey="belly" stroke="var(--orange)" strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--orange)", strokeWidth: 0 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : latestMeas ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingTop: 6 }}>
                  {([["Bauch", latestMeas.belly], ["Brust", latestMeas.chest], ["Hüfte", latestMeas.hip]] as [string, number|undefined][]).map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{val != null ? `${val}` : "–"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ paddingTop: 4 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Taille, Bauch, Hüfte, Oberarm und mehr – im Tageseintrag erfassen</p>
                </div>
              )}
            </WidgetCard>
          );
        })()}

        {(() => {
          const totalKm = +widgetCardio.reduce((s,c) => s+c.distKm, 0).toFixed(1);
          const lastSession = widgetCardio.at(-1);
          return (
            <WidgetCard icon="🏃" title="Cardio"
              kpi={widgetCardio.length ? `${widgetCardio.length} Session${widgetCardio.length > 1 ? "s" : ""}` : "–"}
              sub={totalKm > 0 ? `${totalKm} km · 30 Tage` : "Sessions tracken"}
              badge={widgetCardio.length ? <span className="badge badge-teal">{totalKm} km</span> : undefined}
              onClick={() => onGoDetail("detail-cardio")}>
              {widgetCardio.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={widgetCardio} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid {...DARK.grid} />
                    <XAxis dataKey="date" tick={DARK.tick} tickLine={false} axisLine={false} />
                    <YAxis tick={DARK.tick} tickLine={false} axisLine={false} unit=" km" />
                    <Tooltip {...DARK.tooltip} formatter={(v: unknown) => [`${v} km`, "Strecke"]} />
                    <Bar dataKey="distKm" radius={[4,4,0,0]} maxBarSize={28} fill="var(--teal)" fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              ) : lastSession ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingTop: 6 }}>
                  {([
                    ["Datum", lastSession.date],
                    ["Strecke", `${lastSession.distKm} km`],
                    ["Art", lastSession.type || "–"],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{val}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ paddingTop: 4 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Joggen, Radfahren, Schwimmen – im Tageseintrag erfassen</p>
                </div>
              )}
            </WidgetCard>
          );
        })()}
      </div>

      {/* ── Wöchentliche Zusammenfassung + Benchmarks + Notizen ── */}
      <div className="dash-weekly-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>

        {/* Letzte Woche */}
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div className="section-head-icon">📆</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Letzte Woche</span>
            {lastWeekSummary && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{lastWeekSummary.days} Einträge</span>}
          </div>
          {!lastWeekSummary ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Noch keine abgeschlossene Woche mit Daten.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lastWeekSummary.avgKcal != null && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ø Kalorien</span>
                  <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 14 }}>{lastWeekSummary.avgKcal} kcal</span>
                </div>
              )}
              {lastWeekSummary.avgDeficit != null && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ø Bilanz</span>
                  <span style={{ fontWeight: 700, color: lastWeekSummary.avgDeficit <= 0 ? "var(--teal)" : "var(--red)", fontSize: 14 }}>
                    {lastWeekSummary.avgDeficit > 0 ? "+" : ""}{lastWeekSummary.avgDeficit} kcal
                  </span>
                </div>
              )}
              {lastWeekSummary.avgSleepW != null && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ø Schlaf</span>
                  <span style={{ fontWeight: 700, color: "var(--purple)", fontSize: 14 }}>{formatMinutes(lastWeekSummary.avgSleepW)}</span>
                </div>
              )}
              {lastWeekSummary.wtDelta != null && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Gewichtstrend</span>
                  <span style={{ fontWeight: 700, color: lastWeekSummary.wtDelta <= 0 ? "var(--teal)" : "var(--red)", fontSize: 14 }}>
                    {lastWeekSummary.wtDelta > 0 ? "+" : ""}{lastWeekSummary.wtDelta} kg
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Benchmarks */}
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div className="section-head-icon">🏆</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Bestleistungen</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>90 Tage</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🔥 Längste Streak</span>
              <span style={{ fontWeight: 700, color: "var(--orange)", fontSize: 14 }}>{benchmarks.longestStreak} Tage</span>
            </div>
            {benchmarks.lowestW && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>⚖️ Niedrigstes Gewicht</span>
                <span style={{ fontWeight: 700, color: "var(--teal)", fontSize: 14 }}>{benchmarks.lowestW.w} kg</span>
              </div>
            )}
            {benchmarks.bestWeek && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>📉 Beste Woche</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700, color: "var(--green)", fontSize: 14 }}>−{benchmarks.bestWeek.avg} kcal/T</span>
                  {benchmarks.bestWeekDate && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>ab {benchmarks.bestWeekDate}</div>}
                </div>
              </div>
            )}
            {streak > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🔥 Aktuelle Streak</span>
                <span style={{ fontWeight: 700, color: streak >= 7 ? "var(--teal)" : "var(--text)", fontSize: 14 }}>{streak} Tage</span>
              </div>
            )}
          </div>
        </div>

        {/* Notizen heute */}
        <div className="card card-pad" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div className="section-head-icon">📝</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notiz heute</span>
            {!noteEditing && (
              <button className="btn btn-xs btn-secondary" style={{ marginLeft: "auto" }} onClick={() => setNoteEditing(true)}>
                {noteText ? "Bearbeiten" : "+ Notiz"}
              </button>
            )}
          </div>
          {noteEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Wie war der Tag? Besonderheiten, Befinden…"
                rows={4}
                style={{ width: "100%", fontSize: 12.5, resize: "vertical", fontFamily: "inherit", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", lineHeight: 1.5, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn btn-xs btn-secondary" onClick={() => setNoteEditing(false)}>Abbrechen</button>
                <button className="btn btn-xs btn-primary" onClick={saveNote} disabled={noteSaving}>
                  {noteSaving ? "…" : "Speichern"}
                </button>
              </div>
            </div>
          ) : noteText ? (
            <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{noteText}</p>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>Noch keine Notiz für heute.</p>
          )}
        </div>
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
                    <td style={{ textAlign: "right", color: (log?.steps ?? 0) >= stepsGoal ? "var(--teal)" : "var(--text)" }}>
                      {log?.steps ? log.steps.toLocaleString("de")
                        : isToday ? <span style={{ color: "var(--text-muted)", fontSize: "0.9em" }}>Ziel: {stepsGoal.toLocaleString("de")}</span>
                        : <span style={{ color: "var(--text-muted)" }}>–</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {log?.sleepActual ? formatMinutes(log.sleepActual)
                        : isToday ? <span style={{ color: "var(--text-muted)", fontSize: "0.9em" }}>Ziel: {formatMinutes(sleepGoalMins)}</span>
                        : <span style={{ color: "var(--text-muted)" }}>–</span>}
                    </td>
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
