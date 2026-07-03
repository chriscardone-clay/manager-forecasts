/* Key/value persistence with concurrency safety.
 *
 * Backed by the same Supabase `forecast_kv` table (or localStorage when no
 * backend is configured — dev mode). Three properties the old layer lacked:
 *
 * 1. CONFLICT-GUARDED WRITES — every row's `updated_at` acts as an optimistic
 *    lock. kvWrite() only updates the row if it still has the stamp we last
 *    saw; otherwise it reports { conflict, serverValue } so the app can rebase
 *    local edits onto the teammate's newer copy instead of clobbering it.
 * 2. ERRORS SURFACE — nothing is swallowed. Callers see failures and retry.
 * 3. AUDIT ENTRIES ARE INDIVIDUAL ROWS — key `audit:<ts>:<id>`, so each edit
 *    appends one small row instead of rewriting one ever-growing blob.
 */
import { supabase, supabaseConfigured, KV_TABLE } from "./supabase.js";

const LS = typeof window !== "undefined" ? window.localStorage : null;
const stamps = new Map(); // key -> last-seen updated_at (supabase only)
const nowISO = () => new Date().toISOString();

export const kvStampOf = (key) => stamps.get(key);

export async function kvGet(key) {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from(KV_TABLE).select("value,updated_at").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    stamps.set(key, data.updated_at);
    return data.value;
  }
  if (LS) { const v = LS.getItem("wfm:" + key); return v ? JSON.parse(v) : null; }
  return null;
}

/* All non-audit rows' stamps — cheap poll to detect teammates' changes. */
export async function kvStamps() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from(KV_TABLE).select("key,updated_at").not("key", "like", "audit:%");
  if (error) throw error;
  return data;
}

async function insertRow(key, value) {
  const ts = nowISO();
  const { error } = await supabase.from(KV_TABLE).insert({ key, value, updated_at: ts });
  if (!error) { stamps.set(key, ts); return { ok: true }; }
  if (error.code === "23505" || /duplicate|conflict/i.test(error.message || "")) {
    const { data: cur, error: e2 } = await supabase.from(KV_TABLE).select("value,updated_at").eq("key", key).maybeSingle();
    if (e2) throw e2;
    if (cur) { stamps.set(key, cur.updated_at); return { conflict: true, serverValue: cur.value }; }
  }
  throw error;
}

/* Conditional write. Resolves { ok } or { conflict, serverValue }; throws on
 * network/auth failure (caller shows the save-state indicator + retries). */
export async function kvWrite(key, value) {
  if (supabaseConfigured) {
    const known = stamps.get(key);
    if (!known) return insertRow(key, value);
    const ts = nowISO();
    const { data, error } = await supabase.from(KV_TABLE)
      .update({ value, updated_at: ts })
      .eq("key", key).eq("updated_at", known)
      .select("updated_at");
    if (error) throw error;
    if (data && data.length) { stamps.set(key, data[0].updated_at); return { ok: true }; }
    // Stamp mismatch (teammate wrote) or row vanished — find out which.
    const { data: cur, error: e2 } = await supabase.from(KV_TABLE).select("value,updated_at").eq("key", key).maybeSingle();
    if (e2) throw e2;
    if (!cur) { stamps.delete(key); return insertRow(key, value); }
    stamps.set(key, cur.updated_at);
    return { conflict: true, serverValue: cur.value };
  }
  if (LS) { LS.setItem("wfm:" + key, JSON.stringify(value)); return { ok: true }; }
  return { ok: true };
}

/* Unconditional upsert — audit rows and migrations (keys are unique per entry). */
export async function kvUpsert(key, value) {
  if (supabaseConfigured) {
    const { error } = await supabase.from(KV_TABLE).upsert({ key, value, updated_at: nowISO() }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  if (LS) LS.setItem("wfm:" + key, JSON.stringify(value));
}

export async function kvDelete(key) {
  if (supabaseConfigured) {
    const { error } = await supabase.from(KV_TABLE).delete().eq("key", key);
    if (error) throw error;
    return;
  }
  if (LS) LS.removeItem("wfm:" + key);
}

/* ---------- audit rows ---------- */
// Row key uses the entry's CREATION time (ts0) so coalescing re-flushes update
// the same row instead of creating duplicates.
export const auditRowKey = (e) => "audit:" + (e.ts0 || e.ts) + ":" + e.id;

export async function auditList(limit = 400) {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from(KV_TABLE).select("value").like("key", "audit:%")
      .order("key", { ascending: false }).limit(limit);
    if (error) throw error;
    return data.map((r) => r.value);
  }
  if (LS) {
    return Object.keys(LS).filter((k) => k.startsWith("wfm:audit:")).sort().reverse().slice(0, limit)
      .map((k) => { try { return JSON.parse(LS.getItem(k)); } catch { return null; } }).filter(Boolean);
  }
  return [];
}

/* 30-day retention — audit keys embed ISO timestamps, so they sort by age. */
export async function auditPrune(days = 30) {
  const cutoff = "audit:" + new Date(Date.now() - days * 86400000).toISOString();
  try {
    if (supabaseConfigured) await supabase.from(KV_TABLE).delete().like("key", "audit:%").lt("key", cutoff);
    else if (LS) Object.keys(LS).filter((k) => k.startsWith("wfm:audit:") && k < "wfm:" + cutoff).forEach((k) => LS.removeItem(k));
  } catch { /* best-effort */ }
}

/* One-time migration: the legacy single-blob "auditlog" row → individual rows.
 * Legacy entries carried full-workspace before-snapshots; mark them full:true
 * so Revert keeps its original whole-workspace meaning for them. Idempotent. */
export async function migrateLegacyAuditLog() {
  try {
    const legacy = await kvGet("auditlog");
    if (!Array.isArray(legacy)) return 0;
    for (const e of legacy) {
      const entry = { ...e, ts0: e.ts, full: true };
      await kvUpsert(auditRowKey(entry), entry);
    }
    await kvDelete("auditlog");
    return legacy.length;
  } catch { return -1; }
}
