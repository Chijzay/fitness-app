"use client";
import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, BarChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart, Bar, Cell } from "recharts";
import type { DailyLog, DateRange, Profile } from "@/app/page";
import { allDatesInRange, fmtShort, fmtFull, tickStyle, gridStyle, tooltipStyle, RangeSelector, KpiCard, SectionHeader, PageHeader } from "@/lib/chartHelpers";
import { calcBMR, calcTDEE, calcMaxDeficit, estimateBodyFat } from "@/lib/calculations";

type Goal = { id: number; type: string; targetValue: number; targetDate?: string; notes?: string };
type Phase = { id: number; name: string; startDate: string; endDate?: string | null; notes?: string | null };

export default function DietProgress({ allLogs, profile, range, setRange, onEditDate }: {
  allLogs: DailyLog[]; profile: Profile; range: DateRange; setRange: (r: DateRange) => void;
  onEditDate?: (date: string) => void;
}) {
  const [weightGoal, setWeightGoal] = useState<Goal | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [showNewPhase, setShowNewPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDate, setNewPhaseDate] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; });
  const [savingPhase, setSavingPhase] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/goals").then(r => r.json()),
      fetch("/api/phases").then(r => r.json()),
    ]).then(([goals, ph]: [Goal[], Phase[]]) => {
      setWeightGoal(goals.find(g => g.type === "weight") ?? null);
      setPhases(ph);
      // Auto-select most recent phase if any
      if (ph.length > 0 && selectedPhaseId === null) setSelectedPhaseId(ph[0].id);
      setGoalsLoading(false);
    }).catch(() => setGoalsLoading(false));
  }, []);

  async function createPhase() {
    if (!newPhaseDate) return;
    setSavingPhase(true);
    const name = newPhaseName.trim() || `Phase ${phases.length + 1}`;
    const res = await fetch("/api/phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate: newPhaseDate }),
    });
    const ph = await res.json();
    setPhases(prev => [ph, ...prev]);
    setSelectedPhaseId(ph.id);
    setShowNewPhase(false);
    setNewPhaseName("");
    const nd = new Date(); setNewPhaseDate(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,"0")}-${String(nd.getDate()).padStart(2,"0")}`);
    setSavingPhase(false);
  }

  async function renamePhase(id: number, name: string) {
    await fetch("/api/phases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    setPhases(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setEditingPhaseId(null);
  }

  async function deletePhase(id: number) {
    await fetch(`/api/phases?id=${id}`, { method: "DELETE" });
    setPhases(prev => prev.filter(p => p.id !== id));
    if (selectedPhaseId === id) setSelectedPhaseId(phases.find(p => p.id !== id)?.id ?? null);
  }

  // Filter logs by selected phase start date
  const selectedPhase = phases.find(p => p.id === selectedPhaseId) ?? null;
  const phaseStart = selectedPhase ? selectedPhase.startDate.split("T")[0] : null;

  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    allLogs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [allLogs]);

  const weightLogs = useMemo(() => {
    const logs = allLogs.filter(l => l.weight).sort((a, b) => a.date.localeCompare(b.date));
    if (!phaseStart) return logs;
    return logs.filter(l => l.date.split("T")[0] >= phaseStart);
  }, [allLogs, phaseStart]);

  const phaseLogs = useMemo(() => {
    if (!phaseStart) return allLogs;
    return allLogs.filter(l => l.date.split("T")[0] >= phaseStart);
  }, [allLogs, phaseStart]);

  const startLog = weightLogs[0];
  const latestLog = [...weightLogs].reverse()[0];
  const startWeight = startLog?.weight ?? null;
  const currentWeight = latestLog?.weight ?? null;
  const goalWeight = weightGoal?.targetValue ?? null;

  const totalToLose = startWeight && goalWeight ? +(startWeight - goalWeight).toFixed(1) : null;
  const alreadyLost = startWeight && currentWeight ? +(startWeight - currentWeight).toFixed(1) : null;
  const stillToGo = currentWeight && goalWeight ? +(currentWeight - goalWeight).toFixed(1) : null;
  const progressPct = totalToLose && alreadyLost && totalToLose > 0
    ? Math.max(0, Math.min(100, Math.round(alreadyLost / totalToLose * 100)))
    : null;

  const withIdx = weightLogs.map((l, i) => ({ i, w: l.weight ?? 0 }));
  let weeklyTrend = 0;
  if (withIdx.length >= 2) {
    const n = withIdx.length;
    const sumX = withIdx.reduce((s, d) => s + d.i, 0);
    const sumY = withIdx.reduce((s, d) => s + d.w, 0);
    const sumXY = withIdx.reduce((s, d) => s + d.i * d.w, 0);
    const sumX2 = withIdx.reduce((s, d) => s + d.i * d.i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    weeklyTrend = +(slope * 7).toFixed(2);
  }

  let estimatedDate: string | null = null;
  let estimatedWeeks: number | null = null;
  if (currentWeight && goalWeight && weeklyTrend < 0 && currentWeight > goalWeight) {
    estimatedWeeks = Math.ceil((currentWeight - goalWeight) / Math.abs(weeklyTrend));
    const d = new Date();
    d.setDate(d.getDate() + estimatedWeeks * 7);
    estimatedDate = d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  const kcalLogs = phaseLogs.filter(l => l.kcalConsumed);
  // avgDeficit must be computed before estimated date fallback, so we compute it early
  const avgDeficitEarly = (() => {
    if (!kcalLogs.length) return null;
    let total = 0; let count = 0;
    kcalLogs.forEach(l => {
      const w = l.weight ?? currentWeight ?? null;
      if (!w) return;
      const bmr = l.bmrOverride ?? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate));
      const tdee = Math.round(calcTDEE(bmr, profile.activityLevel));
      total += l.kcalConsumed! - tdee - (l.kcalBurned ?? 0);
      count++;
    });
    return count ? Math.round(total / count) : null;
  })();

  // Calorie-based fallback when weight data is insufficient for trend
  if (!estimatedDate && currentWeight && goalWeight && currentWeight > goalWeight && avgDeficitEarly && avgDeficitEarly < 0) {
    const kgPerWeek = (Math.abs(avgDeficitEarly) * 7) / 7700;
    estimatedWeeks = Math.ceil((currentWeight - goalWeight) / kgPerWeek);
    const d = new Date();
    d.setDate(d.getDate() + estimatedWeeks * 7);
    estimatedDate = d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  const avgDeficit = avgDeficitEarly;

  const latestBF = latestLog?.bodyFatPercent
    ?? (currentWeight ? estimateBodyFat(currentWeight, profile.height, profile.gender, new Date(profile.birthdate)) : null);
  const maxDef = currentWeight && latestBF ? calcMaxDeficit(currentWeight, latestBF) : null;

  const dates = useMemo(() => allDatesInRange(range), [range]);
  const chartData = dates.map(d => ({
    date: fmtShort(d), raw: d,
    weight: logMap[d]?.weight ?? null,
    goal: goalWeight,
  }));

  const weeklyMap: Record<string, { weights: number[] }> = {};
  weightLogs.forEach(l => {
    const d = l.date.split("T")[0];
    const dt = new Date(d + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = `KW ${mon.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    if (!weeklyMap[key]) weeklyMap[key] = { weights: [] };
    weeklyMap[key].weights.push(l.weight ?? 0);
  });
  const weeklyChanges = Object.entries(weeklyMap)
    .map(([week, { weights }]) => ({
      week,
      change: weights.length >= 2 ? +(weights[weights.length - 1] - weights[0]).toFixed(1) : null,
      avg: +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1),
    }))
    .filter(w => w.change !== null);

  const kcalData = dates.map(d => {
    const log = logMap[d];
    if (!log?.kcalConsumed) return { date: fmtShort(d), raw: d, deficit: null };
    const w = log.weight ?? currentWeight ?? null;
    const bmr = log.bmrOverride ?? (w ? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate)) : null);
    const tdee = bmr ? Math.round(calcTDEE(bmr, profile.activityLevel)) : null;
    const deficit = tdee != null ? log.kcalConsumed - tdee - (log.kcalBurned ?? 0) : null;
    return { date: fmtShort(d), raw: d, deficit };
  });

  const tt = tooltipStyle;

  if (goalsLoading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Lade…</div>;

  return (
    <div>
      <PageHeader
        title="Diätverlauf"
        sub={`${weightLogs.length} Gewichtsmessungen${selectedPhase ? ` in „${selectedPhase.name}"` : " gesamt"}`}
        right={<RangeSelector range={range} setRange={setRange} />}
      />

      {/* ── Phasen-Manager ─────────────────────────────────────────── */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            📊 Phasen
          </span>

          {/* "Alle" pill */}
          <button onClick={() => setSelectedPhaseId(null)} style={{
            padding: "4px 14px", borderRadius: 99, border: "1px solid",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: selectedPhaseId === null ? "var(--teal-dim)" : "transparent",
            color: selectedPhaseId === null ? "var(--teal)" : "var(--text-muted)",
            borderColor: selectedPhaseId === null ? "var(--teal)" : "var(--border)",
          }}>Alle</button>

          {/* Phase pills */}
          {phases.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {editingPhaseId === p.id ? (
                <input
                  value={editingPhaseName}
                  onChange={e => setEditingPhaseName(e.target.value)}
                  onBlur={() => renamePhase(p.id, editingPhaseName || p.name)}
                  onKeyDown={e => { if (e.key === "Enter") renamePhase(p.id, editingPhaseName || p.name); if (e.key === "Escape") setEditingPhaseId(null); }}
                  autoFocus
                  style={{ width: 120, fontSize: 12, padding: "3px 8px" }}
                />
              ) : (
                <button onClick={() => setSelectedPhaseId(p.id)} style={{
                  padding: "4px 12px", borderRadius: 99, border: "1px solid",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: selectedPhaseId === p.id ? "var(--blue-dim, var(--teal-dim))" : "transparent",
                  color: selectedPhaseId === p.id ? "var(--blue, var(--teal))" : "var(--text-muted)",
                  borderColor: selectedPhaseId === p.id ? "var(--blue, var(--teal))" : "var(--border)",
                }}>
                  {p.name}
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                    {new Date(p.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </span>
                </button>
              )}
              {selectedPhaseId === p.id && editingPhaseId !== p.id && (
                <>
                  <button onClick={() => { setEditingPhaseId(p.id); setEditingPhaseName(p.name); }}
                    title="Umbenennen"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: "2px 3px" }}>✏️</button>
                  <button onClick={() => { if (confirm(`Phase „${p.name}" wirklich löschen?`)) deletePhase(p.id); }}
                    title="Löschen"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--red)", padding: "2px 3px" }}>🗑</button>
                </>
              )}
            </div>
          ))}

          {/* Neue Phase Button / Form */}
          {!showNewPhase ? (
            <button onClick={() => setShowNewPhase(true)} style={{
              padding: "4px 12px", borderRadius: 99, border: "1px dashed var(--border)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--teal)",
              background: "transparent",
            }}>+ Neue Phase</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 4, padding: "8px 12px", background: "var(--surface2)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <input
                value={newPhaseName}
                onChange={e => setNewPhaseName(e.target.value)}
                placeholder={`Phase ${phases.length + 1}`}
                style={{ width: 130, fontSize: 12, padding: "4px 8px" }}
              />
              <input
                type="date"
                value={newPhaseDate}
                onChange={e => setNewPhaseDate(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px" }}
              />
              <button className="btn btn-sm btn-primary" onClick={createPhase} disabled={savingPhase}>
                {savingPhase ? "…" : "Erstellen"}
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowNewPhase(false)}>Abbrechen</button>
            </div>
          )}
        </div>

        {selectedPhase && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span>Start: <strong style={{ color: "var(--text-2)" }}>{new Date(selectedPhase.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</strong></span>
            {startWeight && <span style={{ marginLeft: 16 }}>Startgewicht: <strong style={{ color: "var(--text-2)" }}>{startWeight} kg</strong></span>}
          </div>
        )}
      </div>

      {/* Kein Ziel gesetzt */}
      {!weightGoal && (
        <div className="card card-pad card-accent" style={{ marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Setze ein Zielgewicht unter „Ziele" für den vollständigen Fortschrittsbalken.</p>
        </div>
      )}

      {/* Großer Fortschrittsbalken */}
      {startWeight && currentWeight && goalWeight && (
        <div className="card card-pad card-accent" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Start</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-2)" }}>{startWeight} kg</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{startLog && fmtFull(startLog.date.split("T")[0])}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Aktuell</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--teal)" }}>{currentWeight} kg</div>
              {alreadyLost !== null && alreadyLost !== 0 && (
                <div style={{ fontSize: 12, color: alreadyLost > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {alreadyLost > 0 ? "▼" : "▲"} {Math.abs(alreadyLost)} kg abgenommen
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Ziel</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{goalWeight} kg</div>
              {weightGoal?.targetDate && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>bis {new Date(weightGoal.targetDate).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</div>
              )}
            </div>
          </div>
          <div style={{ position: "relative", height: 12, background: "var(--surface2)", borderRadius: 99, overflow: "hidden", margin: "12px 0" }}>
            <div style={{ height: "100%", width: `${progressPct ?? 0}%`, background: "linear-gradient(90deg, var(--teal), var(--green))", borderRadius: 99, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
            <span>{progressPct ?? 0}% erreicht</span>
            {stillToGo !== null && stillToGo > 0 && <span>Noch {stillToGo.toFixed(1)} kg bis zum Ziel</span>}
            {stillToGo !== null && stillToGo <= 0 && <span style={{ color: "var(--green)", fontWeight: 700 }}>🎉 Ziel erreicht!</span>}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="📉" label="Trend / Woche"
          value={weeklyTrend !== 0 ? `${weeklyTrend > 0 ? "+" : ""}${weeklyTrend} kg` : "–"}
          sub="Lineare Regression"
          color={weeklyTrend < 0 ? "var(--green)" : weeklyTrend > 0 ? "var(--red)" : undefined} />
        <KpiCard icon="📅" label="Geschätztes Datum"
          value={estimatedDate ?? (weeklyTrend >= 0 ? "Kein Defizit" : "–")}
          sub={estimatedWeeks ? `in ca. ${estimatedWeeks} Wochen` : undefined}
          color={estimatedDate ? "var(--teal)" : "var(--text-muted)"} />
        <KpiCard icon="🔥" label="Ø Kaloriendefizit"
          value={avgDeficit != null ? `${avgDeficit > 0 ? "+" : ""}${avgDeficit} kcal` : "–"}
          sub="Tagesdurchschnitt (alle Einträge)"
          color={avgDeficit != null ? (avgDeficit < 0 ? "var(--green)" : "var(--red)") : undefined} />
        <KpiCard icon="⚠️" label="Max. Defizit/Tag"
          value={maxDef ? `${maxDef} kcal` : "–"}
          sub="Körperfett (kg) × 70"
          color={avgDeficit && maxDef && Math.abs(avgDeficit) > maxDef ? "var(--red)" : "var(--orange)"} />
      </div>

      {/* Gewichtsverlauf Chart */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <SectionHeader title="Gewichtsverlauf mit Ziel" icon="📈" />
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={tickStyle} width={50} unit=" kg" />
            <Tooltip {...tt} formatter={(v: number, name: string) => [`${v} kg`, name === "weight" ? "Gewicht" : "Ziel"]} />
            {goalWeight && <ReferenceLine y={goalWeight} stroke="var(--green)" strokeDasharray="5 3" strokeWidth={2}
              label={{ value: `Ziel: ${goalWeight} kg`, fontSize: 11, fill: "var(--green)", position: "right" }} />}
            {startWeight && selectedPhase && <ReferenceLine y={startWeight} stroke="var(--text-muted)" strokeDasharray="3 3" strokeWidth={1}
              label={{ value: `Start: ${startWeight} kg`, fontSize: 10, fill: "var(--text-muted)", position: "right" }} />}
            <Area type="monotone" dataKey="weight" stroke="var(--teal)" strokeWidth={2.5} fill="url(#weightGrad)"
              dot={{ r: 4, fill: "var(--teal)", strokeWidth: 0 }} connectNulls activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Kaloriendefizit Chart */}
        <div className="card card-pad">
          <SectionHeader title="Tägliche Kalorienbilanz" icon="🔥" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={kcalData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
              <YAxis tick={tickStyle} width={55} />
              <Tooltip {...tt} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v} kcal`, "Bilanz"]} />
              <ReferenceLine y={0} stroke="var(--border2)" strokeWidth={1.5} />
              {maxDef && <ReferenceLine y={-maxDef} stroke="var(--orange)" strokeDasharray="4 3"
                label={{ value: "Max.", fontSize: 10, fill: "var(--orange)", position: "right" }} />}
              <Bar dataKey="deficit" radius={[4, 4, 0, 0]} maxBarSize={35}>
                {kcalData.map((d, i) => <Cell key={i} fill={(d.deficit ?? 0) <= 0 ? "var(--green)" : "var(--red)"} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Wöchentliche Veränderung */}
        <div className="card card-pad">
          <SectionHeader title="Wöchentliche Veränderung" icon="📅" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 220 }}>
            {weeklyChanges.length > 0 ? weeklyChanges.map(w => (
              <div key={w.week} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "var(--surface2)", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{w.week}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ø {w.avg} kg</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: (w.change ?? 0) < 0 ? "var(--green)" : (w.change ?? 0) > 0 ? "var(--red)" : "var(--text-muted)" }}>
                    {(w.change ?? 0) > 0 ? "+" : ""}{w.change} kg
                  </span>
                </div>
              </div>
            )) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Noch zu wenig Daten für Wochenauswertung (mind. 2 Messungen pro Woche)</p>
            )}
          </div>
        </div>
      </div>

      {/* Alle Gewichtsmessungen Tabelle */}
      {weightLogs.length > 0 && (
        <div className="card">
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Alle Gewichtsmessungen{selectedPhase ? ` — ${selectedPhase.name}` : ""}</span>
            {onEditDate && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Doppelklick auf Zeile zum Bearbeiten</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th style={{ textAlign: "right" }}>Gewicht (kg)</th>
                  <th style={{ textAlign: "right" }}>Diff. zum Vortag</th>
                  <th style={{ textAlign: "right" }}>Zum Ziel</th>
                  <th style={{ textAlign: "right" }}>Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {weightLogs.map((l, i) => {
                  const prev = weightLogs[i - 1]?.weight ?? null;
                  const diff = prev != null && l.weight ? +(l.weight - prev).toFixed(1) : null;
                  const toGoal = l.weight && goalWeight ? +(l.weight - goalWeight).toFixed(1) : null;
                  const pct = startWeight && l.weight && goalWeight && startWeight !== goalWeight
                    ? Math.max(0, Math.min(100, Math.round((startWeight - l.weight) / (startWeight - goalWeight) * 100)))
                    : null;
                  const raw = l.date.split("T")[0];
                  return (
                    <tr key={l.id} onDoubleClick={() => onEditDate?.(raw)}
                      style={{ cursor: onEditDate ? "pointer" : undefined }}
                      title={onEditDate ? "Doppelklick zum Bearbeiten" : undefined}>
                      <td style={{ color: "var(--text-2)" }}>{fmtFull(raw)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{l.weight} kg</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: diff == null ? "var(--text-muted)" : diff < 0 ? "var(--green)" : diff > 0 ? "var(--red)" : "var(--text-muted)" }}>
                        {diff != null ? `${diff > 0 ? "+" : ""}${diff} kg` : "–"}
                      </td>
                      <td style={{ textAlign: "right", color: toGoal != null ? (toGoal <= 0 ? "var(--green)" : "var(--text-2)") : "var(--text-muted)" }}>
                        {toGoal != null ? (toGoal <= 0 ? "✓ Ziel!" : `${toGoal} kg`) : "–"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {pct != null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                            <div style={{ width: 60, height: 5, background: "var(--surface2)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "var(--green)" : "var(--teal)", borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28 }}>{pct}%</span>
                          </div>
                        ) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
