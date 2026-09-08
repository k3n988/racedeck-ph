"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OrganizerRegisterPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", organization: "", email: "", password: "" });
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/organizer/verification`,
      data: { first_name: form.firstName, last_name: form.lastName, account_type: "organizer", organization_name: form.organization },
    }});
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage(data.session ? "Organizer account created. Redirecting…" : "Account created. Verify your email to finish setup.");
    if (data.session) {
      await fetch("/api/auth/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: form.organization }) });
      window.location.assign("/organizer/verification");
    }
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4">
    <h1 className="text-2xl font-semibold">Register as an organizer</h1>
    <input required placeholder="Your first name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded border p-3" />
    <input required placeholder="Your last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded border p-3" />
    <input required placeholder="Organization name" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full rounded border p-3" />
    <input required type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border p-3" />
    <input required minLength={8} type="password" autoComplete="new-password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded border p-3" />
    <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-50">{busy ? "Creating…" : "Create organizer account"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}<p className="text-sm">Already registered? <a href="/login" className="underline">Sign in</a></p>
  </form></main>;
}
