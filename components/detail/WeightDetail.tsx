"use client";
import { useMemo } from "react";
import { ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from "recharts";
import type { DailyLog, DateRange, Profile } from "@/app/page";
import { allDatesInRange, fmtShort, fmtFull, tickStyle, gridStyle, tooltipStyle, RangeSelector, KpiCard, SectionHeader } from "@/lib/chartHelpers";
import { calcBMR, estimateBodyFat } from "@/lib/calculations";

export default function WeightDetail({ logs, allLogs, profile, range, setRange, onEditDate }: {
  logs: DailyLog[]; allLogs: DailyLog[]; profile: Profile; range: DateRange; setRange: (r: DateRange) => void;
  onEditDate?: (date: string) => void;
}) {
  const dates = useMemo(() => allDatesInRange(range), [range]);
  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    allLogs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [allLogs]);

  const weightEntries = dates
    .map(d => ({ raw: d, weight: logMap[d]?.weight ?? null, bf: logMap[d]?.bodyFatPercent ?? null }))
    .filter(d => d.weight != null);

  // Wöchentliche Durchschnitte für Balken
  const weeklyAvgMap: Record<string, { sum: number; count: number }> = {};
  weightEntries.forEach(d => {
    const dt = new Date(d.raw + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = mon.toISOString().split("T")[0];
    if (!weeklyAvgMap[key]) weeklyAvgMap[key] = { sum: 0, count: 0 };
    weeklyAvgMap[key].sum += d.weight ?? 0;
    weeklyAvgMap[key].count++;
  });

  // Chart-Daten: tägliches Gewicht als Linie + Wochenanfang-Avg als Balken
  const chartData = dates.map(d => {
    const dt = new Date(d + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const weekKey = mon.toISOString().split("T")[0];
    const isMonday = dt.getDay() === 1;
    const weekAvg = weeklyAvgMap[weekKey];
    return {
      date: fmtShort(d), raw: d,
      weight: logMap[d]?.weight ?? null,
      bf: logMap[d]?.bodyFatPercent ?? null,
      weekAvg: isMonday && weekAvg ? +(weekAvg.sum / weekAvg.count).toFixed(1) : null,
    };
  });

  const firstW = weightEntries[0]?.weight ?? null;
  const lastW = [...weightEntries].reverse()[0]?.weight ?? null;
  const diff = firstW && lastW ? +(lastW - firstW).toFixed(1) : null;

  // Lineare Regression Trend
  const withIdx = weightEntries.map((d, i) => ({ i, w: d.weight ?? 0 }));
  let trendSlope = 0;
  if (withIdx.length >= 2) {
    const n = withIdx.length;
    const sumX = withIdx.reduce((s, d) => s + d.i, 0);
    const sumY = withIdx.reduce((s, d) => s + d.w, 0);
    const sumXY = withIdx.reduce((s, d) => s + d.i * d.w, 0);
    const sumX2 = withIdx.reduce((s, d) => s + d.i * d.i, 0);
    trendSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }
  const weeklyTrend = +(trendSlope * 7).toFixed(2);

  // Körperfett
  const latestBF = [...weightEntries].reverse().find(d => d.bf)?.bf;
  const estimatedBF = lastW ? estimateBodyFat(lastW, profile.height, profile.gender, new Date(profile.birthdate)) : null;
  const bfUsed = latestBF ?? estimatedBF;
  const fatMass = lastW && bfUsed ? +(lastW * bfUsed / 100).toFixed(1) : null;
  const leanMass = lastW && fatMass ? +(lastW - fatMass).toFixed(1) : null;

  // Wöchentliche Bilanz für Tabelle
  const weeklyBilanz = Object.entries(weeklyAvgMap).map(([key, { sum, count }]) => {
    const avg = +(sum / count).toFixed(1);
    const dt = new Date(key + "T12:00:00");
    return {
      week: `KW ${dt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
      avg,
    };
  });

  const tt = tooltipStyle;

  function exportCSV() {
    const rows = [["Datum", "Gewicht (kg)", "Körperfett (%)"]];
    weightEntries.forEach(d => rows.push([d.raw, String(d.weight ?? ""), String(d.bf ?? "")]));
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gewicht.csv"; a.click();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>⚖️ Gewichtsverlauf</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>{weightEntries.length} Messungen im Zeitraum</p>
          <div style={{ width: 32, height: 2.5, background: "var(--teal)", borderRadius: 99, marginTop: 8 }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangeSelector range={range} setRange={setRange} />
          <button className="btn btn-xs btn-secondary" onClick={exportCSV}>↓ CSV</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="⚖️" label="Aktuell" value={lastW ? `${lastW} kg` : "–"} />
        <KpiCard icon="📉" label="Veränderung" value={diff != null ? `${diff > 0 ? "+" : ""}${diff} kg` : "–"}
          sub="seit Beginn des Zeitraums"
          color={diff == null ? undefined : diff < 0 ? "var(--green)" : diff > 0 ? "var(--red)" : "var(--text-muted)"}
          badge={diff != null ? <span className={`badge ${diff < 0 ? "badge-green" : diff > 0 ? "badge-red" : "badge-gray"}`}>{diff < 0 ? "▼" : diff > 0 ? "▲" : "="}</span> : undefined} />
        <KpiCard icon="📈" label="Trend / Woche" value={weeklyTrend !== 0 ? `${weeklyTrend > 0 ? "+" : ""}${weeklyTrend} kg` : "–"}
          sub="Lineare Regression"
          color={weeklyTrend < 0 ? "var(--green)" : weeklyTrend > 0 ? "var(--red)" : undefined} />
        <KpiCard icon="📏" label="Körperfett"
          value={bfUsed ? `${bfUsed.toFixed(1)} %` : "–"}
          sub={latestBF ? `Fett: ${fatMass} kg · Mager: ${leanMass} kg` : "Geschätzt (BMI)"}
          color={bfUsed ? (bfUsed > 25 ? "var(--orange)" : "var(--green)") : undefined} />
      </div>

      {/* Haupt-Chart: Balken (Wochenavg) + Linie (täglich) — wie Referenzbild */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <SectionHeader title="Gewicht: Tagesverlauf (Linie) + Wochenavg (Balken)" icon="📊" />
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={tickStyle} width={50} unit=" kg" yAxisId="left" />
            <YAxis domain={["auto", "auto"]} tick={tickStyle} width={50} unit=" kg" yAxisId="right" orientation="right" hide />
            <Tooltip {...tt} formatter={(v: number, name: string) => [
              `${v} kg`, name === "weight" ? "Tagesgewicht" : "Ø Woche"
            ]} />
            {/* Wochenavg als Balken (türkis-gedimmt) */}
            <Bar dataKey="weekAvg" yAxisId="left" maxBarSize={28} radius={[6, 6, 0, 0]} fill="var(--teal)" fillOpacity={0.18} />
            {/* Tägliches Gewicht als Linie */}
            <Line type="monotone" dataKey="weight" yAxisId="left" stroke="var(--teal)" strokeWidth={2.5}
              dot={{ r: 4, fill: "var(--teal)", strokeWidth: 0 }} connectNulls activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 20, height: 3, borderRadius: 2, background: "var(--teal)", display: "inline-block" }} />
            Tagesgewicht
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 12, borderRadius: 3, background: "var(--teal)", opacity: 0.35, display: "inline-block" }} />
            Wochendurchschnitt
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Körperfett als Balken + Linie */}
        <div className="card card-pad">
          <SectionHeader title="Körperfett %" icon="🏃" />
          {chartData.some(d => d.bf) ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData.filter(d => d.bf)} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                <YAxis domain={["auto", "auto"]} tick={tickStyle} width={40} unit="%" />
                <Tooltip {...tt} formatter={(v: number) => [`${v} %`, "Körperfett"]} />
                <ReferenceLine y={25} stroke="var(--orange)" strokeDasharray="4 3"
                  label={{ value: "25%", fontSize: 10, fill: "var(--orange)" }} />
                <Bar dataKey="bf" maxBarSize={28} radius={[4, 4, 0, 0]} fill="var(--orange)" fillOpacity={0.22} />
                <Line type="monotone" dataKey="bf" stroke="var(--orange)" strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--orange)", strokeWidth: 0 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "30px 0", color: "var(--text-muted)", fontSize: 13 }}>
              Kein Körperfett manuell eingetragen.<br />
              <span style={{ fontSize: 12 }}>Geschätzt aus BMI: {estimatedBF?.toFixed(1) ?? "–"} %</span>
            </div>
          )}
        </div>

        {/* Wöchentliche Veränderung als Balkendiagramm */}
        <div className="card card-pad">
          <SectionHeader title="Wöchentlicher Durchschnitt" icon="📅" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weeklyBilanz.length > 0 ? weeklyBilanz.map((w, i) => {
              const prev = weeklyBilanz[i - 1]?.avg ?? null;
              const diff = prev != null ? +(w.avg - prev).toFixed(1) : null;
              return (
                <div key={w.week} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--surface2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{w.week}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{w.avg} kg</div>
                    {diff != null && (
                      <div style={{ fontSize: 12, color: diff < 0 ? "var(--green)" : diff > 0 ? "var(--red)" : "var(--text-muted)" }}>
                        {diff > 0 ? "+" : ""}{diff} kg zur Vorwoche
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Keine Wochendaten</p>}
          </div>
        </div>
      </div>

      {/* Detailtabelle */}
      {weightEntries.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Alle Messungen</span>
            {onEditDate && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Doppelklick auf Zeile zum Bearbeiten</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th style={{ textAlign: "right" }}>Gewicht (kg)</th>
                  <th style={{ textAlign: "right" }}>Körperfett %</th>
                  <th style={{ textAlign: "right" }}>Fettmasse (kg)</th>
                  <th style={{ textAlign: "right" }}>Magermasse (kg)</th>
                </tr>
              </thead>
              <tbody>
                {weightEntries.map(d => {
                  const fatM = d.weight && d.bf ? +(d.weight * d.bf / 100).toFixed(1) : null;
                  const leanM = d.weight && fatM ? +(d.weight - fatM).toFixed(1) : null;
                  return (
                    <tr key={d.raw} onDoubleClick={() => onEditDate?.(d.raw)}
                      style={{ cursor: onEditDate ? "pointer" : undefined }}
                      title={onEditDate ? "Doppelklick zum Bearbeiten" : undefined}>
                      <td style={{ color: "var(--text-2)" }}>{fmtFull(d.raw)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{d.weight}</td>
                      <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{d.bf ? `${d.bf} %` : "–"}</td>
                      <td style={{ textAlign: "right", color: "var(--orange)" }}>{fatM ?? "–"}</td>
                      <td style={{ textAlign: "right", color: "var(--blue)" }}>{leanM ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Körperzusammensetzung */}
      {bfUsed && lastW && (
        <div className="card card-pad">
          <SectionHeader title="Körperzusammensetzung" icon="🧬" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Gesamtgewicht", value: `${lastW} kg`, color: "var(--text)" },
              { label: "Körperfett", value: `${fatMass} kg`, sub: `${bfUsed.toFixed(1)} %`, color: "var(--orange)" },
              { label: "Magermasse", value: `${leanMass} kg`, sub: `${(100 - bfUsed).toFixed(1)} %`, color: "var(--blue)" },
              { label: "BMR (aktuell)", value: `${Math.round(calcBMR(lastW, profile.height, profile.gender, new Date(profile.birthdate)))} kcal`, color: "var(--teal)" },
            ].map(k => (
              <div key={k.label} style={{ textAlign: "center", padding: "14px", background: "var(--surface2)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{k.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
