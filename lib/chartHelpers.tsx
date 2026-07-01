import type { DateRange } from "@/app/page";

export function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function fmtShort(s: string) {
  const d = new Date(s + "T12:00:00");
  return `${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")}`;
}
export function fmtFull(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
export function allDatesInRange(range: DateRange): string[] {
  const from = new Date(range.from); const to = new Date(range.to);
  const dates: string[] = []; let cur = new Date(from);
  while (cur <= to) { dates.push(dateStr(cur)); cur = addDays(cur, 1); }
  return dates;
}

const PRESETS_DEF = [
  { label: "7 T", days: 7 }, { label: "14 T", days: 14 },
  { label: "30 T", days: 30 }, { label: "90 T", days: 90 }, { label: "180 T", days: 180 },
];

export function RangeSelector({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) {
  const days = Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1;
  function setPreset(d: number) {
    const to = new Date(); const from = addDays(to, -(d - 1));
    setRange({ from: dateStr(from), to: dateStr(to) });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {PRESETS_DEF.map(p => (
        <button key={p.days} className={`btn btn-xs ${days === p.days ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setPreset(p.days)}>{p.label}</button>
      ))}
      <div className="range-date-inputs" style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
        <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })
        } style={{ width: 130, fontSize: 12 }} />
        <span style={{ color: "var(--text-muted)" }}>–</span>
        <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })}
          style={{ width: 130, fontSize: 12 }} />
      </div>
    </div>
  );
}

// Dark-theme chart defaults
export const tickStyle = { fontSize: 10.5, fill: "#8b949e" };
export const gridStyle = { stroke: "#2a3348", strokeDasharray: "3 3" };
export const tooltipStyle = {
  contentStyle: {
    background: "#1c2333", border: "1px solid #2a3348",
    borderRadius: 10, fontSize: 12.5, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
    color: "#e6edf3",
  },
  labelStyle: { color: "#8b949e", marginBottom: 4, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  itemStyle: { color: "#e6edf3" },
  cursor: { fill: "rgba(0,212,180,0.04)" },
};

export function KpiCard({ label, value, sub, color, icon, badge, onClick }: {
  label: string; value: string; sub?: string; color?: string;
  icon?: string; badge?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div className={`kpi-card${onClick ? " card-clickable" : ""}`} onClick={onClick}>
      <div className="kpi-label">
        {icon && <span>{icon}</span>}{label}
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </div>
      <div className="kpi-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function SectionHeader({ title, icon, right }: { title: string; icon: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div className="section-head-icon">{icon}</div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1 }}>{title}</span>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, entryCount, right }: {
  title: string; sub?: string; entryCount?: number; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 4 }}>{title}</h2>
        {(sub || entryCount != null) && (
          <p style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
            {sub}{entryCount != null && ` · ${entryCount} Einträge`}
          </p>
        )}
        <div style={{ width: 32, height: 2.5, background: "var(--teal)", borderRadius: 99, marginTop: 8, boxShadow: "0 0 6px var(--teal-glow)" }} />
      </div>
      {right}
    </div>
  );
}

export function WeekRow({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--surface2)", borderRadius: 8 }}>
      <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: valueColor ?? "var(--text)" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}
