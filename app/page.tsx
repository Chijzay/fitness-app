"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Dashboard from "@/components/Dashboard";
import QuickEntry from "@/components/QuickEntry";
import ProfileSetup from "@/components/ProfileSetup";
import StepsDetail from "@/components/detail/StepsDetail";
import WeightDetail from "@/components/detail/WeightDetail";
import KcalDetail from "@/components/detail/KcalDetail";
import SleepDetail from "@/components/detail/SleepDetail";
import DietProgress from "@/components/detail/DietProgress";
import GoalsPage from "@/components/GoalsPage";
import GuideView from "@/components/GuideView";

export type Profile = {
  id: number; name: string; gender: string; birthdate: string;
  height: number; activityLevel: number; proteinFactor: number;
};
export type DailyLog = {
  id: number; date: string; phaseId?: number;
  weight?: number; bodyFatPercent?: number; bodyFatEstimated?: boolean; muscleMass?: number;
  kcalConsumed?: number; kcalBurned?: number; bmrOverride?: number;
  carbsG?: number; fatG?: number; proteinG?: number;
  steps?: number; stepsDuration?: number; stepsType?: string; stepsNotes?: string;
  sleepTotal?: number; sleepActual?: number; sleepDeep?: number; sleepQuality?: number;
  waterMl?: number; notes?: string;
};
export type DateRange = { from: string; to: string };

export type View =
  | "dashboard" | "entry" | "profile" | "goals" | "guide"
  | "detail-steps" | "detail-weight" | "detail-kcal" | "detail-sleep" | "detail-diet";

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function last7(): DateRange {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 6);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`,
    to: todayStr(),
  };
}
function last30(): DateRange {
  const to = new Date(); void to;
  const from = new Date(); from.setDate(from.getDate() - 29);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`,
    to: todayStr(),
  };
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);
  const [view, setView] = useState<View>("dashboard");
  const [returnView, setReturnView] = useState<View>("dashboard");
  // dashRange wird jedes Mal neu aus dem aktuellen Datum berechnet
  const [today, setToday] = useState(todayStr());
  const [detailRange, setDetailRange] = useState<DateRange>(last30());
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [entryDate, setEntryDate] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);

  // Fix: Vercel-Server läuft in UTC — nach Hydration korrektes lokales Datum setzen
  useEffect(() => {
    const local = todayStr();
    if (local !== today) {
      setToday(local);
      setEntryDate(local);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function makeDashRange(t: string): DateRange {
    const d = new Date(t + "T12:00:00"); // mittags parsen um UTC-Offset-Fehler zu vermeiden
    d.setDate(d.getDate() - 6);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { from, to: t };
  }
  const dashRange = makeDashRange(today);

  // Mitternachts-Refresh: aktualisiert "today" automatisch wenn der Tag wechselt
  useEffect(() => {
    const tick = () => {
      setToday(todayStr());
      setEntryDate(todayStr());
      setRefreshKey(k => k + 1);
    };
    const ms = msUntilMidnight();
    const t = setTimeout(() => {
      tick();
      // danach täglich wiederholen
      const interval = setInterval(tick, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, ms);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(p => {
      setProfile(p); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const from = new Date(today); from.setDate(from.getDate() - 180);
    fetch(`/api/logs?from=${from.toISOString().split("T")[0]}&to=${today}`)
      .then(r => r.json()).then(setAllLogs);
  }, [refreshKey, today]);

  function onSaved() {
    setRefreshKey(k => k + 1);
    setView(returnView);
  }

  function goDetail(v: View) { setDetailRange(last30()); setView(v); }

  // Called from detail tables on double-click — opens entry form, returns back to current detail
  function onEditDate(date: string, fromView: View) {
    setReturnView(fromView);
    setEntryDate(date);
    setView("entry");
  }

  if (status === "loading" || status === "unauthenticated") return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 15 }}>
      Laden…
    </div>
  );

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 15 }}>
      Laden…
    </div>
  );
  if (!profile) return <ProfileSetup onSaved={p => setProfile(p)} />;

  const dashLogs = allLogs.filter(l => l.date.split("T")[0] >= dashRange.from && l.date.split("T")[0] <= dashRange.to);
  const detailLogs = allLogs.filter(l => l.date.split("T")[0] >= detailRange.from && l.date.split("T")[0] <= detailRange.to);
  const isDetail = view.startsWith("detail-");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Nav
        view={view} setView={v => { setReturnView("dashboard"); setView(v); }}
        profileName={profile.name}
        onNewEntry={() => { setReturnView("dashboard"); setEntryDate(today); setView("entry"); }}
        onDietProgress={() => goDetail("detail-diet")}
        onGuide={() => setView("guide")}
      />
      <main className="page" style={{ flex: 1 }}>
        {view === "dashboard" && (
          <Dashboard
            logs={dashLogs} profile={profile} range={dashRange}
            onGoDetail={goDetail}
            onEditEntry={date => { setReturnView("dashboard"); setEntryDate(date); setView("entry"); }}
          />
        )}
        {view === "entry" && (
          <QuickEntry
            profile={profile} date={entryDate} setDate={setEntryDate}
            logs={allLogs} onSaved={onSaved} onCancel={() => setView(returnView)}
          />
        )}
        {view === "profile" && (
          <ProfileSetup existing={profile} onSaved={p => { setProfile(p); setView("dashboard"); }} />
        )}
        {view === "goals" && <GoalsPage profile={profile} latestLog={allLogs.at(-1)} logs={allLogs} />}
        {view === "guide" && <GuideView />}
        {isDetail && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setView("dashboard")} style={{ gap: 5 }}>
                ← Dashboard
              </button>
            </div>
            {view === "detail-steps" && (
              <StepsDetail logs={detailLogs} allLogs={allLogs} range={detailRange} setRange={setDetailRange}
                onEditDate={date => onEditDate(date, "detail-steps")} />
            )}
            {view === "detail-weight" && (
              <WeightDetail logs={detailLogs} allLogs={allLogs} profile={profile} range={detailRange} setRange={setDetailRange}
                onEditDate={date => onEditDate(date, "detail-weight")} />
            )}
            {view === "detail-kcal" && (
              <KcalDetail logs={detailLogs} allLogs={allLogs} profile={profile} range={detailRange} setRange={setDetailRange}
                onEditDate={date => onEditDate(date, "detail-kcal")} />
            )}
            {view === "detail-sleep" && (
              <SleepDetail logs={detailLogs} allLogs={allLogs} range={detailRange} setRange={setDetailRange}
                onEditDate={date => onEditDate(date, "detail-sleep")} />
            )}
            {view === "detail-diet" && (
              <DietProgress allLogs={allLogs} profile={profile} range={detailRange} setRange={setDetailRange}
                onEditDate={date => onEditDate(date, "detail-diet")} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
