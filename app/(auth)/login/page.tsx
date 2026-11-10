"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/safe-next-path";

type Portal = "organizer" | "participant";

export default function LoginPage() {
  const supabase = createClient();
  const [portal, setPortal] = useState<Portal>("participant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [registeredMessage, setRegisteredMessage] = useState("");
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(search.get("next")));
    if (search.get("portal") === "organizer") setPortal("organizer");
    if (search.get("registered") === "1") {
      setRegisteredMessage("Account created successfully. Verify your email first, then sign in.");
    }
  }, []);

  function selectPortal(nextPortal: Portal) {
    setPortal(nextPortal);
    setMessage("");
    setRegisteredMessage("");

    const url = new URL(window.location.href);
    if (nextPortal === "organizer") url.searchParams.set("portal", "organizer");
    else url.searchParams.delete("portal");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message.toLowerCase().includes("invalid login credentials")
        ? "Unable to sign in. Check your email and password, and verify your email address first."
        : error.message);
      return;
    }

    const provisionResponse = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!provisionResponse.ok) {
      const provisionBody = await provisionResponse.json().catch(() => ({})) as { error?: string };
      setMessage(provisionBody.error ?? "Sign-in succeeded, but account setup is incomplete. Please contact support.");
      return;
    }

    const landingResponse = await fetch("/api/auth/landing-route");
    const landing = await landingResponse.json().catch(() => ({})) as { route?: string };
    if (!landingResponse.ok || !landing.route) {
      setMessage("Sign-in succeeded, but your portal could not be resolved. Please contact support.");
      return;
    }

    const requestedNext = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    window.location.assign(requestedNext ?? landing.route);
  }

  const isOrganizerPortal = portal === "organizer";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-12 text-slate-900 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">RaceDeck PH</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Choose your portal, then sign in with your email and password.</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Choose a sign-in portal">
          <button
            type="button"
            aria-pressed={!isOrganizerPortal}
            onClick={() => selectPortal("participant")}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${!isOrganizerPortal ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            Participant
          </button>
          <button
            type="button"
            aria-pressed={isOrganizerPortal}
            onClick={() => selectPortal("organizer")}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${isOrganizerPortal ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            Organizer / Admin
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
            <input
              id="login-email"
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
            <input
              id="login-password"
              required
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <button disabled={busy} className="w-full rounded-lg bg-orange-600 px-4 py-3 font-bold text-white transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Signing in…" : `Sign in as ${isOrganizerPortal ? "Organizer / Admin" : "Participant"}`}
          </button>

          {registeredMessage && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{registeredMessage}</p>}
          {message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

          <div className="text-sm">
            <a href="/forgot-password" className="font-medium text-slate-600 underline-offset-4 hover:text-orange-700 hover:underline">Forgot password?</a>
          </div>
        </form>
      </section>
    </main>
  );
}
