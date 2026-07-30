import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

const mono = { fontFamily: "'JetBrains Mono', monospace" };

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendLink(e) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
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
        <form onSubmit={sendLink} style={{ border: "1px solid #2a3330", padding: 24, width: "100%", maxWidth: 360 }}>
          <h1 style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, color: "#ffb000" }}>
            Outreach Terminal
          </h1>
          {sent ? (
            <p style={{ fontSize: 13, color: "#7fe08a" }}>Check your email for a sign-in link.</p>
          ) : (
            <>
              <label style={{ fontSize: 10, textTransform: "uppercase", color: "#4d5652", display: "block", marginBottom: 6 }}>
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@example.com"
                style={{ width: "100%", background: "transparent", border: "1px solid #2a3330", color: "#e8e6d9", padding: "8px 10px", fontSize: 13, marginBottom: 12, ...mono }}
              />
              <button
                type="submit"
                style={{ background: "#ffb000", color: "#0a0e0c", padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, border: "none", ...mono }}
              >
                Send sign-in link
              </button>
              {error && <p style={{ color: "#ff6b5e", fontSize: 12, marginTop: 10 }}>{error}</p>}
            </>
          )}
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
