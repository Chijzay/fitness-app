"use client";
import { useEffect, useState } from "react";
import type { Profile, DailyLog } from "@/app/page";
import { calcBMR, calcTDEE, estimateBodyFat, estimateMuscleMass, STEPS_TYPES, MOVEMENT_TYPES, calcWaterRecommendation } from "@/lib/calculations";

type QualityMode = "watch" | "manual";

type FormState = {
  weight: string; bodyFatPercent: string; bodyFatManual: boolean;
  muscleMass: string; muscleMassManual: boolean;
  kcalConsumed: string; kcalBurned: string; bmrManual: string; useBmrManual: boolean;
  carbsG: string; fatG: string; proteinG: string;
  // Schritt-Sektion
  steps: string; stepsDuration: string; stepsType: string; stepsTypeCustom: string; stepsNotes: string;
  // Bewegungs-Sektion (ohne Schritte)
  hasMovement: boolean; movementType: string; movementTypeCustom: string; movementDuration: string; movementNotes: string;
  // Schlaf (Stunden als Dezimal)
  sleepTotal: string; sleepActual: string; sleepDeep: string;
  sleepQuality: string; sleepQualityMode: QualityMode;
  waterMl: string; notes: string;
};

const empty: FormState = {
  weight: "", bodyFatPercent: "", bodyFatManual: false,
  muscleMass: "", muscleMassManual: false,
  kcalConsumed: "", kcalBurned: "", bmrManual: "", useBmrManual: false,
  carbsG: "", fatG: "", proteinG: "",
  steps: "", stepsDuration: "", stepsType: "Keine Aktivität", stepsTypeCustom: "", stepsNotes: "",
  hasMovement: false, movementType: "Schwimmen", movementTypeCustom: "", movementDuration: "", movementNotes: "",
  sleepTotal: "", sleepActual: "", sleepDeep: "",
  sleepQuality: "", sleepQualityMode: "watch",
  waterMl: "", notes: "",
};

// Minuten → "H:MM" für Anzeige im Formular
function minsToHhMm(min: number | null | undefined): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// "H:MM" oder Dezimal → Minuten für Speicherung
function hhMmToMins(s: string): number | null {
  if (!s.trim()) return null;
  if (s.includes(":")) {
    const [h, m] = s.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  const n = Number(s);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

function logToForm(log: DailyLog): FormState {
  const stepsTypeRaw = log.stepsType ?? "Keine Aktivität";
  const isMovement = MOVEMENT_TYPES.slice(0, -1).includes(stepsTypeRaw);
  const isCustomSteps = !STEPS_TYPES.slice(0, -1).includes(stepsTypeRaw) && !isMovement;
  return {
    weight: log.weight?.toString() ?? "", bodyFatPercent: log.bodyFatPercent?.toString() ?? "",
    bodyFatManual: !log.bodyFatEstimated,
    muscleMass: log.muscleMass?.toString() ?? "", muscleMassManual: log.muscleMass != null,
    kcalConsumed: log.kcalConsumed?.toString() ?? "", kcalBurned: log.kcalBurned?.toString() ?? "",
    bmrManual: log.bmrOverride?.toString() ?? "", useBmrManual: !!log.bmrOverride,
    carbsG: log.carbsG?.toString() ?? "", fatG: log.fatG?.toString() ?? "", proteinG: log.proteinG?.toString() ?? "",
    steps: log.steps?.toString() ?? "",
    stepsDuration: isMovement ? "" : (log.stepsDuration?.toString() ?? ""),
    stepsType: isMovement ? "Keine Aktivität" : (isCustomSteps ? "Eigene Eingabe" : stepsTypeRaw),
    stepsTypeCustom: isCustomSteps ? stepsTypeRaw : "",
    stepsNotes: isMovement ? "" : (log.stepsNotes ?? ""),
    hasMovement: isMovement,
    movementType: isMovement ? stepsTypeRaw : "Schwimmen",
    movementTypeCustom: "",
    movementDuration: isMovement ? (log.stepsDuration?.toString() ?? "") : "",
    movementNotes: isMovement ? (log.stepsNotes ?? "") : "",
    sleepTotal: minsToHhMm(log.sleepTotal),
    sleepActual: minsToHhMm(log.sleepActual),
    sleepDeep: log.sleepDeep?.toString() ?? "",
    sleepQuality: log.sleepQuality?.toString() ?? "",
    sleepQualityMode: log.sleepQuality != null && log.sleepQuality > 5 ? "watch" : "manual",
    waterMl: log.waterMl?.toString() ?? "", notes: log.notes ?? "",
  };
}

function Section({ icon, title, children, accent }: { icon: string; title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card card-pad${accent ? " card-accent" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div className="section-head-icon">{icon}</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string | React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} type="button" style={{
      fontSize: 10.5, padding: "1px 7px", borderRadius: 20,
      background: active ? "var(--teal-dim)" : "var(--bg2)",
      color: active ? "var(--teal)" : "var(--text-muted)",
      border: `1px solid ${active ? "var(--teal)" : "var(--border2)"}`,
      fontWeight: 600, cursor: "pointer",
    }}>{children}</button>
  );
}

export default function QuickEntry({
  profile, date, setDate, logs, onSaved, onRefresh, onCancel,
}: {
  profile: Profile; date: string; setDate: (d: string) => void;
  logs: DailyLog[]; onSaved: () => void; onRefresh?: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);

  useEffect(() => {
    const existing = logs.find(l => l.date.startsWith(date));
    setExistingId(existing?.id ?? null);
    if (existing) {
      setForm(logToForm(existing));
    } else {
      const sorted = [...logs].filter(l => !l.date.startsWith(date)).sort((a, b) => b.date.localeCompare(a.date));
      const prevBf = sorted.find(l => !l.bodyFatEstimated && l.bodyFatPercent != null);
      const prevMm = sorted.find(l => l.muscleMass != null);
      setForm({
        ...empty,
        bodyFatPercent: prevBf?.bodyFatPercent?.toString() ?? "",
        bodyFatManual: prevBf != null,
        muscleMass: prevMm?.muscleMass?.toString() ?? "",
        muscleMassManual: prevMm != null,
      });
    }
    setConfirmDelete(false);
  }, [date, logs]);

  useEffect(() => {
    if (form.weight && !form.bodyFatManual) {
      const est = estimateBodyFat(Number(form.weight), profile.height, profile.gender, new Date(profile.birthdate));
      setForm(f => ({ ...f, bodyFatPercent: est.toFixed(1) }));
    }
  }, [form.weight, form.bodyFatManual, profile]);

  useEffect(() => {
    if (form.weight && form.bodyFatPercent && !form.muscleMassManual) {
      const est = estimateMuscleMass(Number(form.weight), Number(form.bodyFatPercent), profile.gender);
      setForm(f => ({ ...f, muscleMass: est.toFixed(1) }));
    }
  }, [form.weight, form.bodyFatPercent, form.muscleMassManual, profile.gender]);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Nur ganze Zahlen ≥ 0 (für kcal, Schritte, Wasser, Dauer, Makros in g)
  function si(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v) { setForm(f => ({ ...f, [field]: "" })); return; }
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 0) setForm(f => ({ ...f, [field]: String(n) }));
    };
  }

  // Dezimalzahlen ≥ 0 (für Gewicht, KF%, Muskelmasse)
  function sp(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v) { setForm(f => ({ ...f, [field]: "" })); return; }
      if (parseFloat(v) >= 0) setForm(f => ({ ...f, [field]: v }));
    };
  }

  function changeStepsType(type: string) {
    if (type === "Keine Aktivität") {
      setForm(f => ({ ...f, stepsType: type, stepsDuration: "0" }));
    } else {
      setForm(f => ({ ...f, stepsType: type }));
    }
  }

  const bmrAuto = form.weight
    ? calcBMR(Number(form.weight), profile.height, profile.gender, new Date(profile.birthdate))
    : null;
  const bmrUsed = form.useBmrManual && form.bmrManual ? Number(form.bmrManual) : bmrAuto;
  // Defizit basiert auf TDEE (BMR × Aktivitätsfaktor) nicht nur Grundumsatz
  const tdeeUsed = bmrUsed ? Math.round(calcTDEE(bmrUsed, profile.activityLevel)) : null;
  const balance = tdeeUsed && form.kcalConsumed
    ? Math.round(Number(form.kcalConsumed) - tdeeUsed - (Number(form.kcalBurned) || 0))
    : null;

  const waterRec = form.weight ? calcWaterRecommendation(Number(form.weight)) : null;

  async function deleteEntry() {
    setDeleting(true);
    await fetch(`/api/logs?date=${date}`, { method: "DELETE" });
    setDeleting(false);
    onSaved();
  }

  async function save() {
    setSaving(true);
    // Determine activity type and duration to save
    let finalStepsType: string | undefined;
    let finalDuration: number | undefined;
    let finalSteps: number | undefined;
    let finalNotes: string | undefined;

    if (form.hasMovement) {
      // Movement without steps: save movement type in stepsType field, duration in stepsDuration
      finalStepsType = form.movementType === "Eigene Eingabe"
        ? (form.movementTypeCustom || "Bewegung")
        : form.movementType;
      finalDuration = form.movementDuration ? Number(form.movementDuration) : undefined;
      finalSteps = form.steps ? Number(form.steps) : undefined;
      finalNotes = form.movementNotes || form.stepsNotes || undefined;
    } else {
      const actType = form.stepsType === "Eigene Eingabe" ? (form.stepsTypeCustom || "Sonstiges") : form.stepsType;
      finalStepsType = actType === "Keine Aktivität" ? "Keine Aktivität" : actType;
      finalDuration = form.stepsDuration ? Number(form.stepsDuration) : undefined;
      finalSteps = form.steps ? Number(form.steps) : undefined;
      finalNotes = form.stepsNotes || undefined;
    }

    // When editing an existing entry, send null for cleared fields so they're wiped in DB.
    // For new entries, omit undefined fields entirely.
    const n = (v: string) => v ? Number(v) : (existingId ? null : undefined);
    const s = (v: string) => v || (existingId ? null : undefined);

    const payload: Record<string, unknown> = {
      date,
      weight: n(form.weight),
      bodyFatPercent: n(form.bodyFatPercent),
      bodyFatEstimated: !form.bodyFatManual,
      muscleMass: n(form.muscleMass),
      kcalConsumed: n(form.kcalConsumed),
      kcalBurned: n(form.kcalBurned),
      bmrOverride: form.useBmrManual && form.bmrManual ? Number(form.bmrManual) : (existingId ? null : undefined),
      carbsG: n(form.carbsG),
      fatG: n(form.fatG),
      proteinG: n(form.proteinG),
      steps: finalSteps ?? (existingId ? null : undefined),
      stepsDuration: finalDuration ?? (existingId ? null : undefined),
      stepsType: finalStepsType ?? (existingId ? null : undefined),
      stepsNotes: finalNotes ?? (existingId ? null : undefined),
      sleepTotal: hhMmToMins(form.sleepTotal) ?? (existingId ? null : undefined),
      sleepActual: hhMmToMins(form.sleepActual) ?? (existingId ? null : undefined),
      sleepDeep: n(form.sleepDeep),
      sleepQuality: n(form.sleepQuality),
      waterMl: n(form.waterMl),
      notes: s(form.notes),
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (onRefresh) {
      onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      onSaved();
    }
  }

  const g3 = "form-g3";
  const g2 = "form-g2";

  return (
    <div style={{ margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ marginRight: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Tageseintrag</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Alle Felder sind optional</p>
        </div>
        {/* Date navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn-sm btn-secondary" style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
            onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(d.toISOString().split("T")[0]); }}>‹</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 148 }} />
          <button className="btn btn-sm btn-secondary" style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
            onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]); }}>›</button>
        </div>
        <div style={{ flex: 1 }} />
        {existingId && !confirmDelete && (
          <button className="btn btn-sm btn-secondary" onClick={() => setConfirmDelete(true)}
            style={{ color: "var(--red)", borderColor: "var(--red)" }}>
            🗑 Löschen
          </button>
        )}
        {existingId && confirmDelete && (
          <>
            <span style={{ fontSize: 12, color: "var(--red)" }}>Wirklich löschen?</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setConfirmDelete(false)}>Nein</button>
            <button className="btn btn-sm" onClick={deleteEntry} disabled={deleting}
              style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", minWidth: 80 }}>
              {deleting ? "…" : "Ja, löschen"}
            </button>
          </>
        )}
        <button className="btn btn-sm btn-secondary" onClick={onCancel}>← Zurück</button>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 110 }}>
          {saving ? "Speichern…" : saved ? "✓ Gespeichert!" : "✓ Speichern"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Gewicht & Körper */}
        <Section icon="⚖️" title="Gewicht & Körper">
          <div className={g3}>
            <Field label="Gewicht (kg)">
              <input type="number" min="0" step="0.1" value={form.weight}
                onChange={sp("weight")} placeholder="z.B. 85,5" />
            </Field>
            <Field label={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Körperfett %
                <Toggle active={form.bodyFatManual} onClick={() => set("bodyFatManual", !form.bodyFatManual)}>
                  {form.bodyFatManual ? "Manuell" : "Auto (BMI)"}
                </Toggle>
              </span>
            }>
              <input type="number" min="0" max="70" step="0.1" value={form.bodyFatPercent}
                onChange={e => { sp("bodyFatPercent")(e); set("bodyFatManual", true); }}
                placeholder={form.bodyFatManual ? "z.B. 22,0" : "wird berechnet"} />
            </Field>
            <Field label={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Muskelmasse (kg)
                <Toggle active={form.muscleMassManual} onClick={() => set("muscleMassManual", !form.muscleMassManual)}>
                  {form.muscleMassManual ? "Manuell" : "Auto"}
                </Toggle>
              </span>
            }>
              <input type="number" min="0" step="0.1" value={form.muscleMass}
                onChange={e => { sp("muscleMass")(e); set("muscleMassManual", true); }}
                placeholder={form.muscleMassManual ? "z.B. 38,0" : "wird geschätzt"} />
            </Field>
          </div>
        </Section>

        {/* Kalorien */}
        <Section icon="🔥" title="Kalorien">
          <div className={g3}>
            <Field label="Gegessen (kcal)">
              <input type="number" min="0" step="1" value={form.kcalConsumed}
                onChange={si("kcalConsumed")} placeholder="z.B. 1800" />
            </Field>
            <Field label="Zusätzlich verbrannt (kcal)">
              <input type="number" min="0" step="1" value={form.kcalBurned}
                onChange={si("kcalBurned")} placeholder="z.B. 300" />
            </Field>
            <Field label={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Grundumsatz (BMR)
                <Toggle active={form.useBmrManual} onClick={() => set("useBmrManual", !form.useBmrManual)}>
                  {form.useBmrManual ? "Manuell" : "Auto"}
                </Toggle>
              </span>
            }>
              {form.useBmrManual ? (
                <input type="number" min="0" step="1" value={form.bmrManual}
                  onChange={si("bmrManual")} placeholder="z.B. 1850" autoFocus />
              ) : (
                <div
                  onClick={() => set("useBmrManual", true)}
                  onDoubleClick={() => set("useBmrManual", true)}
                  title="Klicken zum manuellen Überschreiben"
                  style={{
                    padding: "8px 11px", borderRadius: 7, border: "1px solid var(--border)",
                    background: "var(--surface2)", color: bmrAuto ? "var(--text-2)" : "var(--text-muted)",
                    fontSize: 13.5, cursor: "pointer", userSelect: "none",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--teal)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  {bmrAuto ? `${Math.round(bmrAuto)} kcal` : "Gewicht eingeben →"}
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>✏</span>
                </div>
              )}
            </Field>
          </div>

          {balance !== null && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, border: "1px solid", display: "flex", alignItems: "center", gap: 10, ...(balance > 0 ? { background: "var(--red-dim)", borderColor: "rgba(248,81,73,0.3)" } : { background: "var(--green-dim)", borderColor: "rgba(63,185,80,0.3)" }) }}>
              <span style={{ fontSize: 18 }}>{balance > 0 ? "📈" : "📉"}</span>
              <div>
                <span style={{ fontWeight: 700, color: balance > 0 ? "var(--red)" : "var(--green)", fontSize: 15 }}>
                  {balance > 0 ? "+" : ""}{balance} kcal
                </span>
                <span style={{ color: "var(--text-2)", fontSize: 13, marginLeft: 8 }}>
                  {balance > 0 ? "Überschuss heute" : "Defizit heute"}
                  {Math.abs(balance) > 0 && ` · ${(Math.abs(balance) / 7000).toFixed(3)} kg Fett`}
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Makros */}
        <Section icon="🥗" title="Makronährstoffe">
          <div className={g3}>
            <Field label="Kohlenhydrate (g)">
              <input type="number" min="0" step="0.1" value={form.carbsG} onChange={sp("carbsG")} placeholder="z.B. 200" />
            </Field>
            <Field label="Eiweiß (g)">
              <input type="number" min="0" step="0.1" value={form.proteinG} onChange={sp("proteinG")} placeholder="z.B. 150" />
            </Field>
            <Field label="Fett (g)">
              <input type="number" min="0" step="0.1" value={form.fatG} onChange={sp("fatG")} placeholder="z.B. 70" />
            </Field>
          </div>
        </Section>

        {/* Schritte */}
        <Section icon="🚶" title="Schritte & Bewegung">
          <div className={g3}>
            <Field label="Schritte">
              <input type="number" min="0" step="1" value={form.steps}
                onChange={si("steps")}
                placeholder="z.B. 8500" />
            </Field>
            <Field label="Dauer (Minuten)">
              <input type="number" min="0" step="1" value={form.stepsDuration}
                onChange={si("stepsDuration")}
                placeholder={form.stepsType === "Keine Aktivität" ? "0" : "z.B. 45"} />
            </Field>
            <Field label="Aktivitätsart">
              <select value={form.stepsType} onChange={e => changeStepsType(e.target.value)}>
                {STEPS_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          {form.stepsType === "Eigene Eingabe" && (
            <div style={{ marginTop: 12 }}>
              <Field label="Aktivität eingeben">
                <input value={form.stepsTypeCustom} onChange={e => set("stepsTypeCustom", e.target.value)}
                  placeholder="z.B. Treppensteigen, Tanzen…" autoFocus />
              </Field>
            </div>
          )}
          {form.stepsType !== "Keine Aktivität" && (
            <div style={{ marginTop: 12 }}>
              <Field label="Notiz (optional)">
                <input value={form.stepsNotes} onChange={e => set("stepsNotes", e.target.value)} placeholder="z.B. Abendspaziergang im Park" />
              </Field>
            </div>
          )}

          {/* Bewegung ohne Schritte Toggle */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: form.hasMovement ? 14 : 0 }}>
              <Toggle active={form.hasMovement} onClick={() => set("hasMovement", !form.hasMovement)}>
                🏊 Zusätzliche Aktivität (ohne Schritte)
              </Toggle>
              {!form.hasMovement && (
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Schwimmen, Radfahren, Krafttraining …
                </span>
              )}
            </div>
            {form.hasMovement && (
              <div className={g3}>
                <Field label="Dauer (Minuten)">
                  <input type="number" min="0" step="1" value={form.movementDuration}
                    onChange={si("movementDuration")} placeholder="z.B. 60" autoFocus />
                </Field>
                <Field label="Art">
                  <select value={form.movementType} onChange={e => set("movementType", e.target.value)}>
                    {MOVEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                {form.movementType === "Eigene Eingabe" && (
                  <Field label="Aktivität eingeben">
                    <input value={form.movementTypeCustom} onChange={e => set("movementTypeCustom", e.target.value)}
                      placeholder="z.B. Klettern, Tanzen…" />
                  </Field>
                )}
                <Field label="Notiz (optional)">
                  <input value={form.movementNotes} onChange={e => set("movementNotes", e.target.value)}
                    placeholder="z.B. 60 Züge Kraul" />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Schlaf */}
        <Section icon="😴" title="Schlaf">
          <div className="form-g3">
            <Field label="Im Bett (H:MM)">
              <input type="text" value={form.sleepTotal}
                onChange={e => set("sleepTotal", e.target.value)} placeholder="z.B. 8:00" />
            </Field>
            <Field label="Geschlafen (H:MM)">
              <input type="text" value={form.sleepActual}
                onChange={e => set("sleepActual", e.target.value)} placeholder="z.B. 6:37" />
            </Field>
            <Field label="Tiefschlaf (Minuten)">
              <input type="number" min="0" step="1" value={form.sleepDeep}
                onChange={si("sleepDeep")} placeholder="z.B. 90" />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <label className="lbl" style={{ marginBottom: 0 }}>Schlafqualität</label>
              <Toggle active={form.sleepQualityMode === "watch"} onClick={() => set("sleepQualityMode", "watch")}>
                ⌚ Uhr (0–100)
              </Toggle>
              <Toggle active={form.sleepQualityMode === "manual"} onClick={() => set("sleepQualityMode", "manual")}>
                💭 Einschätzung
              </Toggle>
            </div>
            {form.sleepQualityMode === "watch" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="number" min="0" max="100" step="1" value={form.sleepQuality}
                  onChange={si("sleepQuality")} placeholder="0–100 (von Uhr ablesen)" style={{ maxWidth: 180 }} />
                {form.sleepQuality && (
                  <span style={{ fontSize: 12, color: Number(form.sleepQuality) >= 75 ? "var(--green)" : Number(form.sleepQuality) >= 50 ? "var(--orange)" : "var(--red)" }}>
                    {Number(form.sleepQuality) >= 75 ? "Gut 😴" : Number(form.sleepQuality) >= 50 ? "Ok 😐" : "Schlecht 😞"}
                  </span>
                )}
              </div>
            ) : (
              <select value={form.sleepQuality} onChange={e => set("sleepQuality", e.target.value)} style={{ maxWidth: 280 }}>
                <option value="">– Auswählen</option>
                <option value="20">1 – Sehr schlecht 😞</option>
                <option value="40">2 – Schlecht 😕</option>
                <option value="60">3 – Ok 😐</option>
                <option value="80">4 – Gut 🙂</option>
                <option value="100">5 – Sehr gut 😄</option>
              </select>
            )}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
              {form.sleepQualityMode === "watch"
                ? "Wert direkt von der Smartwatch ablesen (Garmin, Polar, Fitbit, …)"
                : "Eigene subjektive Einschätzung — wird intern auf 0–100 normalisiert gespeichert"}
            </p>
          </div>
        </Section>

        {/* Wasser & Notizen */}
        <Section icon="💧" title="Wasser & Notizen">
          <div className={g2}>
            <Field label={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Wasser (ml)
                {waterRec && (
                  <span style={{ fontSize: 10, color: "var(--teal)", fontWeight: 500 }}>
                    Empfehlung: {waterRec.toLocaleString("de")} ml
                  </span>
                )}
              </span>
            }>
              <input type="number" min="0" step="1" value={form.waterMl} onChange={si("waterMl")}
                placeholder={waterRec ? waterRec.toString() : "z.B. 2500"} />
            </Field>
            <Field label="Tagesnotiz">
              <input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Freitext…" />
            </Field>
          </div>
          {waterRec && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
              💡 Empfehlung: ca. {waterRec.toLocaleString("de")} ml/Tag (35 ml × {form.weight} kg)
            </p>
          )}
        </Section>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingBottom: 32 }}>
          {existingId && (
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(true)}
              style={{ color: "var(--red)", borderColor: "var(--red)", marginRight: "auto" }}>
              🗑 Ganzen Eintrag löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onCancel}>← Zurück</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 120 }}>
            {saving ? "Speichern…" : saved ? "✓ Gespeichert!" : "✓ Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
