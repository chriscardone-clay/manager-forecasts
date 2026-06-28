/* Shared server-side auth for the serverless API.
 * Verifies the caller's Supabase access token and restricts to the allowed
 * email domain. Uses the service-role key (server-only). Files under api/_lib
 * are not routes — they're imported by the route handlers. */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();

export const onDomain = (email) => !ALLOWED_DOMAIN || (email || "").toLowerCase().endsWith("@" + ALLOWED_DOMAIN);

// Returns { ok:true, email, admin } or { ok:false, status, error }.
export async function requireUser(req) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return { ok: false, status: 500, error: "server not configured" };
  const authz = req.headers.authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "not authenticated" };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = (data?.user?.email || "").toLowerCase();
  if (error || !email) return { ok: false, status: 401, error: "invalid session" };
  if (!onDomain(email)) return { ok: false, status: 403, error: "not allowed" };
  return { ok: true, email, admin };
}
