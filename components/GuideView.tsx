"use client";
import { useEffect, useState, useRef } from "react";

// ── Minimal Markdown → React renderer ─────────────────────────────────────────

type Token =
  | { t: "h1" | "h2" | "h3"; text: string; id: string }
  | { t: "hr" }
  | { t: "blockquote"; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "ul"; items: { text: string; sub: boolean }[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; text: string }
  | { t: "p"; text: string }
  | { t: "visual"; name: string }
  | { t: "blank" };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");
}

function parseInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code`, and escaped chars
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        parts.push(<strong key={i}>{text.slice(i + 2, end)}</strong>);
        i = end + 2; continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        parts.push(<em key={i}>{text.slice(i + 1, end)}</em>);
        i = end + 1; continue;
      }
    }
    if (text[i] === "[") {
      const cb = text.indexOf("]", i + 1);
      if (cb !== -1 && text[cb + 1] === "(") {
        const cp = text.indexOf(")", cb + 2);
        if (cp !== -1) {
          const href = text.slice(cb + 2, cp);
          const ltext = text.slice(i + 1, cb);
          parts.push(
            <a key={i} href={href} style={{ color: "var(--teal)", textDecoration: "none" }}
              onClick={e => { if (href.startsWith("#")) { e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); } }}>
              {ltext}
            </a>
          );
          i = cp + 1; continue;
        }
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        parts.push(
          <code key={i} style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 4, fontSize: "0.875em", color: "var(--teal)", fontFamily: "monospace" }}>
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1; continue;
      }
    }
    // Collect plain text
    let j = i + 1;
    while (j < text.length && text[j] !== "*" && text[j] !== "`") j++;
    parts.push(text.slice(i, j));
    i = j;
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function tokenize(md: string): Token[] {
  const lines = md.split("\n");
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { tokens.push({ t: "blank" }); i++; continue; }
    if (trimmed.startsWith("# ")) { tokens.push({ t: "h1", text: trimmed.slice(2), id: slugify(trimmed.slice(2)) }); i++; continue; }
    if (trimmed.startsWith("## ")) { tokens.push({ t: "h2", text: trimmed.slice(3), id: slugify(trimmed.slice(3)) }); i++; continue; }
    if (trimmed.startsWith("### ")) { tokens.push({ t: "h3", text: trimmed.slice(4), id: slugify(trimmed.slice(4)) }); i++; continue; }
    if (trimmed.startsWith("#### ")) { tokens.push({ t: "h3", text: trimmed.slice(5), id: slugify(trimmed.slice(5)) }); i++; continue; }
    if (trimmed === "---") { tokens.push({ t: "hr" }); i++; continue; }

    if (trimmed.startsWith("> ")) {
      tokens.push({ t: "blockquote", text: trimmed.slice(2) });
      i++; continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]); i++;
      }
      tokens.push({ t: "code", text: codeLines.join("\n") });
      i++; continue;
    }

    // Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [trimmed];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim()); i++;
      }
      const parseRow = (r: string) => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).filter(r => !r.match(/^\|[-| :]+\|$/)).map(parseRow);
      tokens.push({ t: "table", head, rows }); continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: { text: string; sub: boolean }[] = [{ text: trimmed.slice(2), sub: false }];
      i++;
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        const raw = lines[i];
        const sub = /^\s{3,}/.test(raw);
        items.push({ text: raw.trim().slice(2), sub }); i++;
      }
      tokens.push({ t: "ul", items }); continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [trimmed.replace(/^\d+\.\s/, "")];
      i++;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, "")); i++;
      }
      tokens.push({ t: "ol", items }); continue;
    }

    // Skip TOC links [text](#anchor)
    if (trimmed.match(/^\[.+\]\(#.+\)$/)) { i++; continue; }

    // HTML comment visuals: <!-- visual:name -->
    if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
      const m = trimmed.match(/<!--\s*visual:(\w+)\s*-->/);
      if (m) { tokens.push({ t: "visual", name: m[1] }); i++; continue; }
      i++; continue;
    }

    tokens.push({ t: "p", text: trimmed });
    i++;
  }
  return tokens;
}

function RenderTokens({ tokens }: { tokens: Token[] }) {
  const s = {
    h1: { fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", marginBottom: 8, marginTop: 32 },
    h2: { fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 10, marginTop: 36, paddingBottom: 8, borderBottom: "1px solid var(--border)" },
    h3: { fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 8, marginTop: 24 },
    p: { fontSize: 14, lineHeight: 1.75, color: "var(--text-2)", marginBottom: 12 },
    li: { fontSize: 14, lineHeight: 1.7, color: "var(--text-2)" },
    code: { display: "block" as const, background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "var(--teal)", border: "1px solid var(--border)", marginBottom: 16, whiteSpace: "pre" as const },
    bq: { borderLeft: "3px solid var(--teal)", paddingLeft: 14, color: "var(--text-muted)", fontSize: 13.5, lineHeight: 1.65, fontStyle: "italic" as const, marginBottom: 16 },
    hr: { border: "none", borderTop: "1px solid var(--border)", margin: "28px 0" },
  } as const;

  return (
    <>
      {tokens.map((tok, idx) => {
        if (tok.t === "blank") return null;
        if (tok.t === "hr") return <hr key={idx} style={s.hr} />;
        if (tok.t === "h1") return <h1 key={idx} id={tok.id} style={s.h1}>{parseInline(tok.text)}</h1>;
        if (tok.t === "h2") return <h2 key={idx} id={tok.id} style={s.h2}>{parseInline(tok.text)}</h2>;
        if (tok.t === "h3") return <h3 key={idx} id={tok.id} style={s.h3}>{parseInline(tok.text)}</h3>;
        if (tok.t === "p") {
          const isSubChapter = /^\d+\.\d+[\s.]/.test(tok.text);
          return <p key={idx} style={{ ...s.p, ...(isSubChapter ? { paddingLeft: 20 } : {}) }}>{parseInline(tok.text)}</p>;
        }
        if (tok.t === "code") return <pre key={idx} style={s.code}>{tok.text}</pre>;
        if (tok.t === "blockquote") return (
          <div key={idx} style={s.bq}>
            <p style={{ margin: 0 }}>{parseInline(tok.text.replace(/^\*\*[^*]+\*\*\s*/, ""))}</p>
          </div>
        );
        if (tok.t === "ul") return (
          <ul key={idx} style={{ paddingLeft: 20, marginBottom: 14 }}>
            {tok.items.map((item, j) => (
              <li key={j} style={{ ...s.li, paddingLeft: item.sub ? 16 : 0, marginBottom: item.sub ? 2 : undefined }}>
                {parseInline(item.text)}
              </li>
            ))}
          </ul>
        );
        if (tok.t === "visual") return <VisualBlock key={idx} name={tok.name} />;
        if (tok.t === "ol") return (
          <ol key={idx} style={{ paddingLeft: 20, marginBottom: 14 }}>
            {tok.items.map((item, j) => <li key={j} style={s.li}>{parseInline(item)}</li>)}
          </ol>
        );
        if (tok.t === "table") return (
          <div key={idx} style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {tok.head.map((h, j) => (
                    <th key={j} style={{ textAlign: "left", padding: "8px 12px", background: "var(--surface2)", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tok.rows.map((row, j) => (
                  <tr key={j} style={{ borderBottom: "1px solid var(--border)" }}>
                    {row.map((cell, k) => (
                      <td key={k} style={{ padding: "8px 12px", color: k === 0 ? "var(--text)" : "var(--text-2)", fontWeight: k === 0 ? 500 : 400 }}>
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return null;
      })}
    </>
  );
}

// ── Table of Contents ─────────────────────────────────────────────────────────

type HeadingToken = { t: "h2" | "h3"; text: string; id: string };

function Toc({ tokens, active }: { tokens: Token[]; active: string }) {
  const headings: HeadingToken[] = tokens.flatMap(t =>
    (t.t === "h2" || t.t === "h3") ? [t as HeadingToken] : []
  );
  return (
    <nav style={{ position: "sticky", top: 24, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Inhalt
      </div>
      {headings.map((h, i) => (
        <a key={i} href={`#${h.id}`}
          style={{
            display: "block",
            fontSize: h.t === "h3" ? 11.5 : 12.5,
            fontWeight: h.t === "h3" ? 400 : 600,
            color: active === h.id ? "var(--teal)" : "var(--text-muted)",
            paddingLeft: h.t === "h3" ? 20 : 0,
            paddingTop: 4, paddingBottom: 4,
            textDecoration: "none",
            borderLeft: `2px solid ${active === h.id ? "var(--teal)" : "transparent"}`,
            transition: "color 0.15s",
          }}
          onClick={e => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          {h.text.replace(/^[\d.]+\s+/, "")}
        </a>
      ))}
    </nav>
  );
}

// ── Visual Blocks ─────────────────────────────────────────────────────────────

function VisualBausteine() {
  const hebel = [
    {
      icon: "🥗", name: "Ernährung", badge: "1. Hebel · Wichtigster",
      color: "var(--teal)", dim: "var(--teal-dim)", border: "rgba(0,212,180,0.3)",
      blocks: [
        { n: 1, name: "Energiebilanz", desc: "Kaloriendefizit schaffen" },
        { n: 2, name: "Proteine", desc: "≥ 1,6 g/kg Körpergewicht" },
        { n: 3, name: "Lebensmittelauswahl", desc: "80/20-Regel anwenden" },
      ],
    },
    {
      icon: "💪", name: "Bewegung", badge: "2. Hebel",
      color: "var(--blue)", dim: "var(--blue-dim)", border: "rgba(79,142,247,0.3)",
      blocks: [
        { n: 4, name: "Krafttraining", desc: "2–3× pro Woche" },
        { n: 5, name: "Alltagsbewegung", desc: "7.000–10.000 Schritte/Tag" },
        { n: 6, name: "Ausdauersport", desc: "Optional 1–2×/Woche" },
      ],
    },
    {
      icon: "🌙", name: "Regeneration", badge: "3. Hebel · Durchgehend",
      color: "var(--purple)", dim: "var(--purple-dim)", border: "rgba(167,139,250,0.3)",
      blocks: [
        { n: 7, name: "Schlaf", desc: "7–9 Stunden pro Nacht" },
        { n: 8, name: "Pausen", desc: "Refeed · Deload" },
      ],
    },
  ];
  return (
    <div style={{ margin: "20px 0 28px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Die 8 Bausteine — hierarchisch nach Wirksamkeit
      </div>
      <div className="guide-hebel-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {hebel.map((h, i) => (
          <div key={i} style={{ background: h.dim, border: `1px solid ${h.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${h.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{h.badge}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: h.color }}>{h.icon} {h.name}</div>
            </div>
            <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
              {h.blocks.map(b => (
                <div key={b.n} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: h.color, color: "#000", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {b.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualTDEE() {
  const parts = [
    { label: "BMR", pct: 65, desc: "Grundumsatz", color: "var(--teal)" },
    { label: "NEAT", pct: 20, desc: "Alltagsbewegung", color: "var(--blue)" },
    { label: "EAT", pct: 10, desc: "Sport / Training", color: "var(--purple)" },
    { label: "TEF", pct: 5, desc: "Verdauung", color: "var(--orange)" },
  ];
  return (
    <div style={{ margin: "16px 0 24px", padding: "16px 20px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        TDEE = Tagesgesamtverbrauch · Beispiel: leicht aktive Person
      </div>
      <div style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden", marginBottom: 14, gap: 2 }}>
        {parts.map((p, i) => (
          <div key={i} style={{ width: `${p.pct}%`, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: i === 0 ? "6px 0 0 6px" : i === parts.length - 1 ? "0 6px 6px 0" : 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#000" }}>{p.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
        {parts.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              <strong style={{ color: p.color }}>{p.label}</strong> – {p.desc}{" "}
              <span style={{ color: "var(--text-muted)" }}>~{p.pct} %</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualFormeln() {
  const cats = [
    {
      name: "Energie & Verbrauch", color: "var(--teal)", icon: "🔥",
      rows: [
        { name: "BMR Männer", formula: "10 × kg + 6,25 × cm − 5 × Alter + 5", note: "Mifflin-St-Jeor" },
        { name: "BMR Frauen", formula: "10 × kg + 6,25 × cm − 5 × Alter − 161", note: "Mifflin-St-Jeor" },
        { name: "TDEE", formula: "BMR × Aktivitätsfaktor", note: "1,2 / 1,375 / 1,55 / 1,725 / 1,9" },
        { name: "Tagesdefizit", formula: "Gegessen − TDEE − Sport-kcal", note: "negativ = Defizit" },
      ],
    },
    {
      name: "Körperzusammensetzung", color: "var(--blue)", icon: "📊",
      rows: [
        { name: "BMI", formula: "Gewicht (kg) ÷ Größe (m)²", note: "" },
        { name: "Körperfett % (Deurenberg)", formula: "1,2 × BMI + 0,23 × Alter − 10,8 × G − 5,4", note: "G: 1 = Mann, 0 = Frau" },
        { name: "Magergewicht (LBM)", formula: "Gewicht × (1 − KF% ÷ 100)", note: "" },
        { name: "Muskelmasse (Skelett)", formula: "LBM × 0,60 ♂  ·  LBM × 0,55 ♀", note: "Schätzwert" },
      ],
    },
    {
      name: "Ernährungsziele", color: "var(--green)", icon: "🥩",
      rows: [
        { name: "Protein (Minimum Diät)", formula: "≥ 1,6 g × Körpergewicht (kg)", note: "Muskelschutz" },
        { name: "Protein (Optimum)", formula: "2,0–2,2 g × Körpergewicht (kg)", note: "" },
        { name: "Wasserempfehlung", formula: "35 ml × Körpergewicht (kg)", note: "Minimum 1.500 ml" },
        { name: "Thermischer Effekt (TEF)", formula: "Protein ~25 %  ·  KH ~6 %  ·  Fett ~2 %", note: "der jeweil. Kalorien" },
      ],
    },
    {
      name: "Fortschritt & Ziele", color: "var(--orange)", icon: "📉",
      rows: [
        { name: "Max. Defizit / Tag", formula: "Fettmasse (kg) × 70 kcal", note: "nach Alpert" },
        { name: "Max. Abnahme / Woche", formula: "0,7 % × Körpergewicht (kg)", note: "Muskelschutz" },
        { name: "Fettverlust (kcal → kg)", formula: "Defizit (kcal) ÷ 7.700", note: "≈ 1 kg Körperfett" },
        { name: "Zielgewicht (Broca)", formula: "Körpergröße (cm) − 100", note: "grober Richtwert" },
        { name: "Wochen bis Ziel", formula: "Differenz (kg) ÷ (Defizit/Tag × 7 ÷ 7.700)", note: "bei konstantem Defizit" },
        { name: "Tagesdefizit für Ziel", formula: "Zieldifferenz (kg) × 7.700 ÷ Wochen ÷ 7", note: "Umkehrrechnung" },
      ],
    },
    {
      name: "Muskelaufbau", color: "var(--purple)", icon: "💪",
      rows: [
        { name: "Max. Muskelzuwachs / Monat", formula: "0,5–1,0 % × Körpergewicht (kg)", note: "Anfänger; Fortge. ~0,25 %" },
        { name: "Kalorienüberschuss (Lean Bulk)", formula: "TDEE + 200–300 kcal", note: "minimiert Fettansatz" },
        { name: "Protein (Bulk)", formula: "1,6–2,2 g × Körpergewicht (kg)", note: "gleich wie Diät" },
        { name: "Fettansatz-Verhältnis", formula: "≈ 1 kg Muskel : 0,5 kg Fett", note: "bei moderatem Überschuss" },
        { name: "Creatine-Ladephase", formula: "4 × 5 g/Tag × 5–7 Tage", note: "optional, dann 3–5 g/Tag" },
      ],
    },
    {
      name: "Schlaf & Regeneration", color: "var(--blue)", icon: "😴",
      rows: [
        { name: "Schlafzyklen", formula: "90 min × Anzahl Zyklen", note: "5 Zyklen = 7,5 h optimal" },
        { name: "Cortisol-Halbwertszeit", formula: "ca. 60–90 min nach Peak", note: "Training > 18 Uhr vermeiden" },
        { name: "GH-Ausschüttung", formula: "Peak in Tiefschlaf (NREM 3)", note: "1. Zyklus am stärksten" },
        { name: "Schlafbedarf Sportler", formula: "≥ 8–9 h / Nacht", note: "vs. 7–9 h Normalbev." },
      ],
    },
  ];
  const th: React.CSSProperties = { textAlign: "left", padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0 8px" }}>
      {cats.map((cat, i) => (
        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{cat.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: cat.color }}>{cat.name}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: "28%" }}>Name</th>
                <th style={{ ...th, width: "46%" }}>Formel</th>
                <th style={{ ...th, width: "26%" }}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {cat.rows.map((r, j) => (
                <tr key={j} style={{ borderBottom: j < cat.rows.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--text)" }}>{r.name}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 12, color: cat.color, background: "var(--surface2)" }}>{r.formula}</td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text-muted)" }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function VisualGlossar() {
  const cats = [
    {
      name: "Energiestoffwechsel", color: "var(--teal)", icon: "🔥",
      terms: [
        { term: "BMR", full: "Basal Metabolic Rate", def: "Grundumsatz – Kalorien, die der Körper in völliger Ruhe (24 h) verbraucht, nur um lebenserhaltende Funktionen aufrechtzuerhalten." },
        { term: "TDEE", full: "Total Daily Energy Expenditure", def: "Gesamtenergieverbrauch pro Tag = BMR × Aktivitätsfaktor. Das ist die Kalorienmenge, die du essen musst, um dein Gewicht zu halten." },
        { term: "TEF", full: "Thermic Effect of Food", def: "Thermischer Effekt der Nahrung – Energie, die beim Verdauen verbraucht wird. Protein ~25 %, Kohlenhydrate ~6 %, Fett ~2 % der jeweiligen Kalorien." },
        { term: "AEE", full: "Activity Energy Expenditure", def: "Kalorienverbrauch durch bewusste Bewegung (Sport, Training). Wird manuell im QuickEntry eingetragen und vom Defizit abgezogen." },
        { term: "NEAT", full: "Non-Exercise Activity Thermogenesis", def: "Kalorienverbrauch durch unbewusste Alltagsbewegung: Stehen, Zappeln, Treppengehen, Hausarbeit. Stark unterschätzt – kann mehrere hundert kcal pro Tag ausmachen." },
        { term: "Kaloriendefizit", full: "", def: "Negative Kalorienbilanz: Du nimmst weniger Kalorien zu dir als du verbrauchst. Voraussetzung für Fettabbau. Empfohlene Größe: 300–500 kcal/Tag." },
        { term: "Kalorienüberschuss", full: "Surplus", def: "Positive Kalorienbilanz: mehr essen als verbrauchen. Voraussetzung für gezielten Muskelaufbau (Bulk-Phase)." },
      ],
    },
    {
      name: "Körperzusammensetzung", color: "var(--blue)", icon: "📊",
      terms: [
        { term: "KG", full: "Körpergewicht", def: "Gesamtgewicht inkl. Wasser, Muskeln, Fett, Knochen und Organgewebe. Schwankt täglich bis zu 2 kg – Trend zählt, nicht der Einzelwert." },
        { term: "KF%", full: "Körperfettanteil", def: "Prozentualer Anteil des Körperfetts am Gesamtgewicht. Gesunde Bereiche: Männer 10–20 %, Frauen 18–28 %. Wird per Formel (Deurenberg) oder Messung bestimmt." },
        { term: "LBM", full: "Lean Body Mass", def: "Magergewicht – alles außer Körperfett: Muskeln, Knochen, Organe, Wasser. Formel: Gewicht × (1 – KF%/100). Basis für Proteinbedarf und BMR." },
        { term: "Muskelmasse", full: "Skelettmuskulatur", def: "Der kontrahierbare Anteil der LBM, ca. 60 % (♂) bzw. 55 % (♀) des Magergewichts. Schätzwert, der in der App angezeigt wird." },
        { term: "BMI", full: "Body-Mass-Index", def: "Gewicht (kg) ÷ Größe (m)². Grober Überblicksindex, berücksichtigt keine Körperzusammensetzung. Normalbereich: 18,5–24,9." },
        { term: "Wassereinlagerungen", full: "", def: "Temporäre Gewichtsschwankungen durch gespeichertes Wasser im Gewebe. Können durch Stress, Salz, Kohlenhydrate oder Muskelkater entstehen und das Waage-Ergebnis verfälschen." },
      ],
    },
    {
      name: "Trainingskonzepte", color: "var(--green)", icon: "💪",
      terms: [
        { term: "Progressive Überlastung", full: "Progressive Overload", def: "Das Prinzip, Trainingsreize schrittweise zu steigern (mehr Gewicht, Wiederholungen oder Volumen), damit der Muskel weiter wächst und stärker wird." },
        { term: "Deload", full: "", def: "Gezielte Trainingswoche mit deutlich reduziertem Volumen oder Intensität (~40–60 % der normalen Last). Ziel: Erholung des ZNS und Prävention von Übertraining." },
        { term: "Refeed", full: "", def: "Gezielter Tag oder mehrtägiger Zeitraum mit Kalorienzufuhr auf TDEE-Niveau während einer Diät. Hebt Leptin und Stoffwechselrate, verbessert Wohlbefinden und Leistung." },
        { term: "Muskelschutz", full: "Muscle Retention", def: "Ziel beim Abnehmen: möglichst viel Muskelmasse erhalten. Erreicht durch ausreichend Protein (≥1,6 g/kg), Krafttraining und moderates Defizit (max. 500 kcal/Tag)." },
        { term: "Volumen", full: "Trainingsvolumen", def: "Gesamtarbeit pro Einheit: Sätze × Wiederholungen × Gewicht. Primärer Wachstumsreiz. Muss progressiv gesteigert werden." },
        { term: "ZNS", full: "Zentrales Nervensystem", def: "Steuert Muskelkontraktion und Koordination. Ermüdet bei schwerem Training stärker und langsamer als die Muskulatur selbst – daher Bedarf an Deload-Wochen." },
      ],
    },
    {
      name: "Ernährung & Makros", color: "var(--orange)", icon: "🥗",
      terms: [
        { term: "Makros", full: "Makronährstoffe", def: "Die drei kalorienliefernden Nährstoffgruppen: Protein (4 kcal/g), Kohlenhydrate (4 kcal/g) und Fett (9 kcal/g)." },
        { term: "Protein", full: "Eiweiß", def: "Wichtigster Makronährstoff für Muskelschutz und -aufbau. Empfehlung in der Diät: 1,6–2,2 g pro kg Körpergewicht. Hat den höchsten thermischen Effekt (TEF ~25 %)." },
        { term: "KH", full: "Kohlenhydrate", def: "Primärer Energielieferant für Gehirn und Muskulatur. 1 g Glykogen bindet ~3 g Wasser – daher schnelle Gewichtsschwankungen bei KH-Änderungen." },
        { term: "Mifflin-St-Jeor", full: "", def: "Wissenschaftlich validierte Formel zur BMR-Berechnung (1990). Gilt als genaueste Standardformel. Männer: 10×kg + 6,25×cm − 5×Alter + 5. Frauen: −161 statt +5." },
        { term: "Aktivitätsfaktor", full: "PAL-Wert", def: "Multiplikator für den BMR zur TDEE-Berechnung: 1,2 (kaum Bewegung) bis 1,9 (sehr aktiv/2× tägl. Training). Wird im Profil eingestellt." },
        { term: "Glykogen", full: "", def: "Gespeicherte Form der Kohlenhydrate in Muskeln und Leber. Wird bei Sport zuerst verbraucht. Volle Speicher = ca. 400–600 g, bindet zusätzlich ~1,5 kg Wasser." },
      ],
    },
    {
      name: "Hormone & Stoffwechsel", color: "var(--green)", icon: "🧬",
      terms: [
        { term: "Leptin", full: "", def: "Sättigungshormon, das vom Fettgewebe produziert wird. Sinkt bei Kaloriendefizit (nach 2–3 Wochen messbar) → Hungergefühl steigt, Stoffwechsel verlangsamt. Refeed-Tage heben Leptin kurzzeitig an." },
        { term: "Ghrelin", full: "Hungerhormon", def: "Wird im Magen gebildet, steigt bei Kaloriendefizit und signalisiert dem Gehirn Hunger. Höchste Konzentration kurz vor typischen Mahlzeiten – Gewohnheiten prägen den Verlauf." },
        { term: "Cortisol", full: "Stresshormon", def: "Kataboles Hormon: baut Muskeln ab, fördert Fettspeicherung (besonders Bauch). Erhöht durch Schlafmangel, Übertraining und psychischen Stress." },
        { term: "Insulin", full: "", def: "Transporthormon für Glukose in die Zellen. Hemmt Fettabbau, solange es erhöht ist. Niedrige Insulinphasen (nüchtern, nach Sport) begünstigen Lipolyse." },
        { term: "Testosteron", full: "", def: "Anaboles Hormon: fördert Muskelaufbau, Proteinsynthese und Fettabbau. Sinkt bei Schlafmangel, extremem Defizit (< 1.200 kcal/Tag) und hohem Stress." },
        { term: "Adipokine", full: "", def: "Botenstoffe des Fettgewebes (inkl. Leptin, Adiponektin). Regulieren Insulinsensitivität, Entzündung und Energiehomöostase. Verbessern sich mit sinkendem Körperfettanteil." },
      ],
    },
    {
      name: "Trainingsmethoden", color: "var(--orange)", icon: "🏃",
      terms: [
        { term: "HIIT", full: "High Intensity Interval Training", def: "Wechsel zwischen Maximalbelastung (20–40 s) und kurzer Erholung. Hoher Nachbrenneffekt (EPOC), zeiteffizient, aber ZNS-intensiv — max. 2–3×/Woche." },
        { term: "LISS", full: "Low Intensity Steady State", def: "Gleichmäßiges Ausdauertraining bei 50–65 % HFmax (z.B. 45 min Walken). Schont ZNS, ideal als aktive Erholung oder zur Schritterhöhung." },
        { term: "EPOC", full: "Excess Post-Exercise Oxygen Consumption", def: "Nachbrenneffekt: erhöhter Kalorienverbrauch nach intensivem Training. Bei HIIT bis zu 24 h relevant, bei LISS minimal." },
        { term: "1RM", full: "One Repetition Maximum", def: "Maximales Gewicht, das für eine Wiederholung bewegt werden kann. Trainingsgewichte werden oft als % des 1RM angegeben (z.B. 70–85 % für Hypertrophie)." },
        { term: "Hypertrophie", full: "", def: "Muskelwachstum durch Vergrößerung der Muskelfasern. Optimaler Wiederholungsbereich: 6–20 pro Satz, bei 60–85 % 1RM. Volumen ist der Haupttreiber." },
        { term: "Übertraining", full: "Overtraining Syndrome", def: "Anhaltend sinkende Leistung, Müdigkeit, schlechter Schlaf und erhöhte Infektanfälligkeit durch zu viel Training ohne ausreichende Erholung. Lösung: Deload oder Pause." },
      ],
    },
    {
      name: "App-Konzepte", color: "var(--purple)", icon: "📱",
      terms: [
        { term: "Phase", full: "Diätphase", def: "Abschnitt mit definierten Zielen (Start-/Zielgewicht, Startdatum). Die App berechnet daraus Ziel-Defizit und Fortschritt. Mehrere Phasen können hintereinander angelegt werden." },
        { term: "Bilanz", full: "Tagesbilanz / Defizit", def: "Gegessen − TDEE − Sport-kcal. Negative Werte = Defizit (gut beim Abnehmen). Positive Werte = Überschuss. Wird täglich im Dashboard angezeigt." },
        { term: "Score", full: "Tagesscore", def: "Interne Qualitätsbewertung des Tages: berücksichtigt Defizit, Protein, Schlaf und Schritte. Dient als Orientierung, nicht als harte Vorgabe." },
        { term: "QuickEntry", full: "", def: "Schnelleingabe-Formular im Dashboard zum Erfassen aller Tageswerte: Gewicht, Kalorien, Protein, Sport, Schritte, Schlaf und Körperfett." },
        { term: "TDEE-Override", full: "", def: "Möglichkeit, den berechneten TDEE manuell zu überschreiben, wenn du deinen tatsächlichen Verbrauch durch längeres Tracking besser kennst." },
        { term: "Körperfett (geschätzt)", full: "", def: "Wird aus BMI, Alter und Geschlecht per Deurenberg-Formel berechnet, wenn keine manuelle Messung eingegeben wurde. Schätzwert ± 3–4 Prozentpunkte." },
      ],
    },
  ];

  const tdCell: React.CSSProperties = { padding: "9px 14px", verticalAlign: "top" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0 8px" }}>
      {cats.map((cat, i) => (
        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{cat.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: cat.color }}>{cat.name}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <colgroup>
              <col className="glossar-col-term" style={{ width: "14%" }} />
              <col className="glossar-col-mid" style={{ width: "22%" }} />
              <col className="glossar-col-def" style={{ width: "64%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" }}>Kürzel</th>
                <th className="glossar-col-mid" style={{ textAlign: "left", padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" }}>Ausgeschrieben</th>
                <th style={{ textAlign: "left", padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" }}>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {cat.terms.map((r, j) => (
                <tr key={j} style={{ borderBottom: j < cat.terms.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ ...tdCell, fontWeight: 700, color: cat.color, fontFamily: "monospace", fontSize: 12 }}>{r.term}</td>
                  <td className="glossar-col-mid" style={{ ...tdCell, fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>{r.full || "–"}</td>
                  <td style={{ ...tdCell, color: "var(--text-muted)", lineHeight: 1.55 }}>{r.def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function VisualBlock({ name }: { name: string }) {
  if (name === "bausteine") return <VisualBausteine />;
  if (name === "tdee") return <VisualTDEE />;
  if (name === "formeln") return <VisualFormeln />;
  if (name === "glossar") return <VisualGlossar />;
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GuideView() {
  const [md, setMd] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/abnehm-guide.md").then(r => r.text()).then(setMd);
  }, []);

  useEffect(() => {
    if (!md) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length > 0) setActiveId(visible[0].target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });

    const headings = contentRef.current?.querySelectorAll("h2, h3") ?? [];
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [md]);

  const tokens = md ? tokenize(md) : [];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>
            📖 Abnehmguide
          </h1>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>von Steven Illg</span>
        </div>
        <div style={{ width: 40, height: 3, background: "var(--teal)", borderRadius: 99, marginTop: 8, boxShadow: "0 0 8px var(--teal-glow)" }} />
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
          Praxisorientierter Guide zur nachhaltigen Gewichtsreduktion · Klick auf einen Abschnitt im Inhaltsverzeichnis zum Springen
        </p>
      </div>

      {!md && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 14 }}>
          Lade Guide…
        </div>
      )}

      {md && (
        <div className="guide-grid" style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 40, alignItems: "start" }}>
          {/* TOC Sidebar — sticky, desktop only */}
          <div className="guide-sidebar card card-pad no-print" style={{
            padding: "16px 14px",
            position: "sticky", top: 80, alignSelf: "start",
            maxHeight: "calc(100vh - 110px)", overflowY: "auto",
          }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Inhalt</span>
            </div>
            <Toc tokens={tokens} active={activeId} />
          </div>

          {/* Content */}
          <div ref={contentRef} className="card card-pad guide-content-area" style={{ padding: "28px 36px", lineHeight: 1.7 }}>
            <RenderTokens tokens={tokens} />
          </div>
        </div>
      )}
    </div>
  );
}
