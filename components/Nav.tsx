"use client";
import { signOut } from "next-auth/react";
import type { View } from "@/app/page";

export default function Nav({ view, setView, profileName, onNewEntry, onDietProgress, onGuide }: {
  view: View; setView: (v: View) => void; profileName: string;
  onNewEntry: () => void; onDietProgress: () => void; onGuide: () => void;
}) {
  const isDiet = view === "detail-diet";
  const isGuide = view === "guide";

  return (
    <>
      {/* ── Desktop / Mobile Top Bar ── */}
      <nav className="nav">
        <div className="nav-brand" onClick={() => setView("dashboard")}>
          <div className="nav-brand-icon">💪</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
            FitnessTracker
          </span>
        </div>

        <div className="nav-divider" />

        {/* Desktop-only tabs */}
        <button className={`nav-tab${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}>
          Dashboard
        </button>
        <button className={`nav-tab${isDiet ? " active" : ""}`} onClick={onDietProgress}>
          📉 Diätverlauf
        </button>
        <button className={`nav-tab${view === "goals" ? " active" : ""}`} onClick={() => setView("goals")}>
          Ziele
        </button>
        <button className={`nav-tab${isGuide ? " active" : ""}`} onClick={onGuide}>
          📖 Guide
        </button>

        <div className="nav-spacer" />

        <div className="nav-actions">
          <button className="btn btn-sm btn-primary" onClick={onNewEntry}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            Eintrag
          </button>
          <div className="nav-divider" />
          <button
            className={`nav-tab${view === "profile" ? " active" : ""}`}
            onClick={() => setView("profile")}
            style={{ gap: 6 }}
          >
            <span style={{ fontSize: 13, opacity: 0.7 }}>⚙</span>
            {profileName}
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Abmelden"
            style={{ padding: "6px 12px" }}
          >
            Abmelden
          </button>
        </div>
      </nav>

      {/* ── Mobile Bottom Navigation ── */}
      <div className="mobile-nav">
        <button className={`mobile-nav-item${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}>
          <span>🏠</span>
          <span>Dashboard</span>
        </button>
        <button className={`mobile-nav-item${isDiet ? " active" : ""}`} onClick={onDietProgress}>
          <span>📉</span>
          <span>Verlauf</span>
        </button>
        <button className="mobile-nav-item" onClick={onNewEntry} style={{ color: "var(--teal)" }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
          <span>Eintrag</span>
        </button>
        <button className={`mobile-nav-item${view === "goals" ? " active" : ""}`} onClick={() => setView("goals")}>
          <span>🎯</span>
          <span>Ziele</span>
        </button>
        <button className={`mobile-nav-item${isGuide ? " active" : ""}`} onClick={onGuide}>
          <span>📖</span>
          <span>Guide</span>
        </button>
      </div>
    </>
  );
}
