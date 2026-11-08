"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OrganizerRegisterPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", organization: "", email: "", password: "" });
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (busy) return;
    event.preventDefault(); setBusy(true); setMessage("");
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/organizer/organization`,
      data: { first_name: form.firstName, last_name: form.lastName, account_type: "organizer", organization_name: form.organization },
    }});
    setBusy(false);
    if (error) { setBusy(false); setMessage(error.message); return; }
    if (!data.user) { setBusy(false); setMessage("Supabase did not create the account. Check the configured Supabase project and try again."); return; }
    if (data.user.identities?.length === 0) { setBusy(false); setMessage("This email is already registered. Use the Organizer sign-in page or a different email."); return; }
    if (data.session) {
      const provisionResponse = await fetch("/api/auth/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: form.organization }) });
      if (!provisionResponse.ok) { setBusy(false); setMessage("Account was created, but organizer setup could not be completed. Please try signing in again or contact support."); return; }
      await supabase.auth.signOut();
      window.location.assign("/organizer/organization");
    }
    setMessage("Organizer account created. Check your email, verify it, then sign in to continue.");
    window.setTimeout(() => window.location.assign("/login?portal=organizer&registered=1"), 1200);
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Organizer Portal</p>
    <h1 className="text-2xl font-semibold">Create your organizer account</h1>
    <input required placeholder="Your first name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded border p-3" />
    <input required placeholder="Your last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded border p-3" />
    <input required placeholder="Organization name" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full rounded border p-3" />
    <input required type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border p-3" />
    <input required minLength={8} type="password" autoComplete="new-password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded border p-3" />
    <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-50">{busy ? "Creating…" : "Create organizer account"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}<p className="text-sm">Already registered? <a href="/login?portal=organizer" className="underline">Sign in</a></p>
    <p className="text-sm">Joining a race? <a href="/register" className="underline">Register as a participant</a></p>
  </form></main>;
}
