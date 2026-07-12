"use client";
import { useMemo } from "react";
import { BarChart, Bar, ComposedChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from "recharts";
import type { DailyLog, DateRange } from "@/app/page";
import { allDatesInRange, fmtShort, fmtFull, tickStyle, gridStyle, tooltipStyle, RangeSelector, KpiCard, SectionHeader } from "@/lib/chartHelpers";
import { calcSleepScore, formatMinutes } from "@/lib/calculations";

function fmtHours(min: number | null | undefined): string {
  if (!min) return "–";
  return (min / 60).toFixed(1) + "h";
}

export default function SleepDetail({ logs, allLogs, range, setRange, onEditDate }: {
  logs: DailyLog[]; allLogs: DailyLog[]; range: DateRange; setRange: (r: DateRange) => void;
  onEditDate?: (date: string) => void;
}) {
  const dates = useMemo(() => allDatesInRange(range), [range]);
  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    allLogs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [allLogs]);

  const sleepData = dates.map(d => {
    const log = logMap[d];
    const score = calcSleepScore(log?.sleepActual ?? null, log?.sleepDeep ?? null, log?.sleepTotal ?? null);
    const actual = log?.sleepActual ?? null;
    const deep = log?.sleepDeep ?? null;
    // lightSleep = actual minus deep sleep (for stacked bar)
    const lightSleep = actual != null ? (deep != null ? actual - deep : actual) : null;
    return {
      date: fmtShort(d), full: fmtFull(d), raw: d,
      total: log?.sleepTotal ?? null,
      actual,
      deep,
      lightSleep,
      quality: log?.sleepQuality ?? null,
      score,
    };
  });

  const withData = sleepData.filter(d => d.actual != null);
  const totalActual = withData.reduce((s, d) => s + (d.actual ?? 0), 0);
  const totalDeep = withData.filter(d => d.deep).reduce((s, d) => s + (d.deep ?? 0), 0);
  const avgActual = withData.length ? Math.round(totalActual / withData.length) : null;
  const avgDeep = withData.filter(d => d.deep).length
    ? Math.round(totalDeep / withData.filter(d => d.deep).length) : null;
  const avgScore = withData.filter(d => d.score).length
    ? Math.round(withData.filter(d => d.score).reduce((s, d) => s + (d.score ?? 0), 0) / withData.filter(d => d.score).length) : null;
  const avgDeepPct = avgActual && avgDeep ? Math.round(avgDeep / avgActual * 100) : null;
  const goodNights = withData.filter(d => (d.actual ?? 0) >= 420).length;

  // Wöchentlich
  const weeklyMap: Record<string, { total: number; count: number; deep: number; deepCount: number }> = {};
  dates.forEach(d => {
    const entry = sleepData.find(x => x.full === fmtFull(d));
    if (!entry?.actual) return;
    const dt = new Date(d + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = `KW ${mon.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    if (!weeklyMap[key]) weeklyMap[key] = { total: 0, count: 0, deep: 0, deepCount: 0 };
    weeklyMap[key].total += entry.actual; weeklyMap[key].count++;
    if (entry.deep) { weeklyMap[key].deep += entry.deep; weeklyMap[key].deepCount++; }
  });
  const weeklyData = Object.entries(weeklyMap).map(([week, d]) => ({
    week,
    avgActual: Math.round(d.total / d.count),
    totalActual: d.total,
    avgDeep: d.deepCount ? Math.round(d.deep / d.deepCount) : null,
  }));

  const tt = tooltipStyle;

  function exportCSV() {
    const rows = [["Datum", "Im Bett (min)", "Geschlafen (min)", "Tiefschlaf (min)", "Qualität (1-5)", "Score"]];
    withData.forEach(d => rows.push([d.full, String(d.total ?? ""), String(d.actual ?? ""), String(d.deep ?? ""), String(d.quality ?? ""), String(d.score ?? "")]));
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "schlaf.csv"; a.click();
  }

  const scoreColor = (s: number | null) => s == null ? "var(--text-muted)" : s >= 75 ? "var(--green)" : s >= 50 ? "var(--orange)" : "var(--red)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>😴 Schlafauswertung</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>{withData.length} Nächte mit Daten · Gesamt: {formatMinutes(totalActual)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangeSelector range={range} setRange={setRange} />
          <button className="btn btn-xs btn-secondary" onClick={exportCSV}>↓ CSV</button>
        </div>
      </div>

      <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="🕐" label="Ø Schlafdauer" value={avgActual ? fmtHours(avgActual) : "–"}
          sub="pro Nacht (tatsächlich)"
          color={avgActual ? (avgActual >= 420 ? "var(--green)" : avgActual >= 300 ? "var(--orange)" : "var(--red)") : undefined} />
        <KpiCard icon="🌊" label="Ø Tiefschlaf" value={avgDeep ? formatMinutes(avgDeep) : "–"}
          sub={avgDeepPct ? `${avgDeepPct} % der Schlafdauer (Ziel: 22 %)` : undefined}
          color={avgDeepPct ? (avgDeepPct >= 20 ? "var(--green)" : avgDeepPct >= 15 ? "var(--orange)" : "var(--red)") : undefined} />
        <KpiCard icon="⭐" label="Ø Schlaf-Score" value={avgScore != null ? `${avgScore}/100` : "–"}
          sub="aus Dauer + Tiefschlafanteil"
          color={scoreColor(avgScore)} />
        <KpiCard icon="✅" label="Gute Nächte" value={`${goodNights} / ${withData.length}`}
          sub="Nächte mit ≥ 7h Schlaf"
          badge={withData.length > 0 ? <span className={`badge ${goodNights / withData.length >= 0.7 ? "badge-green" : "badge-orange"}`}>{Math.round(goodNights / withData.length * 100)} %</span> : undefined} />
      </div>

      {/* Haupt-Chart: Schlafdauer — gestapelt: Tiefschlaf (unten) + Leichtschlaf (oben) */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <SectionHeader title="Schlafdauer (Nächte)" icon="📈" />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sleepData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
            <YAxis tick={tickStyle} width={42} tickFormatter={v => fmtHours(v)} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as typeof sleepData[0];
              if (!d.actual) return null;
              const deepPct = d.actual && d.deep ? Math.round(d.deep / d.actual * 100) : null;
              return (
                <div style={{ ...tt.contentStyle, padding: "10px 14px", fontSize: 13, minWidth: 180 }}>
                  <p style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{d.full}</p>
                  {d.total != null && <p style={{ color: "var(--text-2)", marginBottom: 3 }}>🛏 Im Bett: <b>{fmtHours(d.total)}</b></p>}
                  {d.actual != null && <p style={{ color: (d.actual >= 420 ? "var(--purple)" : "var(--blue)"), marginBottom: 3 }}>💤 Geschlafen: <b>{fmtHours(d.actual)}</b></p>}
                  {d.deep != null && <p style={{ color: "var(--green)", marginBottom: 3 }}>🌊 Tiefschlaf: <b>{formatMinutes(d.deep)}</b>{deepPct != null ? ` (${deepPct} %)` : ""}</p>}
                  {d.quality != null && <p style={{ color: "var(--text-muted)", marginBottom: 3 }}>⭐ Qualität: <b>{d.quality}/100</b></p>}
                  {d.score != null && (
                    <div style={{ borderTop: "1px solid var(--border2)", marginTop: 6, paddingTop: 6 }}>
                      <p style={{ fontWeight: 700, color: d.score >= 75 ? "var(--green)" : d.score >= 50 ? "var(--orange)" : "var(--red)" }}>
                        Score: {d.score}/100
                      </p>
                    </div>
                  )}
                </div>
              );
            }} />
            <ReferenceLine y={420} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: "7h", fontSize: 10, fill: "var(--orange)", position: "right" }} />
            {/* Tiefschlaf unten (grün) */}
            <Bar dataKey="deep" stackId="sleep" maxBarSize={44} radius={[0, 0, 4, 4]} fill="var(--green)" fillOpacity={0.85} />
            {/* Leichtschlaf oben (blau/lila) */}
            <Bar dataKey="lightSleep" stackId="sleep" maxBarSize={44} radius={[4, 4, 0, 0]}>
              {sleepData.map((d, i) => (
                <Cell key={i}
                  fill={(d.actual ?? 0) >= 420 ? "var(--purple)" : "var(--blue)"}
                  fillOpacity={d.lightSleep ? 0.75 : 0} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--purple)", display: "inline-block" }} />
            ≥ 7h Schlaf
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--blue)", display: "inline-block" }} />
            &lt; 7h Schlaf
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--green)", display: "inline-block" }} />
            Tiefschlaf (unten)
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Score-Chart */}
        <div className="card card-pad">
          <SectionHeader title="Schlaf-Score Verlauf" icon="⭐" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sleepData.filter(d => d.score != null)} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
              <YAxis domain={[0, 100]} tick={tickStyle} width={40} />
              <Tooltip {...tt} formatter={(v: number) => [`${v}/100`, "Score"]} />
              <ReferenceLine y={75} stroke="var(--green)" strokeDasharray="4 3" label={{ value: "Gut", fontSize: 10, fill: "var(--green)" }} />
              <ReferenceLine y={50} stroke="var(--orange)" strokeDasharray="4 3" label={{ value: "Ok", fontSize: 10, fill: "var(--orange)" }} />
              <Line type="monotone" dataKey="score" stroke="var(--purple)" strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--purple)", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Wöchentliche Zusammenfassung */}
        <div className="card card-pad">
          <SectionHeader title="Wöchentliche Zusammenfassung" icon="📅" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weeklyData.length > 0 ? weeklyData.map(w => (
              <div key={w.week} style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{w.week}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Gesamt: {formatMinutes(w.totalActual)}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Ø Nacht: <strong style={{ color: "var(--text)" }}>{formatMinutes(w.avgActual)}</strong></span>
                  {w.avgDeep && <span>Ø Tiefschlaf: <strong style={{ color: "var(--green)" }}>{formatMinutes(w.avgDeep)}</strong></span>}
                </div>
              </div>
            )) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Keine Wochendaten</p>}
            {withData.length > 0 && (
              <div style={{ padding: "10px 14px", background: "var(--teal-dim)", borderRadius: 8, fontSize: 13 }}>
                <strong>Gesamt {dates.length} Tage:</strong> {formatMinutes(totalActual)} geschlafen
                {totalDeep > 0 && ` · ${formatMinutes(totalDeep)} Tiefschlaf`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailtabelle */}
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
                <th style={{ textAlign: "right" }}>Im Bett</th>
                <th style={{ textAlign: "right" }}>Geschlafen</th>
                <th style={{ textAlign: "right" }}>Tiefschlaf</th>
                <th style={{ textAlign: "right" }}>Tiefschlaf %</th>
                <th style={{ textAlign: "center" }}>Qualität</th>
                <th style={{ textAlign: "right" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {withData.map(d => {
                const deepPct = d.actual && d.deep ? Math.round(d.deep / d.actual * 100) : null;
                return (
                  <tr key={d.date} onDoubleClick={() => onEditDate?.(d.raw)}
                    style={{ cursor: onEditDate ? "pointer" : undefined }}
                    title={onEditDate ? "Doppelklick zum Bearbeiten" : undefined}>
                    <td style={{ color: "var(--text-2)" }}>{d.full}</td>
                    <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{fmtHours(d.total)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: (d.actual ?? 0) >= 420 ? "var(--green)" : "var(--red)" }}>{fmtHours(d.actual)}</td>
                    <td style={{ textAlign: "right", color: "var(--text-2)" }}>{d.deep ? formatMinutes(d.deep) : "–"}</td>
                    <td style={{ textAlign: "right", color: deepPct != null ? (deepPct >= 20 ? "var(--green)" : deepPct >= 15 ? "var(--orange)" : "var(--red)") : "var(--text-muted)" }}>
                      {deepPct != null ? `${deepPct} %` : "–"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {d.quality != null ? (
                        <span style={{ fontWeight: 700, color: d.quality >= 75 ? "var(--green)" : d.quality >= 50 ? "var(--orange)" : "var(--red)" }}>
                          {d.quality}/100
                        </span>
                      ) : "–"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: scoreColor(d.score) }}>
                      {d.score != null ? `${d.score}/100` : "–"}
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
