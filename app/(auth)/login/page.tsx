"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [portal, setPortal] = useState<"organizer" | "participant">("participant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [registeredMessage, setRegisteredMessage] = useState("");

  useEffect(() => {
    const requestedPortal = new URLSearchParams(window.location.search).get("portal");
    if (requestedPortal === "organizer") setPortal("organizer");
    if (new URLSearchParams(window.location.search).get("registered") === "1") setRegisteredMessage("Account created successfully. Verify your email first, then sign in.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message.toLowerCase().includes("invalid login credentials")
        ? "Unable to sign in. Check your email and password, and verify your email address first."
        : error.message);
      return;
    }
    const provisionResponse = await fetch("/api/auth/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!provisionResponse.ok) {
      const provisionBody = await provisionResponse.json().catch(() => ({})) as { error?: string };
      setMessage(provisionBody.error ?? "Sign-in succeeded, but account setup is incomplete. Please contact support.");
      return;
    }
    const landingResponse = await fetch('/api/auth/landing-route');
    const landing = await landingResponse.json().catch(() => ({})) as { route?: string };
    if (!landingResponse.ok || !landing.route) { setMessage('Sign-in succeeded, but your portal could not be resolved. Please contact support.'); return; }
    window.location.assign(landing.route);
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">{portal === "organizer" ? "Organizer Portal" : "Participant Portal"}</p>
    <h1 className="text-2xl font-semibold">Sign in to your {portal} account</h1>
    <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border p-3" />
    <input required type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border p-3" />
    <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    {registeredMessage && <p role="status" className="text-sm text-green-700">{registeredMessage}</p>}
    {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
    <a href="/forgot-password" className="text-sm underline">Forgot password?</a>
    <p className="text-sm">No account? <a href={portal === "organizer" ? "/organizer-register" : "/register"} className="underline">Register</a></p>
  </form></main>;
}
