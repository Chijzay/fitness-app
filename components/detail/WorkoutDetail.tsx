"use client";
import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
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
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [selectedEx, setSelectedEx]     = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/workouts?from=${range.from}&to=${range.to}`)
      .then(r => r.json()).then(setSessions).catch(() => {});
  }, [range]);

  async function deleteSession(id: number) {
    await fetch(`/api/workouts?id=${id}`, { method: "DELETE" });
    setSessions(s => s.filter(x => x.id !== id));
    setConfirmDeleteId(null);
  }

  // All unique exercise names across sessions
  const allExercises = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => s.exercises.forEach(e => set.add(e.name)));
    return [...set].sort();
  }, [sessions]);

  // Auto-select first exercise when list loads
  useEffect(() => {
    if (!selectedEx && allExercises.length > 0) setSelectedEx(allExercises[0]);
  }, [allExercises, selectedEx]);

  // Progression data for selected exercise
  const progressionData = useMemo(() => {
    if (!selectedEx) return [];
    return [...sessions].reverse().flatMap(s => {
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
  }, [sessions, selectedEx]);

  // Volume per session (all exercises)
  const volumePerSession = useMemo(() => [...sessions].reverse().map(s => ({
    date:  fmtDateShort(s.date),
    name:  s.name,
    vol:   +s.exercises.reduce((sum, e) => sum + calcVolume(e.sets), 0).toFixed(0),
    sets:  s.exercises.reduce((sum, e) => sum + e.sets.length, 0),
  })), [sessions]);

  // Session types distribution
  const typeCount = useMemo(() => {
    const m: Record<string, number> = {};
    sessions.forEach(s => { m[s.name] = (m[s.name] ?? 0) + 1; });
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
  }, [sessions]);

  const tt = tooltipStyle;
  const totalVol = sessions.reduce((sum, s) => sum + s.exercises.reduce((es, e) => es + calcVolume(e.sets), 0), 0);
  const totalSets = sessions.reduce((sum, s) => sum + s.exercises.reduce((es, e) => es + e.sets.length, 0), 0);
  const avgDur = (() => {
    const withDur = sessions.filter(s => durationMin(s) != null);
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
                { label: "Sessions", value: String(sessions.length), sub: "im Zeitraum" },
                { label: "Gesamt Sätze", value: String(totalSets), sub: `Ø ${Math.round(totalSets / sessions.length)}/Session` },
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

          {/* Personal Records */}
          {allExercises.length > 0 && (
            <div className="card card-pad">
              <SectionHeader title="Persönliche Rekorde" icon="🏆" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {allExercises.map((exName, i) => {
                  const allSetsForEx = sessions.flatMap(s =>
                    s.exercises.filter(e => e.name === exName).flatMap(e => e.sets)
                  );
                  const prWeight = allSetsForEx.length ? Math.max(0, ...allSetsForEx.map(s => s.weight ?? 0)) : 0;
                  const prSet = allSetsForEx.find(s => (s.weight ?? 0) === prWeight);
                  const sessionCount = sessions.filter(s => s.exercises.some(e => e.name === exName)).length;
                  const color = TYPE_COLORS[i % TYPE_COLORS.length];
                  return (
                    <div key={exName} style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: `1px solid ${color}33` }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{exName}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>
                        {prWeight > 0 ? `${prWeight} kg` : "–"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        {prSet?.reps ? `× ${prSet.reps} Wdh.` : ""}
                        {prSet?.reps ? " · " : ""}
                        {sessionCount} Session{sessionCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progression per exercise */}
          {allExercises.length > 0 && (
            <div className="card card-pad">
              <SectionHeader title="Übungs-Progression" icon="📈" />
              {/* Exercise selector */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {allExercises.map((ex, i) => (
                  <button key={ex} onClick={() => setSelectedEx(ex)}
                    style={{
                      fontSize: 11.5, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                      background: selectedEx === ex ? TYPE_COLORS[i % TYPE_COLORS.length] + "22" : "var(--surface2)",
                      color:      selectedEx === ex ? TYPE_COLORS[i % TYPE_COLORS.length] : "var(--text-muted)",
                      border:     `1px solid ${selectedEx === ex ? TYPE_COLORS[i % TYPE_COLORS.length] : "var(--border2)"}`,
                    }}>{ex}</button>
                ))}
              </div>

              {progressionData.length < 2 && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>Mindestens 2 Sessions mit dieser Übung nötig für Progression.</div>
              )}

              {progressionData.length >= 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Max Gewicht */}
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

                  {/* Volumen */}
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

              {/* Progression table: last vs best vs current */}
              {progressionData.length >= 1 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
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
                </div>
              )}
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

          {/* Aufteilung nach Trainingsart */}
          {typeCount.length > 1 && (
            <div className="card card-pad">
              <SectionHeader title="Aufteilung nach Trainingsart" icon="🗂️" />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {typeCount.map((t, i) => (
                  <div key={t.name} style={{ padding: "8px 16px", borderRadius: 20, background: TYPE_COLORS[i % TYPE_COLORS.length] + "22", color: TYPE_COLORS[i % TYPE_COLORS.length], fontSize: 13, fontWeight: 700 }}>
                    {t.name} · {t.count}×
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Liste */}
          <div className="card">
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
              📋 Alle Sessions
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sessions.map(s => {
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
