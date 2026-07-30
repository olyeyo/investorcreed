import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const inputStyle = {
  width: "100%",
  background: "transparent",
  border: "1px solid #2a3330",
  color: "#e8e6d9",
  padding: "8px 10px",
  fontSize: 13,
  marginBottom: 12,
  ...mono,
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(error.message);
  }

  if (session === undefined) {
    return (
      <div style={{ ...mono, background: "#0a0e0c", color: "#8a9290", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
        loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ ...mono, background: "#0a0e0c", color: "#e8e6d9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <form onSubmit={signIn} style={{ border: "1px solid #2a3330", padding: 24, width: "100%", maxWidth: 360 }}>
          <h1 style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, color: "#ffb000" }}>
            Outreach Terminal
          </h1>

          <label style={{ fontSize: 10, textTransform: "uppercase", color: "#4d5652", display: "block", marginBottom: 6 }}>
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            style={inputStyle}
          />

          <label style={{ fontSize: 10, textTransform: "uppercase", color: "#4d5652", display: "block", marginBottom: 6 }}>
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{ background: submitting ? "#3a3730" : "#ffb000", color: "#0a0e0c", padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, border: "none", cursor: submitting ? "default" : "pointer", ...mono }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          {error && <p style={{ color: "#ff6b5e", fontSize: 12, marginTop: 10 }}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        onClick={() => supabase.auth.signOut()}
        title="Sign out"
        style={{ ...mono, position: "fixed", bottom: 12, right: 12, background: "#0d1210", border: "1px solid #2a3330", color: "#8a9290", fontSize: 10, textTransform: "uppercase", padding: "6px 10px", zIndex: 60, cursor: "pointer" }}
      >
        Sign out
      </button>
    </>
  );
}
