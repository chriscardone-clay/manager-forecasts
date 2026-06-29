/* Vercel serverless function: POST /api/ai
 *
 * Calls the Anthropic (Claude) Messages API server-side, so the API key never
 * touches the browser. Gated to authenticated @clay.com users. Actions:
 *   { action: "status" }                   → { configured: bool }   (is the key set?)
 *   { action: "tips", notes }              → { tips: [{source, text}] }
 *   { action: "ask", question, context }   → { answer }
 *
 * Until ANTHROPIC_API_KEY is set, tips/ask return 503 { code:"ai_not_configured" }
 * and the UI shows a "coming soon" state.
 *
 * Required server env (Vercel → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY    your Claude API key (server-only)
 *   AI_MODEL (optional)  e.g. "claude-sonnet-4-6" (default below)
 */
import { requireUser } from "./_lib/auth.js";

const MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";

async function callModel({ system, user, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error("ai_not_configured"); e.code = "ai_not_configured"; throw e; }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const action = body?.action;

  // Lightweight status ping so the UI can show a "coming soon" state.
  if (action === "status") return res.status(200).json({ configured: !!process.env.ANTHROPIC_API_KEY });

  // Not wired up yet → coming soon.
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI is coming soon — not configured yet.", code: "ai_not_configured" });
  }

  try {
    if (action === "tips") {
      const notes = String(body.notes || "").slice(0, 12000);
      if (!notes.trim()) return res.status(400).json({ error: "no notes provided" });
      const content = await callModel({
        system: "You help a sales leader prep the weekly forecast meeting. From the pasted Slack wins and Gong/call notes, extract 1-3 concrete, repeatable pipeline-generation tips the team can reuse — a talk track that opened a door, or a win worth modeling. Be specific and actionable. Return ONLY a JSON array, no markdown, each item {\"source\":\"Slack\"|\"Gong\"|\"Other\",\"text\":\"...\"}.",
        user: notes,
        maxTokens: 1000,
      });
      const clean = content.replace(/```json|```/g, "").trim();
      let tips = [];
      try { tips = JSON.parse(clean); } catch { tips = []; }
      return res.status(200).json({ tips: Array.isArray(tips) ? tips.slice(0, 3) : [] });
    }

    if (action === "ask") {
      const question = String(body.question || "").slice(0, 2000);
      if (!question.trim()) return res.status(400).json({ error: "no question provided" });
      const ctxStr = JSON.stringify(body.context ?? {}).slice(0, 120000);
      const content = await callModel({
        system: "You are a sales-forecasting analyst. Answer the user's question using ONLY the provided forecast data, which spans the current week and previous weeks. Be concise and specific: cite figures and the week date they come from, and call out week-over-week changes when relevant. If the data doesn't support an answer, say so plainly rather than guessing.",
        user: `FORECAST DATA (JSON — keys are "meta" and weeks keyed by date):\n${ctxStr}\n\nQUESTION:\n${question}`,
        maxTokens: 1200,
      });
      return res.status(200).json({ answer: content });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    if (e?.code === "ai_not_configured") return res.status(503).json({ error: "AI is coming soon — not configured yet.", code: "ai_not_configured" });
    return res.status(502).json({ error: String(e?.message || e) });
  }
}
