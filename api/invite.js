/* Vercel serverless function: POST /api/invite
 *
 * Invite-only access. An authenticated @clay.com user grants another @clay.com
 * user access. This requires the Supabase service_role key, which must NEVER be
 * in the browser — it lives only here (server-side Vercel env var) and is used
 * via the shared requireUser() helper.
 *
 * We create the user with email_confirm:true (the equivalent of the Supabase
 * dashboard's "Auto Confirm User"). There is no email-confirmation flow, so an
 * unconfirmed user would be blocked from the one-time-code sign-in; auto-
 * confirming on creation removes that block — they can sign in immediately.
 *
 * Required server env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_EMAIL_DOMAIN.
 */
import { requireUser, onDomain } from "./_lib/auth.js";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();

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

  // Create the user already confirmed (service-role client from the helper), so
  // the one-time-code sign-in works right away with no confirmation step.
  const { error: createErr } = await auth.admin.auth.admin.createUser({
    email: target,
    email_confirm: true,
  });
  if (createErr) {
    if (/already|registered|exists/i.test(createErr.message)) {
      return res.status(200).json({ ok: true, note: "already has access" });
    }
    return res.status(400).json({ error: createErr.message });
  }
  return res.status(200).json({ ok: true });
}
