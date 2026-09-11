"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (busy) return;
    event.preventDefault(); setBusy(true); setMessage("");
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      data: { first_name: form.firstName, last_name: form.lastName, account_type: "participant" },
    }});
    setBusy(false);
    if (error) { setBusy(false); setMessage(error.message); return; }
    if (!data.user) { setBusy(false); setMessage("Supabase did not create the account. Check the configured Supabase project and try again."); return; }
    if (data.user.identities?.length === 0) { setBusy(false); setMessage("This email is already registered. Use the participant sign-in page or a different email."); return; }
    setMessage(data.session ? "Account created. Redirecting…" : "Account created. Check your email to verify it.");
    if (data.session) {
      const provisionResponse = await fetch("/api/auth/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!provisionResponse.ok) { setBusy(false); setMessage("Account was created, but profile setup could not be completed. Please try signing in again."); return; }
      await supabase.auth.signOut();
    }
    setMessage("Participant account created. Check your email, verify it, then sign in to continue.");
    window.setTimeout(() => window.location.assign("/login?portal=participant&registered=1"), 1200);
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Participant Portal</p>
    <h1 className="text-2xl font-semibold">Create your participant account</h1>
    <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded border p-3" />
    <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded border p-3" />
    <input required type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border p-3" />
    <input required minLength={8} type="password" autoComplete="new-password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded border p-3" />
    <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}<p className="text-sm">Already registered? <a href="/login?portal=participant" className="underline">Sign in</a></p>
    <p className="text-sm">Organizing a race? <a href="/organizer-register" className="underline">Register as an organizer</a></p>
  </form></main>;
}
