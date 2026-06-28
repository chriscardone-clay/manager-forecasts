/* Vercel serverless function: POST /api/invite
 *
 * Invite-only access. An authenticated @clay.com user invites another @clay.com
 * user. Inviting requires the Supabase service_role key, which must NEVER be in
 * the browser — it lives only here (server-side Vercel env var) and is used via
 * the shared requireUser() helper.
 *
 * Required server env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ALLOWED_EMAIL_DOMAIN, APP_URL (optional).
 */
import { requireUser, onDomain } from "./_lib/auth.js";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
const APP_URL = process.env.APP_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // Authenticate the caller (must be an allowed-domain signed-in user).
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // Validate the target email.
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const target = (body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return res.status(400).json({ error: "invalid email" });
  if (!onDomain(target)) return res.status(400).json({ error: `only @${ALLOWED_DOMAIN} addresses can be invited` });

  // Invite (service-role client from the helper).
  const { error: inviteErr } = await auth.admin.auth.admin.inviteUserByEmail(
    target, APP_URL ? { redirectTo: APP_URL } : undefined
  );
  if (inviteErr) {
    if (/already|registered|exists/i.test(inviteErr.message)) {
      return res.status(200).json({ ok: true, note: "already invited" });
    }
    return res.status(400).json({ error: inviteErr.message });
  }
  return res.status(200).json({ ok: true });
}
