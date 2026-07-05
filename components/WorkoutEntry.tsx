"use client";
import { useEffect, useState, useRef } from "react";

type SetRow    = { setNumber: number; reps: string; weight: string; notes: string };
type ExerciseRow = { localId: number; name: string; sets: SetRow[]; notes: string };

const WORKOUT_TYPES = ["Pull", "Push", "Leg", "Ganzkörper", "Oberkörper", "Unterkörper", "Rumpf", "Sonstiges"];
const ENERGY_LABELS: Record<number, string> = { 1: "😩 Sehr schlecht", 2: "😕 Schlecht", 3: "😐 Ok", 4: "🙂 Gut", 5: "💪 Top" };

let _lid = 0;
function newEx(name = ""): ExerciseRow {
  return { localId: ++_lid, name, sets: [{ setNumber: 1, reps: "", weight: "", notes: "" }], notes: "" };
}

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function Autocomplete({ value, onChange, suggestions }: { value: string; onChange: (v: string) => void; suggestions: string[] }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Übungsname…" style={{ width: "100%" }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)", maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(s => (
            <div key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "var(--text-2)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkoutEntry({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [date, setDate]           = useState(todayStr);
  const [name, setName]           = useState("Pull");
  const [customName, setCustomName] = useState("");
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime]     = useState("");
  const [notes, setNotes]         = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([newEx()]);
  const [saving, setSaving]       = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastSession, setLastSession] = useState<Record<string, { weight: number; reps: number }[]>>({});

  useEffect(() => {
    fetch("/api/workouts?exercises=1").then(r => r.json()).then(setSuggestions).catch(() => {});
    fetch("/api/logs?from=2020-01-01&to=" + todayStr())
      .then(r => r.json())
      .then((logs: { weight?: number }[]) => {
        const last = [...logs].reverse().find(l => l.weight);
        if (last?.weight) setLatestWeight(last.weight);
      }).catch(() => {});
  }, []);

  // Load last session of same type for carry-forward preview
  useEffect(() => {
    const n = name === "Sonstiges" ? customName : name;
    if (!n) return;
    fetch(`/api/workouts?from=2020-01-01&to=${date}`)
      .then(r => r.json())
      .then((sessions: { name: string; date: string; exercises: { name: string; sets: { reps?: number; weight?: number }[] }[] }[]) => {
        const prev = sessions.filter(s => s.name === n && s.date.split("T")[0] < date).at(0);
        if (!prev) { setLastSession({}); return; }
        const map: Record<string, { weight: number; reps: number }[]> = {};
        prev.exercises.forEach(ex => {
          map[ex.name] = ex.sets.map(s => ({ weight: s.weight ?? 0, reps: s.reps ?? 0 }));
        });
        setLastSession(map);
      }).catch(() => {});
  }, [name, customName, date]);

  function updateEx(lid: number, key: keyof ExerciseRow, val: string) {
    setExercises(es => es.map(e => e.localId === lid ? { ...e, [key]: val } : e));
  }
  function updateSet(lid: number, si: number, key: keyof SetRow, val: string) {
    setExercises(es => es.map(e => e.localId === lid
      ? { ...e, sets: e.sets.map((s, i) => i === si ? { ...s, [key]: val } : s) }
      : e));
  }
  function addSet(lid: number) {
    setExercises(es => es.map(e => e.localId === lid
      ? { ...e, sets: [...e.sets, { setNumber: e.sets.length + 1, reps: "", weight: "", notes: "" }] }
      : e));
  }
  function removeSet(lid: number, si: number) {
    setExercises(es => es.map(e => e.localId === lid
      ? { ...e, sets: e.sets.filter((_, i) => i !== si).map((s, i) => ({ ...s, setNumber: i + 1 })) }
      : e));
  }

  async function save() {
    const sessionName = name === "Sonstiges" ? customName : name;
    if (!sessionName) return;
    setSaving(true);
    await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, name: sessionName,
        bodyWeight: latestWeight ?? undefined,
        energyLevel,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        notes: notes || undefined,
        exercises: exercises.filter(e => e.name.trim()).map((e, i) => ({
          name: e.name.trim(), order: i, notes: e.notes || undefined,
          sets: e.sets.map(s => ({
            setNumber: s.setNumber,
            reps:   s.reps   ? Number(s.reps)   : undefined,
            weight: s.weight ? Number(s.weight) : undefined,
            notes:  s.notes  || undefined,
          })),
        })),
      }),
    });
    setSaving(false);
    onSaved();
  }

  const sessionName = name === "Sonstiges" ? customName : name;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>🏋️ Training</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Übungen, Sätze, Gewichte erfassen</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn-sm btn-secondary" style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
            onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(d.toISOString().split("T")[0]); }}>‹</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 148 }} />
          <button className="btn btn-sm btn-secondary" style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
            onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]); }}>›</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-secondary" onClick={onCancel}>← Zurück</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !sessionName}>
          {saving ? "Speichern…" : "✓ Speichern"}
        </button>
      </div>

      {/* Session-Infos */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label className="lbl">Trainingsart</label>
            <select value={name} onChange={e => setName(e.target.value)}>
              {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {name === "Sonstiges" && (
            <div>
              <label className="lbl">Name</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="z.B. Pull A" />
            </div>
          )}
          <div>
            <label className="lbl">Körpergewicht</label>
            <div style={{ padding: "8px 12px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border2)", fontSize: 14, fontWeight: 700, color: latestWeight ? "var(--teal)" : "var(--text-muted)" }}>
              {latestWeight ? `${latestWeight} kg` : "Kein Eintrag"}
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>aus Tageseintrag</span>
            </div>
          </div>
          <div>
            <label className="lbl">Start</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="lbl">Ende</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        {/* Kraftempfinden */}
        <div style={{ marginBottom: 10 }}>
          <label className="lbl">Kraftempfinden (1–5)</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setEnergyLevel(energyLevel === n ? null : n)}
                style={{ fontSize: 13, padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 700, border: `1px solid ${energyLevel === n ? "var(--teal)" : "var(--border2)"}`, background: energyLevel === n ? "var(--teal-dim)" : "var(--surface2)", color: energyLevel === n ? "var(--teal)" : "var(--text-muted)" }}>
                {n}
              </button>
            ))}
            {energyLevel && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{ENERGY_LABELS[energyLevel]}</span>}
          </div>
        </div>

        <div>
          <label className="lbl">Notizen zur Session</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="z.B. Müde, Schulter zwickt…" />
        </div>
      </div>

      {/* Übungen */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {exercises.map((ex, exIdx) => {
          const last = lastSession[ex.name];
          return (
            <div key={ex.localId} className="card card-pad">
              {/* Übungs-Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--teal-dim)", color: "var(--teal)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{exIdx + 1}</span>
                <div style={{ flex: 1 }}>
                  <Autocomplete value={ex.name} onChange={v => updateEx(ex.localId, "name", v)} suggestions={suggestions} />
                </div>
                <button type="button" onClick={() => setExercises(es => es.filter(e => e.localId !== ex.localId))}
                  style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}>🗑</button>
              </div>

              {/* Letztes Training Vorschau */}
              {last && last.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, padding: "6px 10px", background: "var(--surface2)", borderRadius: 6 }}>
                  Letztes {sessionName}: {last.map((s, i) => `${s.weight} kg × ${s.reps}`).join(" · ")}
                </div>
              )}

              {/* Sätze */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr auto", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>#</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Wiederh.</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Gewicht (kg)</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Notiz</span>
                  <span />
                </div>
                {ex.sets.map((s, si) => {
                  const prevSet = last?.[si];
                  return (
                    <div key={si} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr auto", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", textAlign: "center" }}>{s.setNumber}</span>
                      <input type="number" min="0" step="1" value={s.reps}
                        placeholder={prevSet ? String(prevSet.reps) : "0"}
                        onChange={e => updateSet(ex.localId, si, "reps", e.target.value)}
                        style={{ textAlign: "center" }} />
                      <input type="number" min="0" step="0.25" value={s.weight}
                        placeholder={prevSet ? String(prevSet.weight) : "0"}
                        onChange={e => updateSet(ex.localId, si, "weight", e.target.value)}
                        style={{ textAlign: "center" }} />
                      <input value={s.notes} placeholder="–"
                        onChange={e => updateSet(ex.localId, si, "notes", e.target.value)}
                        style={{ fontSize: 12 }} />
                      <button type="button" onClick={() => removeSet(ex.localId, si)} disabled={ex.sets.length <= 1}
                        style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: ex.sets.length > 1 ? "pointer" : "default", opacity: ex.sets.length > 1 ? 1 : 0.3 }}>✕</button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSet(ex.localId)}
                style={{ marginTop: 10, alignSelf: "flex-start" }}>
                + Satz
              </button>
            </div>
          );
        })}

        <button type="button" className="btn btn-secondary" onClick={() => setExercises(es => [...es, newEx()])}
          style={{ alignSelf: "flex-start" }}>
          + Übung hinzufügen
        </button>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 20, paddingBottom: 32 }}>
        <button className="btn btn-secondary" onClick={onCancel}>← Zurück</button>
        <button className="btn btn-primary" onClick={save} disabled={saving || !sessionName} style={{ minWidth: 120 }}>
          {saving ? "Speichern…" : "✓ Speichern"}
        </button>
      </div>
    </div>
  );
}
