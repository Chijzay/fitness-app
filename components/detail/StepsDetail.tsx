"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine, LineChart, Line } from "recharts";
import type { DailyLog, DateRange } from "@/app/page";
import { allDatesInRange, fmtShort, fmtFull, tickStyle, gridStyle, tooltipStyle, RangeSelector, KpiCard, SectionHeader } from "@/lib/chartHelpers";
import { formatMinutes } from "@/lib/calculations";

export default function StepsDetail({ logs, allLogs, range, setRange, onEditDate }: {
  logs: DailyLog[]; allLogs: DailyLog[]; range: DateRange; setRange: (r: DateRange) => void;
  onEditDate?: (date: string) => void;
}) {
  const dates = useMemo(() => allDatesInRange(range), [range]);
  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    allLogs.forEach(l => { m[l.date.split("T")[0]] = l; });
    return m;
  }, [allLogs]);

  const stepsData = dates.map(d => ({
    date: fmtShort(d), full: fmtFull(d), raw: d,
    steps: logMap[d]?.steps ?? null,
    duration: logMap[d]?.stepsDuration ?? null,
    type: logMap[d]?.stepsType ?? null,
  }));

  const withSteps = stepsData.filter(d => d.steps != null);
  const total = withSteps.reduce((s, d) => s + (d.steps ?? 0), 0);
  const avg = withSteps.length ? Math.round(total / withSteps.length) : null;
  const max = withSteps.length ? Math.max(...withSteps.map(d => d.steps ?? 0)) : null;
  const goalDays = withSteps.filter(d => (d.steps ?? 0) >= 10000).length;

  // Wöchentliche Zusammenfassung
  const weeklyMap: Record<string, number> = {};
  dates.forEach(d => {
    const log = logMap[d];
    if (!log?.steps) return;
    const dt = new Date(d + "T12:00:00");
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = `KW ${mon.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    weeklyMap[key] = (weeklyMap[key] ?? 0) + log.steps;
  });
  const weeklyData = Object.entries(weeklyMap).map(([week, steps]) => ({ week, steps }));

  // Aktivitätstypen
  const typeMap: Record<string, number> = {};
  withSteps.forEach(d => { if (d.type) typeMap[d.type] = (typeMap[d.type] ?? 0) + 1; });

  const tt = tooltipStyle;

  function exportCSV() {
    const rows = [["Datum", "Schritte", "Dauer (min)", "Art", "Notiz"]];
    dates.forEach(d => {
      const l = logMap[d];
      if (l?.steps) rows.push([fmtFull(d), String(l.steps), String(l.stepsDuration ?? ""), l.stepsType ?? "", l.stepsNotes ?? ""]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "schritte.csv"; a.click();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>🚶 Schritte & Bewegung</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>{withSteps.length} Tage mit Daten im Zeitraum</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangeSelector range={range} setRange={setRange} />
          <button className="btn btn-xs btn-secondary" onClick={exportCSV}>↓ CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="detail-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="👣" label="Gesamt" value={total > 0 ? total.toLocaleString("de") : "–"} sub="Schritte im Zeitraum" />
        <KpiCard icon="📊" label="Tagesdurchschnitt" value={avg ? avg.toLocaleString("de") : "–"}
          sub="pro Tag mit Eintrag"
          color={avg ? (avg >= 10000 ? "var(--green)" : avg >= 7500 ? "var(--orange)" : "var(--red)") : undefined} />
        <KpiCard icon="🏆" label="Rekord" value={max ? max.toLocaleString("de") : "–"} sub="Schritte an einem Tag" />
        <KpiCard icon="✅" label="Ziel erreicht" value={`${goalDays} / ${withSteps.length}`}
          sub="Tage mit ≥ 10.000 Schritten"
          badge={withSteps.length > 0 ? <span className={`badge ${goalDays / withSteps.length >= 0.7 ? "badge-green" : "badge-orange"}`}>{Math.round(goalDays / withSteps.length * 100)} %</span> : undefined} />
      </div>

      {/* Haupt-Chart */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <SectionHeader title="Tägliche Schritte" icon="📈" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stepsData} margin={{ top: 5, right: 85, left: 5, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
            <YAxis tick={tickStyle} width={50} />
            <Tooltip {...tt} formatter={(v: number) => [v?.toLocaleString("de"), "Schritte"]} />
            <ReferenceLine y={10000} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: "10.000 Ziel", fontSize: 10, fill: "var(--orange)", position: "right" }} />
            <Bar dataKey="steps" radius={[5, 5, 0, 0]} maxBarSize={40}>
              {stepsData.map((d, i) => <Cell key={i} fill={(d.steps ?? 0) >= 10000 ? "var(--green)" : "var(--blue)"} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Wöchentliche Summe */}
        <div className="card card-pad">
          <SectionHeader title="Wöchentliche Gesamtschritte" icon="📅" />
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 115, left: 5, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="week" tick={tickStyle} tickLine={false} />
                <YAxis tick={tickStyle} width={55} />
                <Tooltip {...tt} formatter={(v: number) => [v?.toLocaleString("de"), "Schritte gesamt"]} />
                <ReferenceLine y={70000} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: "70.000 Wochenziel", fontSize: 10, fill: "var(--orange)", position: "right" }} />
                <Bar dataKey="steps" radius={[5, 5, 0, 0]} fill="var(--blue)" fillOpacity={0.8} maxBarSize={50}>
                  {weeklyData.map((d, i) => <Cell key={i} fill={d.steps >= 70000 ? "var(--green)" : "var(--blue)"} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Keine Wochendaten</p>}
        </div>

        {/* Aktivitätstypen */}
        <div className="card card-pad">
          <SectionHeader title="Aktivitätsarten" icon="🏃" />
          {Object.keys(typeMap).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{type}</span>
                    <span style={{ color: "var(--text-muted)" }}>{count}× · {Math.round(count / withSteps.length * 100)} %</span>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${count / withSteps.length * 100}%`, background: "var(--blue)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Keine Aktivitätstypen eingetragen</p>}
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
                <th style={{ textAlign: "right" }}>Schritte</th>
                <th style={{ textAlign: "right" }}>Dauer</th>
                <th>Art</th>
                <th>Notiz</th>
                <th style={{ textAlign: "center" }}>Ziel</th>
              </tr>
            </thead>
            <tbody>
              {stepsData.filter(d => d.steps != null).map(d => (
                <tr key={d.date} onDoubleClick={() => onEditDate?.(d.raw)}
                  style={{ cursor: onEditDate ? "pointer" : undefined }}
                  title={onEditDate ? "Doppelklick zum Bearbeiten" : undefined}>
                  <td style={{ color: "var(--text-2)" }}>{d.full}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{d.steps?.toLocaleString("de")}</td>
                  <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{d.duration ? formatMinutes(d.duration) : "–"}</td>
                  <td>{d.type ?? "–"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{logMap[dates.find(x => fmtShort(x) === d.date) ?? ""]?.stepsNotes ?? "–"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span className={`badge ${(d.steps ?? 0) >= 10000 ? "badge-green" : "badge-red"}`}>
                      {(d.steps ?? 0) >= 10000 ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
