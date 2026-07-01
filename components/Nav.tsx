"use client";
import { signOut } from "next-auth/react";
import type { View } from "@/app/page";

export default function Nav({ view, setView, profileName, onNewEntry, onDietProgress, onGuide }: {
  view: View; setView: (v: View) => void; profileName: string;
  onNewEntry: () => void; onDietProgress: () => void; onGuide: () => void;
}) {
  return (
    <nav className="nav">
      {/* Brand */}
      <div className="nav-brand" onClick={() => setView("dashboard")}>
        <div className="nav-brand-icon">💪</div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
          FitnessTracker
        </span>
      </div>

      <div className="nav-divider" />

      {/* Navigation Tabs */}
      <button
        className={`nav-tab${view === "dashboard" ? " active" : ""}`}
        onClick={() => setView("dashboard")}
      >
        Dashboard
      </button>
      <button
        className={`nav-tab${view === "detail-diet" ? " active" : ""}`}
        onClick={onDietProgress}
      >
        📉 Diätverlauf
      </button>
      <button
        className={`nav-tab${view === "goals" ? " active" : ""}`}
        onClick={() => setView("goals")}
      >
        Ziele
      </button>
      <button
        className={`nav-tab${view === "guide" ? " active" : ""}`}
        onClick={onGuide}
      >
        📖 Guide
      </button>

      <div className="nav-spacer" />

      {/* Actions */}
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
  );
}
