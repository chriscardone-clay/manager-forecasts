/* AI calls go through the /api/ai serverless function (Claude API, server-side).
 * Gated to signed-in @clay.com users; shows a "coming soon" state until the key
 * is set. */
import { useState, useEffect } from "react";
import { supabase, supabaseConfigured } from "./supabase.js";

export async function callAI(payload) {
  if (!supabaseConfigured) throw new Error("AI needs the deployed app (sign in required).");
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "AI request failed.");
  return j;
}

// "checking" | "on" | "off"
export function useAIStatus() {
  const [status, setStatus] = useState(supabaseConfigured ? "checking" : "off");
  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    callAI({ action: "status" })
      .then((r) => active && setStatus(r?.configured ? "on" : "off"))
      .catch(() => active && setStatus("off"));
    return () => { active = false; };
  }, []);
  return status;
}
