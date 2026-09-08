"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    window.location.assign(new URLSearchParams(window.location.search).get("next") || "/dashboard");
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4">
    <h1 className="text-2xl font-semibold">Sign in to RaceDeck</h1>
    <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border p-3" />
    <input required type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border p-3" />
    <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
    <a href="/forgot-password" className="text-sm underline">Forgot password?</a>
    <p className="text-sm">No account? <a href="/register" className="underline">Register</a></p>
  </form></main>;
}
