"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient(); const [email, setEmail] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setMessage(error?.message ?? "If an account exists, a password reset email has been sent."); }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4"><h1 className="text-2xl font-semibold">Reset your password</h1><input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border p-3" /><button className="w-full rounded bg-black p-3 text-white">Send reset link</button>{message && <p role="status" className="text-sm">{message}</p>}<a href="/login" className="text-sm underline">Back to sign in</a></form></main>;
}
