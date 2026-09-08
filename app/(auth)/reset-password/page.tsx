"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient(); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const { error } = await supabase.auth.updateUser({ password }); setMessage(error?.message ?? "Password updated. You can now sign in."); }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><form onSubmit={submit} className="w-full space-y-4"><h1 className="text-2xl font-semibold">Choose a new password</h1><input required minLength={8} type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border p-3" /><button className="w-full rounded bg-black p-3 text-white">Update password</button>{message && <p role="status" className="text-sm">{message}</p>}</form></main>;
}
