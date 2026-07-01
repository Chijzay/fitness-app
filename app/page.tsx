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

function todayStr() { return new Date().toISOString().split("T")[0]; }
function last7(): DateRange {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 6);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
}
function last30(): DateRange {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 29);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
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
  const [dashRange] = useState<DateRange>(last7());
  const [detailRange, setDetailRange] = useState<DateRange>(last30());
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [entryDate, setEntryDate] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(p => {
      setProfile(p); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const from = new Date(); from.setDate(from.getDate() - 180);
    fetch(`/api/logs?from=${from.toISOString().split("T")[0]}&to=${todayStr()}`)
      .then(r => r.json()).then(setAllLogs);
  }, [refreshKey]);

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
        onNewEntry={() => { setReturnView("dashboard"); setEntryDate(todayStr()); setView("entry"); }}
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
