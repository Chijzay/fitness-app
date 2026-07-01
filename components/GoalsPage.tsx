"use client";
import { useEffect, useState } from "react";
import type { Profile, DailyLog } from "@/app/page";
import { calcBMR, estimateBodyFat, calcMaxDeficit } from "@/lib/calculations";

type Goal = { id: number; type: string; targetValue: number; targetDate?: string; notes?: string; isActive: boolean };

const GOAL_TYPES = [
  { value: "weight",      label: "Zielgewicht",        unit: "kg",      icon: "⚖️",  defaultVal: null },
  { value: "kcal_deficit",label: "Tägliches Defizit",  unit: "kcal/Tag",icon: "🔥",  defaultVal: null },
  { value: "protein",     label: "Tägliches Protein",  unit: "g/Tag",   icon: "🥩",  defaultVal: null },
  { value: "steps",       label: "Tägliche Schritte",  unit: "Schritte",icon: "🚶",  defaultVal: 10000 },
  { value: "sleep",       label: "Schlafdauer",         unit: "Std./Nacht", icon: "😴", defaultVal: 7 },
  { value: "water",       label: "Tägliches Wasser",   unit: "ml",      icon: "💧",  defaultVal: 2500 },
  { value: "body_fat",    label: "Körperfett-Ziel",     unit: "%",       icon: "📊",  defaultVal: null },
];

function goalMeta(type: string) { return GOAL_TYPES.find(g => g.value === type) ?? GOAL_TYPES[0]; }

function calcProgress(goal: Goal, latestLog?: DailyLog): number | null {
  if (!latestLog) return null;
  const val = (() => {
    switch (goal.type) {
      case "weight":      return latestLog.weight ?? null;
      case "body_fat":    return latestLog.bodyFatPercent ?? null;
      case "steps":       return latestLog.steps ?? null;
      case "sleep":       return latestLog.sleepActual != null ? +(latestLog.sleepActual / 60).toFixed(1) : null;
      case "water":       return latestLog.waterMl ?? null;
      case "protein":     return latestLog.proteinG ?? null;
      case "kcal_deficit":
        if (!latestLog.kcalConsumed) return null;
        return Math.max(0, (latestLog.bmrOverride ?? 0) - latestLog.kcalConsumed);
      default: return null;
    }
  })();
  if (val === null) return null;
  // For weight/body_fat: lower is better (progress toward lower target)
  if (goal.type === "weight" || goal.type === "body_fat") {
    return Math.min(100, Math.max(0, Math.round((1 - val / goal.targetValue) * 100 + 100) / 2));
  }
  return Math.min(100, Math.round((val / goal.targetValue) * 100));
}

function ProgressBar({ pct, color = "var(--teal)" }: { pct: number; color?: string }) {
  return (
    <div className="progress-track" style={{ height: 5, marginTop: 10 }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function GoalsPage({ profile, latestLog, logs }: { profile: Profile; latestLog?: DailyLog; logs?: DailyLog[] }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "weight", targetValue: "", targetDate: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const latestW = latestLog?.weight;
  const bf = latestLog?.bodyFatPercent ?? (latestW ? estimateBodyFat(latestW, profile.height, profile.gender, new Date(profile.birthdate)) : null);
  const maxDef = latestW && bf ? calcMaxDeficit(latestW, bf) : null;
  const proteinMin = latestW ? Math.round(latestW * 1.6) : null;
  const proteinMax = latestW ? Math.round(latestW * profile.proteinFactor) : null;
  const bmr = latestW ? Math.round(calcBMR(latestW, profile.height, profile.gender, new Date(profile.birthdate))) : null;

  useEffect(() => {
    fetch("/api/goals").then(r => r.json()).then(setGoals);
  }, []);

  const goalsByType = Object.fromEntries(goals.map(g => [g.type, g]));

  function startAdd() {
    const firstMissing = GOAL_TYPES.find(t => !goalsByType[t.value]);
    const type = firstMissing?.value ?? "weight";
    const defVal = firstMissing?.defaultVal ?? "";
    setForm({ type, targetValue: defVal?.toString() ?? "", targetDate: "", notes: "" });
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(g: Goal) {
    setForm({
      type: g.type,
      targetValue: g.targetValue.toString(),
      targetDate: g.targetDate ? g.targetDate.split("T")[0] : "",
      notes: g.notes ?? "",
    });
    setEditingId(g.id);
    setAdding(true);
  }

  // When type changes in form, set default value if field is empty
  function changeType(type: string) {
    const meta = GOAL_TYPES.find(g => g.value === type);
    const existing = goalsByType[type];
    setForm(f => ({
      ...f,
      type,
      targetValue: existing ? existing.targetValue.toString() : (meta?.defaultVal?.toString() ?? ""),
      notes: existing?.notes ?? "",
      targetDate: existing?.targetDate?.split("T")[0] ?? "",
    }));
    if (existing) setEditingId(existing.id);
    else setEditingId(null);
  }

  async function saveGoal() {
    if (!form.targetValue) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, targetValue: Number(form.targetValue), targetDate: form.targetDate || null, notes: form.notes || null }),
        });
        const g = await res.json();
        setGoals(prev => prev.map(x => x.id === editingId ? { ...x, ...g } : x));
      } else {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: form.type, targetValue: Number(form.targetValue), targetDate: form.targetDate || null, notes: form.notes || null }),
        });
        const g = await res.json();
        setGoals(prev => [g, ...prev.filter(x => x.type !== form.type)]);
      }
      setAdding(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(id: number) {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  const existingTypeInForm = goalsByType[form.type];

  return (
    <div style={{ margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>Meine Ziele</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Ein Ziel pro Kategorie. Bestehende Ziele werden beim Speichern ersetzt.</p>
          <div style={{ width: 32, height: 2.5, background: "var(--teal)", borderRadius: 99, marginTop: 8 }} />
        </div>
        {!adding && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Ziel hinzufügen</button>
        )}
      </div>

      {/* Empfehlungen */}
      {latestW && (
        <div className="card card-pad card-accent" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            💡 Empfehlungen basierend auf deinen Werten
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Max. Kaloriendefizit", value: maxDef ? `${maxDef} kcal/Tag` : "–", sub: "Körperfett (kg) × 70" },
              { label: "Protein-Zielbereich", value: proteinMin && proteinMax ? `${proteinMin}–${proteinMax} g/Tag` : "–", sub: `1,6–${profile.proteinFactor} g/kg` },
              { label: "Grundumsatz (BMR)", value: bmr ? `${bmr} kcal` : "–", sub: "Mifflin-St-Jeor" },
            ].map(r => (
              <div key={r.label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.05em" }}>{r.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--teal)" }}>{r.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formular */}
      {adding && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: "rgba(0,212,180,0.25)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--teal)" }}>
            {editingId ? "Ziel aktualisieren" : "Neues Ziel"}
            {existingTypeInForm && !editingId && (
              <span className="badge badge-orange" style={{ marginLeft: 8, fontWeight: 500 }}>
                Ersetzt bestehendes Ziel
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="lbl">Kategorie</label>
              <select value={form.type} onChange={e => changeType(e.target.value)} disabled={!!editingId}>
                {GOAL_TYPES.map(g => (
                  <option key={g.value} value={g.value}>
                    {g.icon} {g.label} {goalsByType[g.value] ? "✓" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">
                Zielwert ({goalMeta(form.type).unit})
                {goalMeta(form.type).defaultVal && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                    — Standard: {goalMeta(form.type).defaultVal}
                  </span>
                )}
              </label>
              <input type="number" value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder={goalMeta(form.type).defaultVal?.toString() ?? "Zielwert"} />
            </div>
            <div>
              <label className="lbl">Zieldatum (optional)</label>
              <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div>
              <label className="lbl">Notiz (optional)</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="z.B. Sommerziel" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-sm btn-secondary" onClick={() => { setAdding(false); setEditingId(null); }}>Abbrechen</button>
            <button className="btn btn-sm btn-primary" onClick={saveGoal} disabled={saving || !form.targetValue}>
              {saving ? "Speichern…" : editingId ? "✓ Aktualisieren" : "✓ Ziel speichern"}
            </button>
          </div>
        </div>
      )}

      {/* Ziele Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {goals.length === 0 && !adding && (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Noch keine Ziele gesetzt</div>
            <div style={{ fontSize: 13 }}>Klick auf „+ Ziel hinzufügen" um zu starten</div>
          </div>
        )}

        {goals.map(g => {
          const meta = goalMeta(g.type);
          const pct = calcProgress(g, latestLog);
          const currentVal = (() => {
            if (!latestLog) return null;
            switch (g.type) {
              case "weight":      return latestLog.weight;
              case "body_fat":    return latestLog.bodyFatPercent;
              case "steps":       return latestLog.steps;
              case "sleep":       return latestLog.sleepActual != null ? +(latestLog.sleepActual / 60).toFixed(1) : null;
              case "water":       return latestLog.waterMl;
              case "protein":     return latestLog.proteinG;
              default: return null;
            }
          })();

          return (
            <div key={g.id} className="card card-pad" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, lineHeight: 1, paddingTop: 2 }}>{meta.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{meta.label}</span>
                  {g.targetDate && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      · bis {new Date(g.targetDate).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                    {g.targetValue.toLocaleString("de")}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{meta.unit}</span>
                  {currentVal != null && (
                    <span style={{ fontSize: 12, color: "var(--text-2)", marginLeft: 4 }}>
                      · Heute: <span style={{ color: "var(--teal)", fontWeight: 700 }}>{currentVal.toLocaleString("de")}</span>
                    </span>
                  )}
                </div>
                {g.notes && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>{g.notes}</div>}
                {pct !== null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Fortschritt heute</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: pct >= 80 ? "var(--teal)" : pct >= 50 ? "var(--orange)" : "var(--text-muted)" }}>
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar pct={pct} color={pct >= 80 ? "var(--teal)" : pct >= 50 ? "var(--orange)" : "var(--border2)"} />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-xs btn-secondary" onClick={() => startEdit(g)}>Bearbeiten</button>
                <button className="btn btn-xs btn-ghost" onClick={() => deleteGoal(g.id)} style={{ color: "var(--red)" }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
