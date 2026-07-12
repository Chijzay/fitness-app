"use client";
import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { RangeSelector, KpiCard, SectionHeader, PageHeader, tickStyle, gridStyle, tooltipStyle } from "@/lib/chartHelpers";
import type { DateRange } from "@/app/page";

type Measurement = {
  id: number; date: string;
  waist?: number; belly?: number; hip?: number;
  chest?: number; upperArm?: number; thigh?: number; neck?: number; calf?: number;
  notes?: string;
};

const METRICS: { key: keyof Measurement; label: string; color: string }[] = [
  { key: "waist",    label: "Taille",        color: "var(--teal)" },
  { key: "belly",    label: "Bauch",         color: "var(--orange)" },
  { key: "hip",      label: "Hüfte",         color: "var(--purple)" },
  { key: "chest",    label: "Brust",         color: "var(--blue)" },
  { key: "upperArm", label: "Oberarm",       color: "var(--green)" },
  { key: "thigh",    label: "Oberschenkel",  color: "#f472b6" },
  { key: "neck",     label: "Nacken",        color: "#94a3b8" },
  { key: "calf",     label: "Wade",          color: "#fb923c" },
];

function fmtDate(s: string) {
  const d = new Date(s.split("T")[0] + "T12:00:00");
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
}

export default function MeasurementsDetail({
  range, setRange, onEditDate,
}: {
  range: DateRange; setRange: (r: DateRange) => void; onEditDate?: (date: string) => void;
}) {
  const [data, setData] = useState<Measurement[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set(["belly", "chest", "thigh"]));

  useEffect(() => {
    fetch(`/api/measurements?from=${range.from}&to=${range.to}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [range]);

  const latest = data.at(-1);
  const first  = data[0];

  const chartData = useMemo(() => data.map(m => ({
    date: fmtDate(m.date),
    waist:    m.waist    ?? null,
    belly:    m.belly    ?? null,
    hip:      m.hip      ?? null,
    chest:    m.chest    ?? null,
    upperArm: m.upperArm ?? null,
    thigh:    m.thigh    ?? null,
    neck:     m.neck     ?? null,
    calf:     m.calf     ?? null,
  })), [data]);

  function toggle(key: string) {
    setVisible(v => {
      const n = new Set(v);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function delta(key: keyof Measurement) {
    if (!latest || !first || latest === first) return null;
    const a = latest[key] as number | undefined;
    const b = first[key] as number | undefined;
    if (a == null || b == null) return null;
    return +(a - b).toFixed(1);
  }

  const tt = { ...tooltipStyle, formatter: (v: unknown) => [`${v} cm`] };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="📏 Körpermaße" sub="Umfänge in cm" entryCount={data.length} />

      <div style={{ marginBottom: 4 }}>
        <RangeSelector range={range} setRange={setRange} />
      </div>

      {data.length === 0 && (
        <div className="card card-pad" style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 40 }}>
          Noch keine Körpermaße im ausgewählten Zeitraum eingetragen.
        </div>
      )}

      {data.length > 0 && (
        <>
          {/* KPI Grid — latest values + delta */}
          <div className="card card-pad">
            <SectionHeader title="Aktuelle Werte" icon="📏" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {METRICS.map(m => {
                const val = latest?.[m.key] as number | undefined;
                const d   = delta(m.key);
                return (
                  <KpiCard
                    key={m.key}
                    label={m.label}
                    value={val != null ? `${val} cm` : "–"}
                    sub={d != null ? `${d > 0 ? "+" : ""}${d} cm vs. Anfang` : undefined}
                    color={d != null ? (d < 0 ? "var(--green)" : "var(--red)") : undefined}
                  />
                );
              })}
            </div>
          </div>

          {/* Verlauf Chart */}
          <div className="card card-pad">
            <SectionHeader title="Verlauf" icon="📉" />
            {/* Toggle buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {METRICS.map(m => (
                <button key={m.key}
                  onClick={() => toggle(m.key)}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                    background: visible.has(m.key) ? m.color + "22" : "var(--surface2)",
                    color: visible.has(m.key) ? m.color : "var(--text-muted)",
                    border: `1px solid ${visible.has(m.key) ? m.color : "var(--border2)"}`,
                  }}>{m.label}</button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
                <YAxis tick={tickStyle} unit=" cm" width={52} domain={["auto", "auto"]} />
                <Tooltip {...tt} />
                {METRICS.filter(m => visible.has(m.key as string)).map(m => (
                  <Line key={m.key} type="monotone" dataKey={m.key as string}
                    stroke={m.color} strokeWidth={2} dot={{ r: 4, fill: m.color, strokeWidth: 0 }}
                    connectNulls name={m.label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabelle */}
          <div className="card">
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
              📋 Alle Einträge
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 14px", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>Datum</th>
                    {METRICS.map(m => (
                      <th key={m.key} style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((row, i) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--border)", cursor: onEditDate ? "pointer" : undefined }}
                      onDoubleClick={() => onEditDate?.(row.date.split("T")[0])}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
                        {new Date(row.date.split("T")[0] + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      {METRICS.map(m => {
                        const val = row[m.key] as number | undefined;
                        const prevRow = [...data].reverse()[i + 1];
                        const prev = prevRow?.[m.key] as number | undefined;
                        const d = val != null && prev != null ? +(val - prev).toFixed(1) : null;
                        return (
                          <td key={m.key} style={{ padding: "9px 10px", textAlign: "right", color: val != null ? "var(--text)" : "var(--text-muted)" }}>
                            {val != null ? (
                              <span>
                                {val}
                                {d != null && <span style={{ fontSize: 10, marginLeft: 4, color: d < 0 ? "var(--green)" : "var(--red)" }}>{d > 0 ? "+" : ""}{d}</span>}
                              </span>
                            ) : "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
