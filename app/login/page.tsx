"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Ungültige E-Mail oder Passwort");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--card)", borderRadius: 16, padding: "40px 36px",
        width: "100%", maxWidth: 420, border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💪</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            FitnessTracker
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
            Melde dich an, um fortzufahren
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="name@beispiel.de"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 14px",
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text)", fontSize: 15,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Mindestens 8 Zeichen"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 14px",
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text)", fontSize: 15,
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8,
              color: "#ef4444", fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: 4, padding: "12px", fontSize: 15 }}
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-muted)" }}>
          Noch kein Konto?{" "}
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
