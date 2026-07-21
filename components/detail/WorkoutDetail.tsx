"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { RangeSelector, SectionHeader, PageHeader, tickStyle, gridStyle, tooltipStyle } from "@/lib/chartHelpers";
import type { DateRange } from "@/app/page";

type SetData = { id: number; setNumber: number; reps?: number; weight?: number; notes?: string };
type ExData  = { id: number; name: string; order: number; notes?: string; sets: SetData[] };
type Session = {
  id: number; date: string; name: string;
  bodyWeight?: number; energyLevel?: number;
  startTime?: string; endTime?: string; notes?: string;
  exercises: ExData[];
};

const ENERGY_LABELS: Record<number, string> = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "💪" };
const TYPE_COLORS = ["var(--teal)", "var(--blue)", "var(--orange)", "var(--purple)", "var(--green)", "#f472b6", "#94a3b8"];

const MUSCLE_GROUPS = ["Brust", "Rücken", "Schultern", "Arme", "Bauch", "Beine"];
const MG_COLORS: Record<string, string> = {
  "Brust":     "var(--blue)",
  "Rücken":    "var(--teal)",
  "Schultern": "var(--purple)",
  "Arme":      "var(--orange)",
  "Bauch":     "var(--green)",
  "Beine":     "#f472b6",
};

function fmtDate(s: string) {
  return new Date(s.split("T")[0] + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function fmtDateShort(s: string) {
  const d = new Date(s.split("T")[0] + "T12:00:00");
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
}
function calcVolume(sets: SetData[]) {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0);
}
function calcMaxWeight(sets: SetData[]) {
  return Math.max(0, ...sets.map(s => s.weight ?? 0));
}
function durationMin(s: Session) {
  if (!s.startTime || !s.endTime) return null;
  const [sh, sm] = s.startTime.split(":").map(Number);
  const [eh, em] = s.endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export default function WorkoutDetail({
  range, setRange, onNewSession, onEditSession,
}: {
  range: DateRange; setRange: (r: DateRange) => void; onNewSession: () => void; onEditSession: (id: number) => void;
}) {
  const [sessions, setSessions]               = useState<Session[]>([]);
  const [selectedEx, setSelectedEx]           = useState<string | null>(null);
  const [expandedId, setExpandedId]           = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedTypes, setSelectedTypes]     = useState<string[]>([]);
  const [muscleGroups, setMuscleGroups]       = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/workouts?from=${range.from}&to=${range.to}`)
      .then(r => r.json()).then(setSessions).catch(() => {});
  }, [range]);

  useEffect(() => {
    fetch("/api/exercise-muscle-groups")
      .then(r => r.json()).then(setMuscleGroups).catch(() => {});
  }, []);

  const saveMuscleGroup = useCallback(async (exerciseName: string, muscleGroup: string) => {
    setMuscleGroups(prev => ({ ...prev, [exerciseName]: muscleGroup }));
    await fetch("/api/exercise-muscle-groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseName, muscleGroup }),
    });
  }, []);

  async function deleteSession(id: number) {
    await fetch(`/api/workouts?id=${id}`, { method: "DELETE" });
    setSessions(s => s.filter(x => x.id !== id));
    setConfirmDeleteId(null);
  }

  // Session types distribution (always from all sessions for filter chips)
  const typeCount = useMemo(() => {
    const m: Record<string, number> = {};
    sessions.forEach(s => { m[s.name] = (m[s.name] ?? 0) + 1; });
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
  }, [sessions]);

  const filteredSessions = useMemo(
    () => selectedTypes.length > 0 ? sessions.filter(s => selectedTypes.includes(s.name)) : sessions,
    [sessions, selectedTypes]
  );

  // All unique exercise names across filtered sessions
  const allExercises = useMemo(() => {
    const set = new Set<string>();
    filteredSessions.forEach(s => s.exercises.forEach(e => set.add(e.name)));
    return [...set].sort();
  }, [filteredSessions]);

  // Progression data for selected exercise
  const progressionData = useMemo(() => {
    if (!selectedEx) return [];
    return [...filteredSessions].reverse().flatMap(s => {
      const ex = s.exercises.find(e => e.name === selectedEx);
      if (!ex || ex.sets.length === 0) return [];
      const maxW  = calcMaxWeight(ex.sets);
      const vol   = calcVolume(ex.sets);
      const topSet = ex.sets.reduce((best, s) => (s.weight ?? 0) > (best.weight ?? 0) ? s : best, ex.sets[0]);
      return [{
        date:   fmtDateShort(s.date),
        maxW,
        vol:    +vol.toFixed(0),
        topReps: topSet.reps ?? 0,
        setsCount: ex.sets.length,
        session: s.name,
      }];
    });
  }, [filteredSessions, selectedEx]);

  // Volume per session (all exercises)
  const volumePerSession = useMemo(() => [...filteredSessions].reverse().map(s => ({
    date:  fmtDateShort(s.date),
    name:  s.name,
    vol:   +s.exercises.reduce((sum, e) => sum + calcVolume(e.sets), 0).toFixed(0),
    sets:  s.exercises.reduce((sum, e) => sum + e.sets.length, 0),
  })), [filteredSessions]);

  // Muscle group analysis
  const assignedMGs = useMemo(() =>
    MUSCLE_GROUPS.filter(mg => allExercises.some(ex => muscleGroups[ex] === mg)),
    [allExercises, muscleGroups]
  );

  const muscleGroupTotals = useMemo(() => {
    const totals: Record<string, { vol: number; exercises: Set<string>; sessions: number }> = {};
    filteredSessions.forEach(s => {
      const mgsInSession = new Set<string>();
      s.exercises.forEach(ex => {
        const mg = muscleGroups[ex.name];
        if (mg) {
          if (!totals[mg]) totals[mg] = { vol: 0, exercises: new Set(), sessions: 0 };
          totals[mg].vol += calcVolume(ex.sets);
          totals[mg].exercises.add(ex.name);
          mgsInSession.add(mg);
        }
      });
      mgsInSession.forEach(mg => { totals[mg].sessions++; });
    });
    return Object.entries(totals)
      .map(([mg, v]) => ({ mg, vol: +v.vol.toFixed(0), exercises: v.exercises.size, sessions: v.sessions }))
      .sort((a, b) => b.vol - a.vol);
  }, [filteredSessions, muscleGroups]);

  const muscleGroupTimeline = useMemo(() => {
    if (assignedMGs.length === 0) return [];
    return [...filteredSessions].reverse().map(s => {
      const entry: Record<string, number | string> = { date: fmtDateShort(s.date) };
      s.exercises.forEach(ex => {
        const mg = muscleGroups[ex.name];
        if (mg) entry[mg] = ((entry[mg] as number) ?? 0) + calcVolume(ex.sets);
      });
      return entry;
    });
  }, [filteredSessions, muscleGroups, assignedMGs]);

  const tt = tooltipStyle;
  const totalVol = filteredSessions.reduce((sum, s) => sum + s.exercises.reduce((es, e) => es + calcVolume(e.sets), 0), 0);
  const totalSets = filteredSessions.reduce((sum, s) => sum + s.exercises.reduce((es, e) => es + e.sets.length, 0), 0);
  const avgDur = (() => {
    const withDur = filteredSessions.filter(s => durationMin(s) != null);
    if (!withDur.length) return null;
    return Math.round(withDur.reduce((sum, s) => sum + (durationMin(s) ?? 0), 0) / withDur.length);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <PageHeader title="🏋️ Training" sub="Progression & Auswertung" entryCount={sessions.length} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={onNewSession}>+ Neue Session</button>
      </div>

      <div style={{ marginBottom: 4 }}>
        <RangeSelector range={range} setRange={setRange} />
      </div>

      {/* Aufteilung nach Trainingsart – multi-select filter chips at top */}
      {typeCount.length > 1 && (
        <div className="card card-pad">
          <SectionHeader title="Aufteilung nach Trainingsart" icon="🗂️"
            right={selectedTypes.length > 0 ? (
              <button onClick={() => setSelectedTypes([])}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                  background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border2)" }}>
                ✕ Alle anzeigen
              </button>
            ) : undefined}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {typeCount.map((t, i) => {
              const color = TYPE_COLORS[i % TYPE_COLORS.length];
              const active = selectedTypes.includes(t.name);
              return (
                <button key={t.name}
                  onClick={() => setSelectedTypes(prev =>
                    active ? prev.filter(x => x !== t.name) : [...prev, t.name]
                  )}
                  style={{
                    padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 13,
                    background: active ? color : color + "22",
                    color: active ? "#fff" : color,
                    border: `1.5px solid ${color}`,
                    transition: "all .15s",
                  }}>
                  {t.name} · {t.count}×
                </button>
              );
            })}
          </div>
          {selectedTypes.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
              Filter aktiv: {selectedTypes.map((t, i) => (
                <span key={t} style={{ color: "var(--teal)", fontWeight: 700 }}>{i > 0 ? ", " : ""}{t}</span>
              ))} — {filteredSessions.length} Session{filteredSessions.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="card card-pad" style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 40 }}>
          Noch keine Trainings-Sessions im ausgewählten Zeitraum eingetragen.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={onNewSession}>+ Erste Session eintragen</button>
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* KPIs */}
          <div className="card card-pad">
            <SectionHeader title="Übersicht" icon="💪" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Sessions", value: String(filteredSessions.length), sub: selectedTypes.length > 0 ? selectedTypes.join(", ") : "im Zeitraum" },
                { label: "Gesamt Sätze", value: String(totalSets), sub: `Ø ${filteredSessions.length ? Math.round(totalSets / filteredSessions.length) : 0}/Session` },
                { label: "Gesamt Volumen", value: totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)} t` : `${totalVol} kg`, sub: "Sätze × Gewicht × Wdh.", color: "var(--teal)" },
                { label: "Ø Dauer", value: avgDur ? `${avgDur} min` : "–", sub: avgDur ? "pro Session" : "Keine Zeit erfasst" },
              ].map(k => (
                <div key={k.label} className="card card-pad" style={{ textAlign: "center", padding: "14px 10px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color ?? "var(--text)", lineHeight: 1.1 }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Persönliche Rekorde & Progression – unified section */}
          {allExercises.length > 0 && (
            <div className="card card-pad">
              <SectionHeader
                title="Persönliche Rekorde & Progression"
                icon="🏆"
                right={selectedEx ? (
                  <button onClick={() => setSelectedEx(null)}
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                      background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border2)" }}>
                    ✕ Auswahl aufheben
                  </button>
                ) : undefined}
              />

              {/* PR Cards – clickable for exercise selection */}
              <div className="pr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {allExercises.map((exName, i) => {
                  const allSetsForEx = filteredSessions.flatMap(s =>
                    s.exercises.filter(e => e.name === exName).flatMap(e => e.sets)
                  );
                  const prWeight = allSetsForEx.length ? Math.max(0, ...allSetsForEx.map(s => s.weight ?? 0)) : 0;
                  const prSet = allSetsForEx.find(s => (s.weight ?? 0) === prWeight);
                  const sessionCount = filteredSessions.filter(s => s.exercises.some(e => e.name === exName)).length;
                  const color = TYPE_COLORS[i % TYPE_COLORS.length];
                  const isSelected = selectedEx === exName;
                  const mg = muscleGroups[exName];
                  return (
                    <div key={exName}
                      onClick={() => setSelectedEx(prev => prev === exName ? null : exName)}
                      style={{
                        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                        background: isSelected ? color + "22" : "var(--surface2)",
                        border: isSelected ? `2.5px solid ${color}` : `1.5px solid ${color}`,
                        transition: "all .15s",
                        display: "flex", flexDirection: "column",
                      }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{exName}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, flex: 1 }}>
                        {prWeight > 0 ? `${prWeight} kg` : "–"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, marginBottom: 6 }}>
                        {prSet?.reps ? `× ${prSet.reps} Wdh. · ` : ""}{sessionCount} Session{sessionCount !== 1 ? "s" : ""}
                      </div>
                      {/* Muscle group selector */}
                      <select
                        value={mg ?? ""}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); saveMuscleGroup(exName, e.target.value); }}
                        style={{
                          fontSize: 10, background: "var(--surface)", border: "1px solid var(--border2)",
                          borderRadius: 4, color: mg ? MG_COLORS[mg] : "var(--text-muted)",
                          padding: "2px 4px", width: "100%", cursor: "pointer", fontWeight: mg ? 700 : 400,
                        }}>
                        <option value="">Muskelgruppe…</option>
                        {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Inline Progression */}
              {!selectedEx && (
                <div style={{ marginTop: 16, color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                  Übung anklicken für Progression & Analyse
                </div>
              )}

              {selectedEx && progressionData.length < 2 && (
                <div style={{ marginTop: 16, color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
                  Mindestens 2 Sessions mit „{selectedEx}" nötig für Progression.
                </div>
              )}

              {selectedEx && progressionData.length >= 1 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-2)" }}>
                    📈 {selectedEx}
                  </div>
                  {/* KPIs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Letztes Max.", value: `${progressionData.at(-1)?.maxW ?? "–"} kg`, color: "var(--teal)" },
                      { label: "Letztes Volumen", value: `${progressionData.at(-1)?.vol ?? "–"} kg`, color: "var(--orange)" },
                      { label: "Bestes Max.", value: `${Math.max(...progressionData.map(d => d.maxW))} kg`, color: "var(--green)" },
                      { label: "Letzter Top-Satz", value: `${progressionData.at(-1)?.maxW ?? "–"} kg × ${progressionData.at(-1)?.topReps ?? "–"}`, color: "var(--blue)" },
                    ].map(k => (
                      <div key={k.label} className="card card-pad" style={{ padding: "10px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>{k.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  {progressionData.length >= 2 && (
                    <div className="col2-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Maximales Gewicht (kg)</div>
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={progressionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridStyle} />
                            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                            <YAxis tick={tickStyle} unit=" kg" />
                            <Tooltip {...tt} formatter={(v: unknown) => [`${v} kg`, "Max. Gewicht"]} />
                            <Line type="monotone" dataKey="maxW" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--teal)", strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Volumen (kg × Wdh.)</div>
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={progressionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridStyle} />
                            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                            <YAxis tick={tickStyle} unit=" kg" />
                            <Tooltip {...tt} formatter={(v: unknown) => [`${v} kg`, "Volumen"]} />
                            <Line type="monotone" dataKey="vol" stroke="var(--orange)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--orange)", strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Muskelgruppen-Analyse */}
          {assignedMGs.length > 0 && (
            <div className="card card-pad">
              <SectionHeader title="Muskelgruppen-Analyse" icon="🧬" />

              {/* Totals per muscle group */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
                {muscleGroupTotals.map(({ mg, vol, exercises, sessions: sc }) => (
                  <div key={mg} className="card card-pad" style={{ padding: "12px 14px", borderLeft: `3px solid ${MG_COLORS[mg]}` }}>
                    <div style={{ fontSize: 11, color: MG_COLORS[mg], fontWeight: 700, marginBottom: 4 }}>{mg}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                      {vol >= 1000 ? `${(vol/1000).toFixed(1)} t` : `${vol} kg`}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>
                      {exercises} Übg. · {sc} Sessions
                    </div>
                  </div>
                ))}
              </div>

              {/* Stacked volume timeline by muscle group */}
              {muscleGroupTimeline.length >= 2 && (
                <>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                    Volumen pro Session nach Muskelgruppe
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={muscleGroupTimeline} margin={{ top: 4, right: 10, left: 5, bottom: 0 }}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                      <YAxis tick={tickStyle} unit=" kg" width={52} />
                      <Tooltip {...tt} formatter={(v: unknown, name: unknown) => [`${v} kg`, String(name)]} />
                      {assignedMGs.map(mg => (
                        <Bar key={mg} dataKey={mg} stackId="a" fill={MG_COLORS[mg]} fillOpacity={0.85} maxBarSize={36}
                          radius={mg === assignedMGs[assignedMGs.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Volume per muscle group – simple bars */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                      Gesamtvolumen nach Muskelgruppe
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(120, muscleGroupTotals.length * 36)}>
                      <BarChart data={muscleGroupTotals} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                        <CartesianGrid {...gridStyle} horizontal={false} />
                        <XAxis type="number" tick={tickStyle} tickLine={false} unit=" kg" />
                        <YAxis type="category" dataKey="mg" tick={tickStyle} width={80} />
                        <Tooltip {...tt} formatter={(v: unknown) => [`${v} kg`, "Volumen"]} />
                        <Bar dataKey="vol" maxBarSize={22} radius={[0, 4, 4, 0]}>
                          {muscleGroupTotals.map(({ mg }) => (
                            <Cell key={mg} fill={MG_COLORS[mg]} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* List of exercises per muscle group */}
              <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
                {assignedMGs.map(mg => {
                  const exs = allExercises.filter(ex => muscleGroups[ex] === mg);
                  return (
                    <div key={mg} style={{ minWidth: 140 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: MG_COLORS[mg], marginBottom: 4 }}>{mg}</div>
                      {exs.map(ex => (
                        <div key={ex} style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 8 }}>· {ex}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gesamtvolumen je Session */}
          {volumePerSession.length >= 2 && (
            <div className="card card-pad">
              <SectionHeader title="Volumen pro Session" icon="🏗️" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={volumePerSession} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                  <YAxis tick={tickStyle} unit=" kg" width={52} />
                  <Tooltip {...tt} formatter={(v: unknown) => [`${v} kg`, "Volumen"]} />
                  <Bar dataKey="vol" fill="var(--teal)" fillOpacity={0.8} maxBarSize={32} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session Liste */}
          <div className="card">
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
              📋 {selectedTypes.length > 0 ? `${selectedTypes.join(" + ")} Sessions` : "Alle Sessions"}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredSessions.map(s => {
                const vol     = s.exercises.reduce((sum, e) => sum + calcVolume(e.sets), 0);
                const sets    = s.exercises.reduce((sum, e) => sum + e.sets.length, 0);
                const dur     = durationMin(s);
                const open    = expandedId === s.id;
                return (
                  <div key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {/* Row header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
                      onClick={() => setExpandedId(open ? null : s.id)}
                      onDoubleClick={() => onEditSession(s.id)}
                      title="Doppelklick zum Bearbeiten">
                      <span style={{ fontSize: 11, transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .2s", color: "var(--text-muted)" }}>▶</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                          {s.name}
                          {s.energyLevel && <span style={{ marginLeft: 8, fontSize: 15 }}>{ENERGY_LABELS[s.energyLevel]}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {fmtDate(s.date)}
                          {dur ? ` · ${dur} min` : ""}
                          {s.bodyWeight ? ` · ${s.bodyWeight} kg KG` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 14, textAlign: "right", flexShrink: 0 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{vol >= 1000 ? `${(vol/1000).toFixed(1)}t` : `${vol.toFixed(0)} kg`}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Volumen</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.exercises.length} Übg.</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sets} Sätze</div>
                        </div>
                      </div>
                      {/* Edit / Delete actions */}
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {confirmDeleteId === s.id ? (
                          <>
                            <span style={{ fontSize: 11, color: "var(--red)" }}>Löschen?</span>
                            <button onClick={() => deleteSession(s.id)}
                              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--red)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}>Ja</button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border2)", cursor: "pointer" }}>Nein</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => onEditSession(s.id)}
                              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--surface2)", color: "var(--teal)", border: "1px solid var(--teal)", cursor: "pointer", fontWeight: 600 }}>✏️ Bearbeiten</button>
                            <button onClick={() => setConfirmDeleteId(s.id)}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--surface2)", color: "var(--red)", border: "1px solid var(--red)", cursor: "pointer" }}>🗑</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {open && (
                      <div style={{ padding: "0 16px 14px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
                        {s.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>"{s.notes}"</div>}
                        {s.exercises.map((ex, ei) => (
                          <div key={ex.id}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: TYPE_COLORS[ei % TYPE_COLORS.length], marginBottom: 6 }}>
                              {ei + 1}. {ex.name}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr", gap: 4 }}>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>#</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>Wdh.</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>Gewicht</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>Notiz</span>
                              {ex.sets.map(set => (
                                <>
                                  <span key={`${set.id}-n`} style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{set.setNumber}</span>
                                  <span key={`${set.id}-r`} style={{ fontSize: 12 }}>{set.reps ?? "–"}</span>
                                  <span key={`${set.id}-w`} style={{ fontSize: 12 }}>{set.weight != null ? `${set.weight} kg` : "–"}</span>
                                  <span key={`${set.id}-note`} style={{ fontSize: 11, color: "var(--text-muted)" }}>{set.notes ?? ""}</span>
                                </>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
