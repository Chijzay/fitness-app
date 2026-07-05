"use client";
import { signOut } from "next-auth/react";
import type { View } from "@/app/page";

export default function Nav({ view, setView, profileName, onNewEntry, onDietProgress, onWorkouts, onGuide }: {
  view: View; setView: (v: View) => void; profileName: string;
  onNewEntry: () => void; onDietProgress: () => void; onWorkouts: () => void; onGuide: () => void;
}) {
  const isDiet = view === "detail-diet";
  const isWorkouts = view === "detail-workouts" || view === "workout-entry";
  const isGuide = view === "guide";

  return (
    <nav className="nav">
      {/* Brand */}
      <div className="nav-brand" onClick={() => setView("dashboard")}>
        <div className="nav-brand-icon">💪</div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
          FitnessTracker
        </span>
      </div>

      {/* Desktop: Tabs inline */}
      <div className="nav-divider" />
      <button className={`nav-tab${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
      <button className={`nav-tab${isWorkouts ? " active" : ""}`} onClick={onWorkouts}>💪 Krafttraining</button>
      <button className={`nav-tab${isDiet ? " active" : ""}`} onClick={onDietProgress}>📉 Diätverlauf</button>
      <button className={`nav-tab${view === "goals" ? " active" : ""}`} onClick={() => setView("goals")}>Ziele</button>
      <button className={`nav-tab${isGuide ? " active" : ""}`} onClick={onGuide}>📖 Guide</button>

      <div className="nav-spacer" />

      <div className="nav-actions">
        <button className="btn btn-sm btn-primary" onClick={onNewEntry}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          Eintrag
        </button>
        <div className="nav-divider" />
        <button className={`nav-tab${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")} style={{ gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>⚙</span>
          {profileName}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => signOut({ callbackUrl: "/login" })} title="Abmelden" style={{ padding: "6px 12px" }}>
          Abmelden
        </button>
      </div>

      {/* Mobile: Tabs als zweite Zeile (scrollbar) */}
      <div className="nav-tabs-mobile">
        <button className={`nav-tab${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
        <button className={`nav-tab${isWorkouts ? " active" : ""}`} onClick={onWorkouts}>💪 Krafttraining</button>
        <button className={`nav-tab${isDiet ? " active" : ""}`} onClick={onDietProgress}>📉 Diätverlauf</button>
        <button className={`nav-tab${view === "goals" ? " active" : ""}`} onClick={() => setView("goals")}>Ziele</button>
        <button className={`nav-tab${isGuide ? " active" : ""}`} onClick={onGuide}>📖 Guide</button>
        <button className={`nav-tab${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")}>⚙ Profil</button>
        <button className="nav-tab" onClick={() => signOut({ callbackUrl: "/login" })} style={{ color: "var(--text-muted)" }}>Abmelden</button>
      </div>
    </nav>
  );
}
