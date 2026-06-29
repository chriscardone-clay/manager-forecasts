/* Key/value persistence. Supabase when configured (one forecast_kv row per key),
 * else window.storage (Claude host), else localStorage. Keys: "meta",
 * "week:<date>", "auditlog". */
import { supabase, supabaseConfigured, KV_TABLE } from "./supabase.js";

const hasStore = typeof window !== "undefined" && window.storage;
const LS = typeof window !== "undefined" ? window.localStorage : null;

export async function sget(k) {
  try {
    if (supabaseConfigured) {
      const { data, error } = await supabase.from(KV_TABLE).select("value").eq("key", k).maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    }
    if (hasStore) { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
    if (LS) { const v = LS.getItem("wfm:" + k); return v ? JSON.parse(v) : null; }
    return null;
  } catch { return null; }
}

export async function sset(k, v) {
  try {
    if (supabaseConfigured) {
      const { error } = await supabase.from(KV_TABLE).upsert(
        { key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: "key" }
      );
      if (error) throw error;
      return;
    }
    if (hasStore) { await window.storage.set(k, JSON.stringify(v)); return; }
    if (LS) LS.setItem("wfm:" + k, JSON.stringify(v));
  } catch { /* ignore */ }
}

export async function sdel(k) {
  try {
    if (supabaseConfigured) { await supabase.from(KV_TABLE).delete().eq("key", k); return; }
    if (LS) LS.removeItem("wfm:" + k);
  } catch { /* ignore */ }
}
