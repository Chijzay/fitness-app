"use client";
import { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine, Legend } from "recharts";
import type { DailyLog, DateRange, Profile } from "@/app/page";
import { allDatesInRange, fmtShort, fmtFull, tickStyle, gridStyle, tooltipStyle, RangeSelector, KpiCard, SectionHeader, refLabel } from "@/lib/chartHelpers";
import { calcBMR, calcTDEE, estimateBodyFat, calcMaxDeficit, calcFatKgFromKcal } from "@/lib/calculations";

export default function KcalDetail({ logs, allLogs, profile, range, setRange, onEditDate }: {
  logs: DailyLog[]; allLogs: DailyLog[]; profile: Profile; range: DateRange; setRange: (r: DateRange) => void;
  onEditDate?: (date: string) => void;
}) {
  const dates = useMemo(() => allDatesInRange(range), [range]);
  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    allLogs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [allLogs]);

  const latestW = [...allLogs].reverse().find(l => l.weight)?.weight;
  const latestBF = [...allLogs].reverse().find(l => l.bodyFatPercent)?.bodyFatPercent
    ?? (latestW ? estimateBodyFat(latestW, profile.height, profile.gender, new Date(profile.birthdate)) : null);
  const maxDeficit = latestW && latestBF ? calcMaxDeficit(latestW, latestBF) : null;
  const bmrRef = latestW ? calcBMR(latestW, profile.height, profile.gender, new Date(profile.birthdate)) : null;
  const tdee = bmrRef ? calcTDEE(bmrRef, profile.activityLevel) : null;

  const dayData = dates.map(d => {
    const log = logMap[d];
    const w = log?.weight ?? latestW;
    const bmr = log?.bmrOverride ?? (w ? calcBMR(w, profile.height, profile.gender, new Date(profile.birthdate)) : null);
    const tdeeDay = bmr ? Math.round(calcTDEE(bmr, profile.activityLevel)) : null;
    const deficit = tdeeDay != null && log?.kcalConsumed != null ? log.kcalConsumed - tdeeDay - (log.kcalBurned ?? 0) : null;
    return {
      date: fmtShort(d), full: fmtFull(d), raw: d,
      consumed: log?.kcalConsumed ?? null,
      burned: log?.kcalBurned ?? null,
      bmr: bmr ? Math.round(bmr) : null,
      tdeeDay,
      deficit,
      protein: log?.proteinG ?? null,
      carbs: log?.carbsG ?? null,
      fat: log?.fatG ?? null,
    };
  });

  // Makro-Auswertung
  const macroEntries = dayData.filter(d => d.protein != null || d.carbs != null || d.fat != null);
  const avgProtein = macroEntries.length ? Math.round(macroEntries.reduce((s, d) => s + (d.protein ?? 0), 0) / macroEntries.length) : null;
  const avgCarbs = macroEntries.length ? Math.round(macroEntries.reduce((s, d) => s + (d.carbs ?? 0), 0) / macroEntries.length) : null;
  const avgFat = macroEntries.length ? Math.round(macroEntries.reduce((s, d) => s + (d.fat ?? 0), 0) / macroEntries.length) : null;
  const proteinTarget = latestW ? Math.round(latestW * profile.proteinFactor) : null;

  const withData = dayData.filter(d => d.deficit != null);
  const totalDeficit = withData.reduce((s, d) => s + (d.deficit ?? 0), 0);
  const totalFatKg = calcFatKgFromKcal(totalDeficit);
  const avgDeficit = withData.length ? Math.round(totalDeficit / withData.length) : null;
  const deficitDays = withData.filter(d => (d.deficit ?? 0) < 0).length;

  // Wöchentliche Bilanz
  const weeklyMap: Record<string, number> = {};
  dates.forEach(d => {
    const entry = dayData.find(x => x.date === fmtShort(d));
    if (!entry?.deficit) return;
    const dt = new Date(d + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = `KW ${mon.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    weeklyMap[key] = (weeklyMap[key] ?? 0) + entry.deficit;
  });
  const weeklyData = Object.entries(weeklyMap).map(([week, deficit]) => ({
    week, deficit, fatKg: +calcFatKgFromKcal(deficit).toFixed(2),
  }));

  const tt = tooltipStyle;

  function exportCSV() {
    const rows = [["Datum", "Gegessen (kcal)", "Verbrannt (kcal)", "BMR (kcal)", "Bilanz (kcal)", "Fett (kg)"]];
    dayData.filter(d => d.consumed != null).forEach(d => rows.push([
      d.full, String(d.consumed ?? ""), String(d.burned ?? ""), String(d.bmr ?? ""),
      String(d.deficit ?? ""), d.deficit ? calcFatKgFromKcal(d.deficit).toFixed(3) : "",
    ]));
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "kalorien.csv"; a.click();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>🔥 Kalorienbalance</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>{withData.length} Tage mit Daten</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangeSelector range={range} setRange={setRange} />
          <button className="btn btn-xs btn-secondary" onClick={exportCSV}>↓ CSV</button>
        </div>
      </div>

      <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="📊" label="Gesamtbilanz" value={withData.length ? `${totalDeficit > 0 ? "+" : ""}${Math.round(totalDeficit)} kcal` : "–"}
          sub={Math.abs(totalFatKg) > 0.01 ? `≈ ${totalFatKg > 0 ? "+" : ""}${totalFatKg.toFixed(2)} kg Fett` : undefined}
          color={totalDeficit < 0 ? "var(--green)" : totalDeficit > 0 ? "var(--red)" : undefined} />
        <KpiCard icon="📉" label="Ø Tagesbilanz" value={avgDeficit != null ? `${avgDeficit > 0 ? "+" : ""}${avgDeficit} kcal` : "–"}
          sub="pro Tag mit Eintrag"
          color={avgDeficit != null ? (avgDeficit < 0 ? "var(--green)" : "var(--red)") : undefined} />
        <KpiCard icon="✅" label="Defizit-Tage" value={`${deficitDays} / ${withData.length}`}
          sub="Tage mit negativer Bilanz"
          badge={withData.length > 0 ? <span className={`badge ${deficitDays / withData.length >= 0.7 ? "badge-green" : "badge-orange"}`}>{Math.round(deficitDays / withData.length * 100)} %</span> : undefined} />
        <KpiCard icon="⚠️" label="Max. empf. Defizit" value={maxDeficit ? `${maxDeficit} kcal/Tag` : "–"}
          sub="Körperfett (kg) × 70" color="var(--orange)" />
      </div>

      {/* Referenzwerte */}
      {(bmrRef || tdee) && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <SectionHeader title="Deine Referenzwerte" icon="📋" />
          <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Grundumsatz (BMR)", value: bmrRef ? `${Math.round(bmrRef)} kcal` : "–", sub: "Mifflin-St-Jeor" },
              { label: "Gesamtumsatz (TDEE)", value: tdee ? `${Math.round(tdee)} kcal` : "–", sub: `Faktor × ${profile.activityLevel}` },
              { label: "Max. Defizit/Tag", value: maxDeficit ? `${maxDeficit} kcal` : "–", sub: `≈ ${maxDeficit ? (maxDeficit * 7 / 7700).toFixed(2) : "–"} kg/Woche` },
              { label: "7.700 kcal = 1 kg Fett", value: "7.700 kcal", sub: "Energiegehalt Körperfett" },
            ].map(k => (
              <div key={k.label} style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{k.value}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bilanz-Chart */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <SectionHeader title="Tägliche Kalorienbalance" icon="📈" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dayData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
            <YAxis tick={tickStyle} width={55} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as typeof dayData[0];
              if (d.deficit == null) return null;
              const bal = Math.round(d.deficit);
              return (
                <div style={{ ...tt.contentStyle, padding: "10px 14px", fontSize: 13, minWidth: 190 }}>
                  <p style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{d.full}</p>
                  {d.consumed != null && <p style={{ color: "var(--text-2)", marginBottom: 3 }}>🍽 Gegessen: <b>{d.consumed} kcal</b></p>}
                  {d.tdeeDay != null && <p style={{ color: "var(--text-2)", marginBottom: 3 }}>⚙️ TDEE: <b>{d.tdeeDay} kcal</b></p>}
                  {d.burned != null && d.burned > 0 && <p style={{ color: "var(--text-2)", marginBottom: 3 }}>🏃 Extra verbrannt: <b>−{d.burned} kcal</b></p>}
                  <div style={{ borderTop: "1px solid var(--border2)", marginTop: 6, paddingTop: 6 }}>
                    <p style={{ fontWeight: 700, color: bal <= 0 ? "var(--green)" : "var(--red)" }}>
                      📊 Bilanz: {bal > 0 ? "+" : ""}{bal} kcal
                    </p>
                    {d.deficit != null && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      ≈ {calcFatKgFromKcal(d.deficit).toFixed(3)} kg Fett
                    </p>}
                  </div>
                </div>
              );
            }} />
            <ReferenceLine y={0} stroke="var(--border2)" strokeWidth={1.5} />
            {maxDeficit && <ReferenceLine y={-maxDeficit} stroke="var(--orange)" strokeDasharray="4 3" label={refLabel("Max. Defizit", "var(--orange)")} />}
            <Bar dataKey="deficit" radius={[5, 5, 0, 0]} maxBarSize={40}>
              {dayData.map((d, i) => <Cell key={i} fill={(d.deficit ?? 0) <= 0 ? "var(--green)" : "var(--red)"} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Gegessen vs BMR Chart */}
        <div className="card card-pad">
          <SectionHeader title="Kalorien gegessen vs. BMR" icon="🍽️" />
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={dayData.filter(d => d.consumed)} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
              <YAxis tick={tickStyle} width={50} />
              <Tooltip {...tt} formatter={(v: number, name: string) => [`${Math.round(v)} kcal`, name === "consumed" ? "Gegessen" : "Grundumsatz"]} />
              <Line type="monotone" dataKey="consumed" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--blue)", strokeWidth: 0 }} />
              <Line type="monotone" dataKey="bmr" stroke="var(--orange)" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Wöchentliche Bilanz */}
        <div className="card card-pad">
          <SectionHeader title="Wöchentliche Bilanz" icon="📅" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weeklyData.length > 0 ? weeklyData.map(w => (
              <div key={w.week} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface2)", borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{w.week}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: w.deficit < 0 ? "var(--green)" : "var(--red)" }}>
                    {w.deficit > 0 ? "+" : ""}{Math.round(w.deficit)} kcal
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                    {w.fatKg > 0 ? "+" : ""}{w.fatKg} kg Fett
                  </span>
                </div>
              </div>
            )) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Keine Wochendaten</p>}
            {weeklyData.length > 0 && (
              <div style={{ padding: "10px 12px", background: totalDeficit < 0 ? "var(--green-dim)" : "var(--red-dim)", borderRadius: 8, border: `1px solid ${totalDeficit < 0 ? "var(--green)" : "var(--red)"}`, marginTop: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: totalDeficit < 0 ? "var(--green)" : "var(--red)" }}>
                  Gesamt: {totalDeficit > 0 ? "+" : ""}{Math.round(totalDeficit)} kcal · {totalFatKg > 0 ? "+" : ""}{totalFatKg.toFixed(2)} kg Fett
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Makronährstoffe */}
      {macroEntries.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <SectionHeader title="Makronährstoffe" icon="🥗" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Ø Kohlenhydrate", value: avgCarbs,   unit: "g/Tag", color: "var(--blue)",   target: null,          icon: "🍞" },
              { label: "Ø Eiweiß",       value: avgProtein, unit: "g/Tag", color: "var(--teal)",   target: proteinTarget, icon: "🥩" },
              { label: "Ø Fett",         value: avgFat,     unit: "g/Tag", color: "var(--orange)", target: null,          icon: "🫒" },
            ].map(k => (
              <div key={k.label} style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>{k.icon} {k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.value != null && k.target != null && k.value >= k.target ? k.color : "var(--text)" }}>
                  {k.value != null ? k.value : "–"}
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 4 }}>{k.unit}</span>
                </div>
                {k.target && k.value != null && (
                  <div style={{ fontSize: 11.5, color: k.value >= k.target ? "var(--teal)" : "var(--orange)", marginTop: 4 }}>
                    {k.value >= k.target ? `✓ Ziel (${k.target} g) erreicht` : `Ziel: ${k.target} g · noch ${k.target - k.value} g`}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Makro-Trend Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={macroEntries} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
              <YAxis tick={tickStyle} width={40} unit="g" />
              <Tooltip {...tt} formatter={(v: number, name: string) => [
                `${Math.round(v)} g`,
                name === "protein" ? "Eiweiß" : name === "carbs" ? "Kohlenhydrate" : "Fett",
              ]} />
              <Legend formatter={(v) => v === "protein" ? "Eiweiß" : v === "carbs" ? "Kohlenhydrate" : "Fett"} />
              <Bar dataKey="protein" fill="var(--teal)"   fillOpacity={0.85} radius={[0, 0, 0, 0]} maxBarSize={20} stackId="a" />
              <Bar dataKey="carbs"   fill="var(--blue)"   fillOpacity={0.85} radius={[0, 0, 0, 0]} maxBarSize={20} stackId="a" />
              <Bar dataKey="fat"     fill="var(--orange)" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={20} stackId="a" />
              {proteinTarget && <ReferenceLine y={proteinTarget} stroke="var(--teal)" strokeDasharray="4 3" strokeWidth={1.5} label={refLabel(`Ziel ${proteinTarget}g`, "var(--teal)")} />}
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Makros stapeln sich (gestapeltes Balkendiagramm) · {macroEntries.length} Tage mit Makro-Daten
          </p>
        </div>
      )}

      {/* Detailtabelle */}
      {dayData.filter(d => d.consumed).length > 0 && (
        <div className="card">
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Alle Einträge</span>
            {onEditDate && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Doppelklick auf Zeile zum Bearbeiten</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th style={{ textAlign: "right" }}>Gegessen</th>
                  <th style={{ textAlign: "right" }}>Bilanz</th>
                  <th style={{ textAlign: "right", color: "var(--blue)" }}>🍞 Carbs</th>
                  <th style={{ textAlign: "right", color: "var(--teal)" }}>🥩 Eiweiß</th>
                  <th style={{ textAlign: "right", color: "var(--orange)" }}>🫒 Fett</th>
                </tr>
              </thead>
              <tbody>
                {dayData.filter(d => d.consumed).map(d => (
                  <tr key={d.raw} onDoubleClick={() => onEditDate?.(d.raw)}
                    style={{ cursor: onEditDate ? "pointer" : undefined }}
                    title={onEditDate ? "Doppelklick zum Bearbeiten" : undefined}>
                    <td style={{ color: "var(--text-2)" }}>{d.full}</td>
                    <td style={{ textAlign: "right" }}>{d.consumed?.toLocaleString("de")} kcal</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: (d.deficit ?? 0) <= 0 ? "var(--green)" : "var(--red)" }}>
                      {d.deficit != null ? `${d.deficit > 0 ? "+" : ""}${d.deficit}` : "–"}
                    </td>
                    <td style={{ textAlign: "right" }}>{d.carbs != null ? `${d.carbs} g` : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                    <td style={{ textAlign: "right", color: "var(--teal)", fontWeight: d.protein && proteinTarget && d.protein >= proteinTarget ? 700 : 400 }}>
                      {d.protein != null ? `${d.protein} g` : <span style={{ color: "var(--text-muted)" }}>–</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>{d.fat != null ? `${d.fat} g` : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
