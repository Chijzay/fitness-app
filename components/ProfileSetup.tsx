"use client";
import { useState } from "react";
import type { Profile } from "@/app/page";
import { ACTIVITY_LEVELS } from "@/lib/calculations";

export default function ProfileSetup({
  existing,
  onSaved,
}: {
  existing?: Profile | null;
  onSaved: (p: Profile) => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    gender: existing?.gender ?? "male",
    birthdate: existing?.birthdate ? existing.birthdate.split("T")[0] : "",
    height: existing?.height ?? "",
    activityLevel: existing?.activityLevel ?? 1.375,
    proteinFactor: existing?.proteinFactor ?? 1.9,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.name || !form.birthdate || !form.height) {
      setError("Bitte Name, Geburtstag und Körpergröße ausfüllen.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, height: Number(form.height) }),
    });
    const p = await res.json();
    setSaving(false);
    if (p?.error) { setError(p.error); return; }
    onSaved(p);
  }

  const isSetup = !existing;

  return (
    <div style={{
      minHeight: isSetup ? "100vh" : undefined,
      display: "flex",
      alignItems: isSetup ? "center" : "flex-start",
      justifyContent: "center",
      background: isSetup ? "var(--bg)" : undefined,
      padding: isSetup ? "40px 20px" : undefined,
    }}>
      <div style={{ width: "100%", maxWidth: 500 }}>
        {isSetup && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "var(--teal-dim)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, margin: "0 auto 16px",
            }}>💪</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Willkommen bei FitnessTracker</h1>
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>
              Richte einmalig dein Profil ein – alle Berechnungen basieren darauf.
            </p>
          </div>
        )}

        <div className="card" style={{ padding: 28 }}>
          {!isSetup && (
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 22, color: "var(--text)" }}>
              Profil bearbeiten
            </h2>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="lbl">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dein Name" />
              </div>
              <div>
                <label className="lbl">Geschlecht</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="male">Männlich</option>
                  <option value="female">Weiblich</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="lbl">Geburtstag</label>
                <input type="date" value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} />
              </div>
              <div>
                <label className="lbl">Körpergröße (cm)</label>
                <input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value as unknown as number }))} placeholder="z.B. 182" />
              </div>
            </div>

            <div>
              <label className="lbl">Aktivitätslevel</label>
              <select value={form.activityLevel} onChange={e => setForm(f => ({ ...f, activityLevel: Number(e.target.value) }))}>
                {ACTIVITY_LEVELS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>
                Wird für die TDEE-Berechnung (Gesamtumsatz) verwendet.
              </p>
            </div>

            <div>
              <label className="lbl">Protein-Faktor (g/kg Körpergewicht)</label>
              <input
                type="number" step="0.1" min="1" max="3"
                value={form.proteinFactor}
                onChange={e => setForm(f => ({ ...f, proteinFactor: Number(e.target.value) }))}
              />
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>
                Empfohlen: 1,6–2,2 g/kg · Aktuell: {form.proteinFactor} g/kg
              </p>
            </div>

            {error && (
              <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, border: "1px solid #fecaca" }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 4, justifyContent: "center", padding: "11px 18px", fontSize: 14 }}>
              {saving ? "Speichern…" : isSetup ? "Profil erstellen & loslegen →" : "Änderungen speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
