/* Vercel serverless function: POST /api/ai
 *
 * Routes AI calls through the Vercel AI Gateway (OpenAI-compatible endpoint) so
 * the model key never touches the browser. Gated to authenticated @clay.com
 * users. Two actions:
 *   { action: "tips", notes }              → { tips: [{source, text}] }
 *   { action: "ask", question, context }   → { answer }   (context = forecast data)
 *
 * Required server env (Vercel → Settings → Environment Variables):
 *   AI_GATEWAY_API_KEY   the Vercel AI Gateway key
 *   AI_MODEL (optional)  e.g. "anthropic/claude-sonnet-4.5" (default below)
 */
import { requireUser } from "./_lib/auth.js";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL = process.env.AI_MODEL || "anthropic/claude-sonnet-4.5";

async function callModel(messages, maxTokens) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error("AI is not configured (missing AI_GATEWAY_API_KEY).");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const action = body?.action;

  try {
    if (action === "tips") {
      const notes = String(body.notes || "").slice(0, 12000);
      if (!notes.trim()) return res.status(400).json({ error: "no notes provided" });
      const content = await callModel([
        { role: "system", content: "You help a sales leader prep the weekly forecast meeting. From the pasted Slack wins and Gong/call notes, extract 1-3 concrete, repeatable pipeline-generation tips the team can reuse — a talk track that opened a door, or a win worth modeling. Be specific and actionable. Return ONLY a JSON array, no markdown, each item {\"source\":\"Slack\"|\"Gong\"|\"Other\",\"text\":\"...\"}." },
        { role: "user", content: notes },
      ], 1000);
      const clean = content.replace(/```json|```/g, "").trim();
      let tips = [];
      try { tips = JSON.parse(clean); } catch { tips = []; }
      return res.status(200).json({ tips: Array.isArray(tips) ? tips.slice(0, 3) : [] });
    }

    if (action === "ask") {
      const question = String(body.question || "").slice(0, 2000);
      if (!question.trim()) return res.status(400).json({ error: "no question provided" });
      const ctxStr = JSON.stringify(body.context ?? {}).slice(0, 120000);
      const content = await callModel([
        { role: "system", content: "You are a sales-forecasting analyst. Answer the user's question using ONLY the provided forecast data, which spans the current week and previous weeks. Be concise and specific: cite figures and the week date they come from, and call out week-over-week changes when relevant. If the data doesn't support an answer, say so plainly rather than guessing." },
        { role: "user", content: `FORECAST DATA (JSON — keys are "meta" and weeks keyed by date):\n${ctxStr}\n\nQUESTION:\n${question}` },
      ], 1200);
      return res.status(200).json({ answer: content });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(502).json({ error: String(e?.message || e) });
  }
}
