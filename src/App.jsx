import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import { supabase, supabaseConfigured, ALLOWED_EMAIL_DOMAIN, KV_TABLE } from "./supabase.js";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Users, ArrowUpDown, Megaphone, Lightbulb, TrendingDown,
  FileText, Settings as SettingsIcon, Plus, Trash2, Check, X, Copy, Sparkles,
  ChevronUp, ChevronDown, AlertTriangle, Activity, Download, Upload, LogOut,
  ShieldCheck, MessageCircle, Send,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Weekly Forecast Cockpit
 * A live console for the weekly forecast meeting: manager calls,
 * swings, headlines, pipeline tips, and trending-behind accounts —
 * all snapshotted week over week.
 * ------------------------------------------------------------------ */

const T = {
  ink: "#0E1116", panel: "#161B22", panel2: "#1C232D", line: "#2A323D",
  text: "#E6EDF3", muted: "#8B98A5", faint: "#5B6673",
  accent: "#4CC2FF", up: "#3FB950", down: "#F85149", warn: "#D6A126",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
* { box-sizing: border-box; }
.wfm, .wfm * { font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.wfm .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.wfm {
  background:${T.ink}; color:${T.text}; min-height:100vh; width:100%;
  display:flex; flex-direction:column; -webkit-font-smoothing:antialiased;
}
.wfm button { font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
.wfm input, .wfm textarea, .wfm select {
  font-family:inherit; background:${T.ink}; color:${T.text};
  border:1px solid ${T.line}; border-radius:7px; padding:7px 9px; font-size:13px; outline:none;
  transition:border-color .15s, box-shadow .15s;
}
.wfm input:focus, .wfm textarea:focus, .wfm select:focus {
  border-color:${T.accent}; box-shadow:0 0 0 3px rgba(76,194,255,.13);
}
.wfm input::placeholder, .wfm textarea::placeholder { color:${T.faint}; }

/* topbar */
.wfm .top { display:flex; align-items:center; gap:20px; padding:12px 22px;
  position:sticky; top:0; z-index:20;
  border-bottom:1px solid ${T.line};
  background:linear-gradient(180deg,#171D25,${T.panel});
  box-shadow:0 1px 0 rgba(0,0,0,.25), 0 6px 18px -12px rgba(0,0,0,.6); }
.wfm .brand { display:flex; align-items:center; gap:11px; }
.wfm .brand .logo { width:34px; height:34px; border-radius:9px; display:grid; place-items:center;
  color:#04121d; background:linear-gradient(150deg,${T.accent},#7ad6ff);
  box-shadow:0 2px 10px -2px rgba(76,194,255,.6); flex:none; }
.wfm .brand .bt { display:flex; flex-direction:column; line-height:1.12; }
.wfm .brand b { font-size:15px; font-weight:750; letter-spacing:-.2px; }
.wfm .brand span { font-size:10px; color:${T.muted}; letter-spacing:.6px; text-transform:uppercase; }
.wfm .gauge { flex:1; max-width:440px; min-width:160px; }
.wfm .gauge .gl { display:flex; justify-content:space-between; align-items:baseline;
  font-size:11px; color:${T.muted}; margin-bottom:6px; }
.wfm .gauge .gl .pp { font-weight:700; font-size:12px; }
.wfm .bar { height:9px; background:${T.panel2}; border-radius:99px; overflow:hidden;
  position:relative; box-shadow:inset 0 0 0 1px rgba(255,255,255,.04); }
.wfm .bar i { display:block; height:100%; border-radius:99px; transition:width .5s cubic-bezier(.2,.8,.2,1); }
.wfm .tpill { display:flex; flex-direction:column; align-items:flex-end; gap:1px;
  padding:6px 13px; border:1px solid ${T.line}; border-radius:10px; background:rgba(255,255,255,.02); }
.wfm .tpill small { font-size:9.5px; color:${T.muted}; text-transform:uppercase; letter-spacing:.6px; }
.wfm .tpill b { font-size:17px; font-weight:650; letter-spacing:-.3px; }
.wfm .wk { display:flex; align-items:center; gap:8px; }
.wfm .acct { display:flex; align-items:center; gap:9px; padding-left:14px; margin-left:2px;
  border-left:1px solid ${T.line}; }
.wfm .acct .who { display:flex; flex-direction:column; align-items:flex-end; line-height:1.15; }
.wfm .acct .who .lbl { font-size:9px; color:${T.faint}; text-transform:uppercase; letter-spacing:.5px; }
.wfm .acct .who .em { font-size:11.5px; color:${T.muted}; max-width:180px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.wfm .iconbtn { display:grid; place-items:center; width:30px; height:30px; border-radius:8px;
  border:1px solid ${T.line}; background:${T.panel2}; color:${T.muted}; cursor:pointer; flex:none; }
.wfm .iconbtn:hover { color:${T.text}; border-color:${T.faint}; }

/* shell */
.wfm .shell { display:flex; flex:1; min-height:0; }
.wfm .nav { width:208px; border-right:1px solid ${T.line}; padding:14px 10px; background:${T.panel};
  display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
.wfm .nav button { display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:8px;
  font-size:13px; color:${T.muted}; text-align:left; transition:background .12s,color .12s; width:100%; }
.wfm .nav button:hover { background:${T.panel2}; color:${T.text}; }
.wfm .nav button.on { background:rgba(76,194,255,.12); color:${T.accent}; }
.wfm .nav button.on svg { color:${T.accent}; }
.wfm .nav .navtag { margin-left:auto; font-size:10px; padding:1px 6px; border-radius:99px;
  background:${T.down}; color:#fff; font-weight:600; }
.wfm .main { flex:1; overflow:auto; padding:24px 28px 60px; }
.wfm .main { animation:fade .35s ease; }
@keyframes fade { from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;} }

.wfm h2 { font-size:19px; font-weight:600; margin:0 0 3px; letter-spacing:-.3px; }
.wfm .sub { font-size:12.5px; color:${T.muted}; margin:0 0 18px; max-width:640px; line-height:1.5; }

/* cards */
.wfm .card { background:${T.panel}; border:1px solid ${T.line}; border-radius:12px; padding:16px 18px; }
.wfm .grid { display:grid; gap:14px; }
.wfm .tape { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:12px; }
.wfm .mcard { background:${T.panel}; border:1px solid ${T.line}; border-radius:11px; padding:13px 14px; }
.wfm .mcard .mn { font-size:12px; color:${T.muted}; margin-bottom:7px; }
.wfm .mcard .mv { font-size:23px; font-weight:600; letter-spacing:-.5px; }
.wfm .delta { font-size:12px; display:inline-flex; align-items:center; gap:2px; margin-top:4px; }

/* table */
.wfm table { width:100%; border-collapse:collapse; }
.wfm th { text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.6px;
  color:${T.muted}; font-weight:600; padding:8px 10px; border-bottom:1px solid ${T.line}; }
.wfm td { padding:7px 10px; border-bottom:1px solid ${T.panel2}; font-size:13px; vertical-align:middle; }
.wfm tr:last-child td { border-bottom:none; }
.wfm td input, .wfm td select { width:100%; }
.wfm .cellnum input { text-align:right; font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; }

/* buttons */
.wfm .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 13px; border-radius:8px;
  font-size:13px; font-weight:500; transition:filter .12s,background .12s,border-color .12s; }
.wfm .btn.pri { background:${T.accent}; color:#06141d; font-weight:600; }
.wfm .btn.pri:hover { filter:brightness(1.08); }
.wfm .btn.gho { border:1px solid ${T.line}; color:${T.text}; }
.wfm .btn.gho:hover { border-color:${T.accent}; color:${T.accent}; }
.wfm .btn.sm { padding:5px 9px; font-size:12px; }
.wfm .ico { padding:6px; border-radius:7px; color:${T.faint}; transition:color .12s,background .12s; }
.wfm .ico:hover { color:${T.down}; background:${T.panel2}; }

.wfm .row { display:flex; align-items:center; gap:10px; }
.wfm .between { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.wfm .tag { font-size:10.5px; padding:2px 8px; border-radius:99px; font-weight:600; letter-spacing:.3px; }
.wfm .empty { border:1px dashed ${T.line}; border-radius:11px; padding:26px; text-align:center; color:${T.muted}; font-size:13px; }
.wfm .empty b { color:${T.text}; display:block; margin-bottom:4px; font-size:14px; }

/* tips */
.wfm .tip { display:flex; gap:12px; align-items:flex-start; padding:13px 14px; border:1px solid ${T.line};
  border-radius:11px; transition:border-color .12s; }
.wfm .tip.inc { border-color:rgba(63,185,80,.5); background:rgba(63,185,80,.05); }
.wfm .chk { width:21px; height:21px; border-radius:6px; border:1.5px solid ${T.line}; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; margin-top:1px; transition:all .12s; }
.wfm .chk.on { background:${T.up}; border-color:${T.up}; color:#06141d; }
.wfm .src { font-size:10px; padding:1px 7px; border-radius:99px; border:1px solid ${T.line}; color:${T.muted}; }

.wfm .out { background:${T.ink}; border:1px solid ${T.line}; border-radius:10px; padding:16px; font-size:13px;
  line-height:1.6; white-space:pre-wrap; max-height:440px; overflow:auto; }
.wfm .out .mono { font-size:12.5px; }
.wfm .notice { font-size:11.5px; color:${T.warn}; display:flex; gap:7px; align-items:flex-start;
  background:rgba(214,161,38,.08); border:1px solid rgba(214,161,38,.28); border-radius:9px; padding:9px 12px; }
.wfm label.fld { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:${T.muted}; }
.wfm .seg { display:inline-flex; border:1px solid ${T.line}; border-radius:8px; overflow:hidden; }
.wfm .seg button { padding:6px 12px; font-size:12px; color:${T.muted}; }
.wfm .seg button.on { background:${T.accent}; color:#06141d; font-weight:600; }
.wfm .drop { border:1.5px dashed ${T.line}; border-radius:11px; padding:32px 20px; text-align:center;
  cursor:pointer; transition:border-color .15s, background .15s, color .15s; color:${T.muted}; outline:none; }
.wfm .drop:hover, .wfm .drop:focus-visible { border-color:${T.accent}; color:${T.text}; }
.wfm .drop.over { border-color:${T.accent}; background:rgba(76,194,255,.07); color:${T.text}; }
.wfm .drop b { display:block; color:${T.text}; font-size:14px; margin-bottom:4px; }
.wfm .drop .di { color:${T.accent}; margin-bottom:8px; }
.wfm .map { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:14px 0; }
.wfm .map label { font-size:11px; color:${T.muted}; display:flex; flex-direction:column; gap:5px; }
.wfm .map select.bad { border-color:${T.down}; }
.wfm .prev th, .wfm .prev td { padding:5px 9px; font-size:12px; }
.wfm .prev td { color:${T.text}; }
@media (prefers-reduced-motion: reduce){ .wfm *{ animation:none!important; transition:none!important; } }
`;

/* ---------- storage helpers ----------
 * Backends, in priority order:
 *   1. Supabase  — shared, durable, cross-device storage (when configured via
 *      VITE_SUPABASE_* env vars). All reads/writes go through one `forecast_kv`
 *      key/value table; access is gated by Row Level Security (see SETUP.md).
 *   2. window.storage — present only when running inside the Claude host.
 *   3. localStorage — zero-config fallback so `npm run dev` works offline, but
 *      data lives in that one browser only (not shared, not durable).
 * Every entry holds the same JSON value, so the backends are interchangeable. */
const hasStore = typeof window !== "undefined" && window.storage;
const LS = typeof window !== "undefined" ? window.localStorage : null;
async function sget(k) {
  try {
    if (supabaseConfigured) {
      const { data, error } = await supabase.from(KV_TABLE).select("value").eq("key", k).maybeSingle();
      if (error) throw error;
      return data ? data.value : null; // value is a jsonb column — already parsed
    }
    if (hasStore) { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
    if (LS) { const v = LS.getItem("wfm:" + k); return v ? JSON.parse(v) : null; }
    return null;
  } catch { return null; }
}
async function sset(k, v) {
  try {
    if (supabaseConfigured) {
      const { error } = await supabase.from(KV_TABLE).upsert(
        { key: k, value: v, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      return;
    }
    if (hasStore) { await window.storage.set(k, JSON.stringify(v)); return; }
    if (LS) LS.setItem("wfm:" + k, JSON.stringify(v));
  } catch { /* ignore quota / serialization / network errors */ }
}

/* ---------- auth gate (email one-time-password) ----------
 * When Supabase is configured, require a signed-in user before the app loads.
 * Login is passwordless: the user enters their email, Supabase emails a 6-digit
 * one-time code, they type it back. If VITE_ALLOWED_EMAIL_DOMAIN is set (e.g.
 * "clay.com") only that domain may request a code. That client check is UX; the
 * hard enforcement is the Row Level Security policies on the database (see
 * SETUP.md), which reject any read/write whose JWT email isn't on the domain. */
const gateWrap = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: T.ink, color: T.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: 24,
};
const gateCard = {
  width: "100%", maxWidth: 380, background: T.panel, border: `1px solid ${T.line}`,
  borderRadius: 14, padding: 28, textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.4)",
};
const gateBtn = {
  width: "100%", marginTop: 18, padding: "11px 14px", borderRadius: 9, cursor: "pointer",
  border: `1px solid ${T.line}`, background: T.accent, color: "#04121d", fontWeight: 700, fontSize: 14,
};
const gateInput = {
  width: "100%", marginTop: 14, padding: "11px 12px", borderRadius: 9, fontSize: 14, boxSizing: "border-box",
  border: `1px solid ${T.line}`, background: T.panel2, color: T.text,
};
const gateLink = {
  marginTop: 14, background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, textDecoration: "underline",
};

function AuthGate({ children }) {
  // `undefined` = still checking, `null` = signed out, object = signed in.
  const [session, setSession] = useState(undefined);
  const [step, setStep] = useState("email"); // "email" → "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // No backend configured → no auth; run on localStorage exactly as before.
  if (!supabaseConfigured) return children;

  const domainOk = (e) =>
    !ALLOWED_EMAIL_DOMAIN || e.trim().toLowerCase().endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase());

  async function sendCode(ev) {
    ev?.preventDefault?.();
    const addr = email.trim().toLowerCase();
    setErr(""); setMsg("");
    if (!domainOk(addr)) { setErr(`Use your @${ALLOWED_EMAIL_DOMAIN} email.`); return; }
    setBusy(true);
    // Invite-only: shouldCreateUser:false means a code is sent ONLY if this email
    // already has an account (i.e. was invited). No self sign-up.
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      setErr(/signup|not allowed|user not found|not found/i.test(error.message)
        ? "No account for that email yet. Ask an admin to invite you."
        : error.message);
      return;
    }
    setStep("code"); setMsg(`We emailed a 6-digit code to ${addr}.`);
  }

  async function verify(ev) {
    ev?.preventDefault?.();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: code.trim(), type: "email",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    // onAuthStateChange sets the session and the app loads.
  }

  if (session === undefined) {
    return <div style={gateWrap}><div style={{ color: T.muted }}>Checking your session…</div></div>;
  }

  if (!session) {
    return (
      <div style={gateWrap}>
        <form style={gateCard} onSubmit={step === "email" ? sendCode : verify}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Forecast Cockpit</div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>Weekly Manager Review</div>
          {step === "email" ? (
            <>
              <input style={gateInput} type="email" autoFocus autoComplete="email"
                placeholder={`you@${ALLOWED_EMAIL_DOMAIN || "company.com"}`}
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button style={gateBtn} type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
              {ALLOWED_EMAIL_DOMAIN && (
                <div style={{ color: T.faint, fontSize: 11, marginTop: 14 }}>Restricted to @{ALLOWED_EMAIL_DOMAIN} emails.</div>
              )}
            </>
          ) : (
            <>
              <input style={gateInput} inputMode="numeric" autoFocus autoComplete="one-time-code"
                placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button style={gateBtn} type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in"}</button>
              <button style={gateLink} type="button"
                onClick={() => { setStep("email"); setCode(""); setErr(""); setMsg(""); }}>
                Use a different email
              </button>
            </>
          )}
          {msg && <div style={{ color: T.muted, fontSize: 12, marginTop: 12 }}>{msg}</div>}
          {err && <div style={{ color: T.down, fontSize: 12, marginTop: 12 }}>{err}</div>}
        </form>
      </div>
    );
  }

  const signedEmail = (session.user?.email || "").toLowerCase();
  if (ALLOWED_EMAIL_DOMAIN && !signedEmail.endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
    return (
      <div style={gateWrap}>
        <div style={gateCard}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.down }}>Access restricted</div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 8 }}>
            {signedEmail || "This account"} isn't on the @{ALLOWED_EMAIL_DOMAIN} domain.
          </div>
          <button style={gateLink} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return children;
}

/* ---------- AI calls ----------
 * AI runs server-side via the /api/ai serverless function (Vercel AI Gateway),
 * so no model key is ever in the browser. callAI sends the signed-in user's
 * Supabase token; the function verifies it and is restricted to @clay.com. */
async function callAI(payload) {
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

/* ---------- utils ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const money = (n) => (n == null || n === "" || isNaN(n)) ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
const pct = (n) => (n == null || n === "" || isNaN(n)) ? "—" : `${Number(n).toFixed(0)}%`;
const num = (v) => v === "" || v == null ? null : Number(v);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function thisMonday() {
  const d = new Date(); const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10);
}

const NAV = [
  ["overview", "Overview", LayoutDashboard],
  ["calls", "Manager Calls", Users],
  ["grr", "GRR", ShieldCheck],
  ["swings", "Swings", ArrowUpDown],
  ["headlines", "Headlines", Megaphone],
  ["tips", "Pipeline Tips", Lightbulb],
  ["trending", "Trending", TrendingDown],
  ["update", "Weekly Update", FileText],
  ["ask", "Ask AI", MessageCircle],
  ["settings", "Settings", SettingsIcon],
];

const TIP_STATUS = [
  ["not_tried", "Not tried", "muted"],
  ["in_progress", "In progress", "warn"],
  ["successful", "Successful", "up"],
];

function blankWeek(date, managers, prev) {
  const calls = {};
  managers.forEach((m) => {
    const p = prev?.calls?.[m];
    calls[m] = {
      call: p?.call ?? null, commit: p?.commit ?? null, best: p?.best ?? null,
      goal: p?.goal ?? null, closedWon: null, note: "", prior: p?.call ?? null,
    };
  });
  return {
    id: date, date,
    plan: prev?.plan ?? null,
    calls,
    swings: [],
    headlines: (prev?.headlines || []).map((h) => ({ ...h, id: uid() })),
    tips: [],
    trending: (prev?.trending || []).map((t) => ({ ...t, id: uid(), actionPlan: t.actionPlan || "" })),
    grr: { rows: (prev?.grr?.rows || []).map((r) => ({ ...r, id: uid(), closedWon: null, grrCall: null })) },
  };
}

// Default trending thresholds, including the ahead-of-pace rule.
const DEFAULT_THRESHOLDS = { d180: 50, d270: 90, mode: "and", aheadD180: 90, aheadD270: 100, aheadMode: "and" };

export default function Root() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

function App() {
  const [meta, setMeta] = useState(null);
  const [weeks, setWeeks] = useState({});
  const [tab, setTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [authEmail, setAuthEmail] = useState(null);

  // Surface the signed-in account in the top bar (Supabase only).
  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => setAuthEmail(data.user?.email || null));
  }, []);

  // boot
  useEffect(() => {
    (async () => {
      let m = await sget("meta");
      if (!m) {
        // No data yet → start completely clean. The app never seeds demo/sample
        // data; an empty roster + blank week is the only initial state, so no one
        // can ever mistake placeholder figures for a real forecast.
        const d = thisMonday();
        m = { activeWeek: d, weeks: [d], managers: [], thresholds: { ...DEFAULT_THRESHOLDS } };
        const wk = blankWeek(d, [], null);
        await sset("meta", m); await sset("week:" + d, wk);
        setWeeks({ [d]: wk });
      } else {
        const all = {};
        for (const id of m.weeks) { const w = await sget("week:" + id); if (w) all[id] = w; }
        setWeeks(all);
      }
      setMeta(m); setLoaded(true);
    })();
  }, []);

  const week = meta ? weeks[meta.activeWeek] : null;

  function saveMeta(nm) { setMeta(nm); sset("meta", nm); }
  function updateWeek(fn) {
    const w = weeks[meta.activeWeek]; if (!w) return;
    const nw = fn(structuredClone(w));
    setWeeks({ ...weeks, [meta.activeWeek]: nw }); sset("week:" + nw.id, nw);
  }

  function newWeek() {
    const def = thisMonday();
    const d = prompt("Meeting date for the new week (YYYY-MM-DD):", def);
    if (!d) return;
    if (meta.weeks.includes(d)) { setMeta({ ...meta, activeWeek: d }); return; }
    const prev = weeks[meta.activeWeek];
    const wk = blankWeek(d, meta.managers, prev);
    const order = [...meta.weeks, d].sort();
    setWeeks({ ...weeks, [d]: wk }); sset("week:" + d, wk);
    saveMeta({ ...meta, weeks: order, activeWeek: d });
    setTab("calls");
  }

  // Export the full dataset (meta + every week) as one JSON file. Same shape the
  // importer reads, so an export is also a portable backup.
  function exportData() {
    const out = { exportedAt: new Date().toISOString(), meta };
    for (const id of Object.keys(weeks)) out["week:" + id] = weeks[id];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forecast-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Import a JSON export/backup. replace=true wipes current weeks; otherwise
  // imported weeks are merged in (overwriting any with the same date).
  async function importData(obj, { replace = false } = {}) {
    const data = obj?.cockpit ?? obj; // accept the recovery-snippet envelope too
    const m = data?.meta;
    if (!m || !Array.isArray(m.weeks)) throw new Error("Not a forecast export — no `meta` found.");
    const incoming = {};
    for (const k of Object.keys(data)) if (k.startsWith("week:")) incoming[k.slice(5)] = data[k];
    const nextWeeks = replace ? incoming : { ...weeks, ...incoming };
    const ids = Object.keys(nextWeeks).sort();
    const activeWeek = m.activeWeek && ids.includes(m.activeWeek) ? m.activeWeek : ids[ids.length - 1];
    const nextMeta = { ...m, weeks: ids, activeWeek };
    await sset("meta", nextMeta);
    for (const id of ids) await sset("week:" + id, nextWeeks[id]);
    setWeeks(nextWeeks); setMeta(nextMeta);
    return ids.length;
  }

  if (!loaded || !meta || !week) {
    return (<><style>{CSS}</style><div className="wfm"><div className="main">Loading the cockpit…</div></div></>);
  }

  const totalCall = meta.managers.reduce((s, m) => s + (week.calls[m]?.call || 0), 0);
  const totalCommit = meta.managers.reduce((s, m) => s + (week.calls[m]?.commit || 0), 0);
  const planPct = week.plan ? (totalCall / week.plan) * 100 : 0;
  const netSwing = week.swings.reduce((s, x) => s + (x.dir === "up" ? 1 : -1) * (x.amount || 0), 0);
  const gColor = planPct >= 100 ? T.up : planPct >= 92 ? T.warn : T.down;

  const flagged = week.trending.filter((r) => flag(r, meta.thresholds));

  const sortedWeeks = [...meta.weeks].sort();
  const idx = sortedWeeks.indexOf(meta.activeWeek);
  const prevWeek = idx > 0 ? weeks[sortedWeeks[idx - 1]] : null;

  return (
    <>
      <style>{CSS}</style>
      <div className="wfm">
        {/* TOP */}
        <div className="top">
          <div className="brand">
            <div className="logo"><Activity size={19} strokeWidth={2.4} /></div>
            <div className="bt"><b>Forecast Cockpit</b><span>Weekly Manager Review</span></div>
          </div>
          <div className="gauge">
            <div className="gl">
              <span>Call vs Plan</span>
              <span><span className="mono">{money(totalCall)} / {money(week.plan)}</span>
                <span className="pp mono" style={{ color: gColor, marginLeft: 8 }}>{week.plan ? pct(planPct) : "—"}</span></span>
            </div>
            <div className="bar"><i style={{ width: Math.min(100, planPct) + "%", background: gColor }} /></div>
          </div>
          <div className="tpill"><small>Net Swing</small>
            <b className="mono" style={{ color: netSwing >= 0 ? T.up : T.down }}>{netSwing >= 0 ? "+" : "−"}{money(Math.abs(netSwing))}</b>
          </div>
          <div className="wk">
            <select value={meta.activeWeek} onChange={(e) => saveMeta({ ...meta, activeWeek: e.target.value })}>
              {sortedWeeks.slice().reverse().map((d) => <option key={d} value={d}>Wk of {fmtDate(d)}</option>)}
            </select>
            <button className="btn pri sm" onClick={newWeek}><Plus size={15} />New week</button>
          </div>
          {supabaseConfigured && (
            <div className="acct">
              {authEmail && (
                <div className="who"><span className="lbl">Signed in</span><span className="em" title={authEmail}>{authEmail}</span></div>
              )}
              <button className="iconbtn" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={15} /></button>
            </div>
          )}
        </div>

        <div className="shell">
          {/* NAV */}
          <div className="nav">
            {NAV.map(([key, label, Icon]) => (
              <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
                <Icon size={16} />{label}
                {key === "trending" && flagged.length > 0 && <span className="navtag">{flagged.length}</span>}
                {key === "tips" && week.tips.filter((t) => t.included).length > 0 &&
                  <span className="navtag" style={{ background: T.up }}>{week.tips.filter((t) => t.included).length}</span>}
              </button>
            ))}
          </div>

          {/* MAIN */}
          <div className="main" key={tab + meta.activeWeek}>
            {tab === "overview" && <Overview {...{ meta, weeks, week, prevWeek, totalCall, totalCommit, netSwing, flagged }} />}
            {tab === "calls" && <Calls {...{ meta, week, prevWeek, updateWeek, saveMeta, totalCall }} />}
            {tab === "swings" && <Swings {...{ week, meta, updateWeek }} />}
            {tab === "headlines" && <Headlines {...{ week, meta, updateWeek }} />}
            {tab === "tips" && <Tips {...{ week, meta, updateWeek }} />}
            {tab === "grr" && <GRR {...{ week, meta, updateWeek }} />}
            {tab === "ask" && <AskAI {...{ meta, weeks }} />}
            {tab === "trending" && <Trending {...{ week, meta, updateWeek, flagged }} />}
            {tab === "update" && <Update {...{ meta, week, totalCall, totalCommit, netSwing, flagged }} />}
            {tab === "settings" && <SettingsTab {...{ meta, saveMeta, updateWeek, week, exportData, importData }} />}
          </div>
        </div>
      </div>
    </>
  );
}

function flag(r, t) {
  const checks = [];
  if (r.day180 != null) checks.push(r.day180 < t.d180);
  if (r.day270 != null) checks.push(r.day270 < t.d270);
  if (!checks.length) return false; // not yet measured at any milestone
  return t.mode === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

// Ahead-of-pace: an account pacing at/above the ahead thresholds.
function flagAhead(r, t) {
  const a180 = t.aheadD180 ?? 90, a270 = t.aheadD270 ?? 100, mode = t.aheadMode || "and";
  const checks = [];
  if (r.day180 != null) checks.push(r.day180 >= a180);
  if (r.day270 != null) checks.push(r.day270 >= a270);
  if (!checks.length) return false;
  return mode === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

// Behind / ahead / on-pace label for a trending row.
function paceState(r, t) {
  if (flag(r, t)) return "behind";
  if (flagAhead(r, t)) return "ahead";
  return "onpace";
}

/* ============================== OVERVIEW ============================== */
function Overview({ meta, weeks, week, prevWeek, totalCall, totalCommit, netSwing, flagged }) {
  const series = [...meta.weeks].sort().map((d) => {
    const w = weeks[d]; if (!w) return null;
    const call = meta.managers.reduce((s, m) => s + (w.calls[m]?.call || 0), 0);
    return { wk: fmtDate(d), call, plan: w.plan || null };
  }).filter(Boolean);

  return (
    <>
      <h2>This week at a glance</h2>
      <p className="sub">Live snapshot for the meeting on {fmtDate(week.date)}. Everything here is captured against this week and kept as you move forward.</p>

      <div className="tape" style={{ marginBottom: 18 }}>
        {meta.managers.map((m) => {
          const c = week.calls[m] || {};
          const prior = prevWeek?.calls?.[m]?.call ?? c.prior;
          const d = c.call != null && prior != null ? c.call - prior : null;
          return (
            <div className="mcard" key={m}>
              <div className="mn">{m}</div>
              <div className="mv mono">{money(c.call)}</div>
              {d != null && d !== 0 && (
                <div className="delta mono" style={{ color: d > 0 ? T.up : T.down }}>
                  {d > 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{money(Math.abs(d))} WoW
                </div>
              )}
              {d === 0 && <div className="delta mono" style={{ color: T.muted }}>flat WoW</div>}
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="card">
          <div className="between" style={{ marginBottom: 12 }}>
            <b style={{ fontSize: 14 }}>Total call vs plan</b>
            <span className="mono" style={{ fontSize: 12, color: T.muted }}>{meta.weeks.length} week{meta.weeks.length > 1 ? "s" : ""} tracked</span>
          </div>
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={T.panel2} vertical={false} />
                <XAxis dataKey="wk" tick={{ fill: T.muted, fontSize: 11 }} stroke={T.line} />
                <YAxis tick={{ fill: T.muted, fontSize: 11 }} stroke={T.line}
                  tickFormatter={(v) => "$" + (v / 1e6).toFixed(1) + "M"} />
                <Tooltip contentStyle={{ background: T.panel2, border: "1px solid " + T.line, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => money(v)} labelStyle={{ color: T.text }} />
                <Line type="monotone" dataKey="plan" stroke={T.faint} strokeDasharray="4 4" dot={false} strokeWidth={1.5} name="Plan" />
                <Line type="monotone" dataKey="call" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3, fill: T.accent }} name="Call" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="mn" style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Commit floor</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{money(totalCommit)}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>across {meta.managers.length} managers</div>
          </div>
          <div className="card">
            <div className="between" style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 14 }}>Trending behind</b>
              {flagged.length > 0 && <span className="tag" style={{ background: "rgba(248,81,73,.15)", color: T.down }}>{flagged.length} flagged</span>}
            </div>
            {flagged.length === 0 ? <div style={{ fontSize: 12.5, color: T.muted }}>No accounts breaching thresholds.</div>
              : flagged.slice(0, 4).map((r) => (
                <div key={r.id} className="row between" style={{ fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid " + T.panel2 }}>
                  <span>{r.account} <span style={{ color: T.faint }}>· {r.owner}</span></span>
                  <span className="mono" style={{ color: T.down }}>{pct(r.day180)}/{pct(r.day270)}</span>
                </div>))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================== CALLS ============================== */
function Calls({ meta, week, prevWeek, updateWeek, saveMeta, totalCall }) {
  const set = (m, field, v) => updateWeek((w) => { w.calls[m] = { ...w.calls[m], [field]: field === "note" ? v : num(v) }; return w; });
  return (
    <>
      <h2>Manager calls</h2>
      <p className="sub">Each manager's call on where they'll land. Edit weekly — the prior week's call is carried in automatically so you can see movement. Commit is the floor, Best is the ceiling. Or drop this week's forecast export to fill the whole table at once.</p>

      <ForecastImporter meta={meta} updateWeek={updateWeek} saveMeta={saveMeta} />

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <table>
          <thead><tr>
            <th>Manager</th><th style={{ textAlign: "right" }}>Goal</th><th style={{ textAlign: "right" }}>Commit</th>
            <th style={{ textAlign: "right" }}>Call</th><th style={{ textAlign: "right" }}>Best</th>
            <th style={{ textAlign: "right" }}>Closed-won</th><th style={{ textAlign: "right" }}>Attain</th>
            <th style={{ textAlign: "right" }}>WoW</th><th>Note</th>
          </tr></thead>
          <tbody>
            {meta.managers.map((m) => {
              const c = week.calls[m] || {};
              const prior = prevWeek?.calls?.[m]?.call ?? c.prior;
              const d = c.call != null && prior != null ? c.call - prior : null;
              const attain = c.goal ? (c.call ?? 0) / c.goal * 100 : null;
              return (
                <tr key={m}>
                  <td style={{ fontWeight: 500 }}>{m}</td>
                  <td className="cellnum"><input type="number" value={c.goal ?? ""} placeholder="—" onChange={(e) => set(m, "goal", e.target.value)} /></td>
                  <td className="cellnum"><input type="number" value={c.commit ?? ""} placeholder="—" onChange={(e) => set(m, "commit", e.target.value)} /></td>
                  <td className="cellnum"><input type="number" value={c.call ?? ""} placeholder="—" onChange={(e) => set(m, "call", e.target.value)} /></td>
                  <td className="cellnum"><input type="number" value={c.best ?? ""} placeholder="—" onChange={(e) => set(m, "best", e.target.value)} /></td>
                  <td className="cellnum"><input type="number" value={c.closedWon ?? ""} placeholder="—" onChange={(e) => set(m, "closedWon", e.target.value)} /></td>
                  <td className="mono" style={{ textAlign: "right", color: attain == null ? T.muted : attain >= 100 ? T.up : attain >= 90 ? T.warn : T.down }}>
                    {attain == null ? "—" : pct(attain)}
                  </td>
                  <td className="mono" style={{ textAlign: "right", color: d > 0 ? T.up : d < 0 ? T.down : T.muted }}>
                    {d == null ? "—" : (d === 0 ? "flat" : (d > 0 ? "+" : "−") + money(Math.abs(d)))}
                  </td>
                  <td><input value={c.note || ""} placeholder="add context…" onChange={(e) => set(m, "note", e.target.value)} /></td>
                </tr>);
            })}
          </tbody>
          <tfoot><tr>
            <td style={{ fontWeight: 600 }}>Total</td>
            <td className="mono" style={{ textAlign: "right", color: T.muted }}>{money(meta.managers.reduce((s, m) => s + (week.calls[m]?.goal || 0), 0))}</td>
            <td></td>
            <td className="mono" style={{ textAlign: "right", fontWeight: 600, color: T.accent }}>{money(totalCall)}</td>
            <td></td>
            <td className="mono" style={{ textAlign: "right", color: T.up }}>{money(meta.managers.reduce((s, m) => s + (week.calls[m]?.closedWon || 0), 0))}</td>
            <td colSpan={3}></td>
          </tr></tfoot>
        </table>
      </div>
      <p className="sub" style={{ marginTop: 12 }}>Add or remove managers in Settings — names stay stable so the trend chart stays continuous.</p>
    </>
  );
}

/* ---------- forecast CSV importer ---------- */
function ForecastImporter({ meta, updateWeek, saveMeta }) {
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const inputRef = useRef(null);

  const isIndented = (s) => s !== s.replace(/^[\s\u2003\u2002\u00a0]+/, "");
  const moneyNum = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : Math.round(n); };

  function handleFile(file) {
    setErr(""); setDone("");
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { setErr("That's not a .csv — export the forecast as CSV and try again."); return; }
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields || []).filter(Boolean);
        const find = (re) => fields.find((f) => re.test(f)) || "";
        const cMgr = find(/manager|name/i);
        const cCall = find(/most likely/i) || find(/forecast|call/i);
        const cCommit = find(/^commit/i) || find(/commit/i);
        const cBest = find(/best/i);
        const cGoal = fields.find((f) => /goal/i.test(f) && !/attain/i.test(f)) || "";
        if (!cMgr || !cCall) { setErr("Couldn't find Manager and Most Likely columns — is this the forecast export?"); return; }

        const data = res.data;
        const managers = [];
        const calls = {};
        let planTotal = null;
        data.forEach((r) => {
          const raw = String(r[cMgr] ?? "");
          const name = raw.trim();
          if (!name) return;
          if (/^total$/i.test(name)) { planTotal = cGoal ? moneyNum(r[cGoal]) : null; return; }
          if (isIndented(raw)) return;          // skip rep rows, keep manager rollups
          managers.push(name);
          calls[name] = {
            call: moneyNum(r[cCall]), commit: cCommit ? moneyNum(r[cCommit]) : null,
            best: cBest ? moneyNum(r[cBest]) : null, note: "", prior: null,
          };
        });
        if (!managers.length) { setErr("No manager rows detected in that file."); return; }

        updateWeek((w) => {
          managers.forEach((m) => { const ex = w.calls[m]; calls[m].prior = ex?.call ?? null; if (ex?.note) calls[m].note = ex.note; });
          w.calls = calls;
          if (planTotal != null) w.plan = planTotal;
          return w;
        });
        saveMeta({ ...meta, managers });
        setDone(`Loaded ${managers.length} managers${planTotal != null ? " · plan " + money(planTotal) : ""}.`);
      },
      error: () => setErr("Couldn't read that file."),
    });
  }
  const onDrop = (e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); };

  return (
    <div className={"drop" + (over ? " over" : "")} role="button" tabIndex={0}
      style={{ padding: "18px 20px" }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <div className="row" style={{ justifyContent: "center", gap: 9 }}>
        <FileText size={18} style={{ color: T.accent }} />
        <b style={{ fontSize: 13.5 }}>Drop the forecast export</b>
        <span style={{ fontSize: 12, color: T.muted }}>— fills calls from Most Likely, Commit, Best Case; sets plan from the Total goal</span>
      </div>
      {done && <div style={{ fontSize: 12, color: T.up, marginTop: 7 }}>{done}</div>}
      {err && <div style={{ fontSize: 12, color: T.down, marginTop: 7 }}>{err}</div>}
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}

/* ============================== SWINGS ============================== */
function Swings({ week, meta, updateWeek }) {
  const add = () => updateWeek((w) => { w.swings.push({ id: uid(), account: "", owner: meta.managers[0] || "", dir: "up", amount: null, note: "" }); return w; });
  const upd = (id, f, v) => updateWeek((w) => { w.swings = w.swings.map((s) => s.id === id ? { ...s, [f]: f === "amount" ? num(v) : v } : s); return w; });
  const del = (id) => updateWeek((w) => { w.swings = w.swings.filter((s) => s.id !== id); return w; });
  const up = week.swings.filter((s) => s.dir === "up").reduce((a, s) => a + (s.amount || 0), 0);
  const dn = week.swings.filter((s) => s.dir === "down").reduce((a, s) => a + (s.amount || 0), 0);
  return (
    <>
      <h2>Swing factors</h2>
      <p className="sub">Deals or accounts that could move the number up or down before quarter close. Net swing rolls up to the top bar.</p>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ flex: 1, padding: "12px 16px" }}><div className="mn">Potential upside</div><div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.up }}>+{money(up)}</div></div>
        <div className="card" style={{ flex: 1, padding: "12px 16px" }}><div className="mn">Potential downside</div><div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.down }}>−{money(dn)}</div></div>
        <div className="card" style={{ flex: 1, padding: "12px 16px" }}><div className="mn">Net</div><div className="mono" style={{ fontSize: 22, fontWeight: 600, color: up - dn >= 0 ? T.up : T.down }}>{up - dn >= 0 ? "+" : "−"}{money(Math.abs(up - dn))}</div></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {week.swings.length === 0 ? <div style={{ padding: 18 }}><div className="empty"><b>No swings logged</b>Track the deals most likely to move your call this week.</div></div> :
          <table>
            <thead><tr><th>Account</th><th>Owner</th><th>Direction</th><th style={{ textAlign: "right" }}>Amount</th><th>Why</th><th></th></tr></thead>
            <tbody>{week.swings.map((s) => (
              <tr key={s.id}>
                <td><input value={s.account} placeholder="account" onChange={(e) => upd(s.id, "account", e.target.value)} /></td>
                <td><select value={s.owner} onChange={(e) => upd(s.id, "owner", e.target.value)}>{meta.managers.map((m) => <option key={m}>{m}</option>)}</select></td>
                <td><div className="seg">
                  <button className={s.dir === "up" ? "on" : ""} onClick={() => upd(s.id, "dir", "up")}>Up</button>
                  <button className={s.dir === "down" ? "on" : ""} onClick={() => upd(s.id, "dir", "down")}>Down</button>
                </div></td>
                <td className="cellnum"><input type="number" value={s.amount ?? ""} placeholder="0" onChange={(e) => upd(s.id, "amount", e.target.value)} /></td>
                <td><input value={s.note} placeholder="context…" onChange={(e) => upd(s.id, "note", e.target.value)} /></td>
                <td><button className="ico" onClick={() => del(s.id)}><Trash2 size={15} /></button></td>
              </tr>))}</tbody>
          </table>}
      </div>
      <button className="btn gho sm" style={{ marginTop: 12 }} onClick={add}><Plus size={14} />Add swing</button>
    </>
  );
}

/* ============================== HEADLINES ============================== */
function Headlines({ week, meta, updateWeek }) {
  const add = () => updateWeek((w) => { w.headlines.push({ id: uid(), account: "", owner: meta.managers[0] || "", note: "" }); return w; });
  const upd = (id, f, v) => updateWeek((w) => { w.headlines = w.headlines.map((h) => h.id === id ? { ...h, [f]: v } : h); return w; });
  const del = (id) => updateWeek((w) => { w.headlines = w.headlines.filter((h) => h.id !== id); return w; });
  return (
    <>
      <h2>Rep & customer headlines</h2>
      <p className="sub">The notable stories from the week — expansions, risks, champion changes. These carry forward week over week so you can keep editing the running narrative.</p>
      {week.headlines.length === 0 && <div className="empty" style={{ marginBottom: 14 }}><b>No headlines yet</b>Capture what your managers are calling out this week.</div>}
      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
        {week.headlines.map((h) => (
          <div className="card" key={h.id} style={{ padding: "12px 14px" }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <input style={{ flex: "0 0 200px" }} value={h.account} placeholder="Account / rep" onChange={(e) => upd(h.id, "account", e.target.value)} />
              <select style={{ flex: "0 0 140px" }} value={h.owner} onChange={(e) => upd(h.id, "owner", e.target.value)}>{meta.managers.map((m) => <option key={m}>{m}</option>)}</select>
              <button className="ico" style={{ marginLeft: "auto" }} onClick={() => del(h.id)}><Trash2 size={15} /></button>
            </div>
            <textarea style={{ width: "100%", minHeight: 52, resize: "vertical" }} value={h.note} placeholder="What's the story?" onChange={(e) => upd(h.id, "note", e.target.value)} />
          </div>))}
      </div>
      <button className="btn gho sm" style={{ marginTop: 12 }} onClick={add}><Plus size={14} />Add headline</button>
    </>
  );
}

/* ============================== TIPS ============================== */
function Tips({ week, meta, updateWeek }) {
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (id) => updateWeek((w) => { w.tips = w.tips.map((t) => t.id === id ? { ...t, included: !t.included } : t); return w; });
  const del = (id) => updateWeek((w) => { w.tips = w.tips.filter((t) => t.id !== id); return w; });
  const addManual = () => updateWeek((w) => { w.tips.push({ id: uid(), source: "Other", text: "", owner: "", status: "not_tried", included: false }); return w; });
  const editText = (id, v) => updateWeek((w) => { w.tips = w.tips.map((t) => t.id === id ? { ...t, text: v } : t); return w; });
  const setField = (id, f, v) => updateWeek((w) => { w.tips = w.tips.map((t) => t.id === id ? { ...t, [f]: v } : t); return w; });
  const ownerOpts = (o) => ["", ...((meta.managers.includes(o) || !o) ? meta.managers : [o, ...meta.managers])];

  async function suggest() {
    if (!paste.trim()) { setErr("Paste some Slack wins or Gong notes first."); return; }
    setBusy(true); setErr("");
    try {
      const { tips } = await callAI({ action: "tips", notes: paste });
      const arr = Array.isArray(tips) ? tips : [];
      if (!arr.length) { setErr("No tips came back — try adding more detail, or add one manually."); }
      else {
        updateWeek((w) => { arr.slice(0, 3).forEach((t) => w.tips.push({ id: uid(), source: t.source || "Other", text: t.text, owner: "", status: "not_tried", included: false })); return w; });
        setPaste("");
      }
    } catch (e) { setErr(e.message || "Couldn't generate suggestions. Manual add still works."); }
    setBusy(false);
  }

  const incCount = week.tips.filter((t) => t.included).length;
  return (
    <>
      <h2>Pipeline generation tips</h2>
      <p className="sub">Suggested wins and talk tracks to share with the team. Check the ones to include in this week's update; uncheck or delete the rest. Until Gong and Slack are connected live, paste recent wins or call notes and let the assistant draft suggestions.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 10 }}><Sparkles size={16} style={{ color: T.accent }} /><b style={{ fontSize: 14 }}>Draft from Slack / Gong</b></div>
        <textarea style={{ width: "100%", minHeight: 96, resize: "vertical", marginBottom: 10 }}
          value={paste} placeholder="Paste recent Slack wins, closed-won notes, or Gong call snippets here…"
          onChange={(e) => setPaste(e.target.value)} />
        <div className="row">
          <button className="btn pri sm" onClick={suggest} disabled={busy}><Sparkles size={14} />{busy ? "Drafting…" : "Suggest tips"}</button>
          <button className="btn gho sm" onClick={addManual}><Plus size={14} />Add manually</button>
          {err && <span style={{ fontSize: 12, color: T.down }}>{err}</span>}
        </div>
      </div>

      <div className="between" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13, color: T.muted }}>{week.tips.length} suggestion{week.tips.length !== 1 ? "s" : ""}</b>
        <span className="tag" style={{ background: "rgba(63,185,80,.15)", color: T.up }}>{incCount} selected for update</span>
      </div>

      {week.tips.length === 0 ? <div className="empty"><b>No tips yet</b>Draft some from your wins above, or add one manually.</div> :
        <div className="grid" style={{ gap: 9 }}>
          {week.tips.map((t) => {
            const stColor = { not_tried: T.muted, in_progress: T.warn, successful: T.up }[t.status || "not_tried"];
            return (
            <div className={"tip" + (t.included ? " inc" : "")} key={t.id}>
              <button className={"chk" + (t.included ? " on" : "")} onClick={() => toggle(t.id)}>{t.included && <Check size={14} />}</button>
              <div style={{ flex: 1 }}>
                <textarea style={{ width: "100%", minHeight: 38, resize: "vertical", border: "none", padding: 0, background: "transparent" }}
                  value={t.text} onChange={(e) => editText(t.id, e.target.value)} />
                <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <select value={t.owner || ""} style={{ fontSize: 12 }} onChange={(e) => setField(t.id, "owner", e.target.value)}>
                    {ownerOpts(t.owner).map((m) => <option key={m || "none"} value={m}>{m || "Unassigned"}</option>)}
                  </select>
                  <select value={t.status || "not_tried"} style={{ fontSize: 12, color: stColor, fontWeight: 600 }} onChange={(e) => setField(t.id, "status", e.target.value)}>
                    {TIP_STATUS.map(([v, label]) => <option key={v} value={v} style={{ color: T.text }}>{label}</option>)}
                  </select>
                  <span className="src">{t.source}</span>
                </div>
              </div>
              <button className="ico" onClick={() => del(t.id)}><X size={15} /></button>
            </div>);
          })}
        </div>}
    </>
  );
}

/* ============================== GRR ============================== */
function GRR({ week, meta, updateWeek }) {
  const rows = week.grr?.rows || [];
  const ensure = (w) => { if (!w.grr) w.grr = { rows: [] }; return w; };
  const add = () => updateWeek((w) => { ensure(w).grr.rows.push({ id: uid(), manager: meta.managers[0] || "", segment: "Enterprise", goal: null, closedWon: null, grrCall: null, notes: "" }); return w; });
  const upd = (id, f, v) => updateWeek((w) => { ensure(w).grr.rows = w.grr.rows.map((r) => r.id === id ? { ...r, [f]: (f === "goal" || f === "closedWon" || f === "grrCall") ? num(v) : v } : r); return w; });
  const del = (id) => updateWeek((w) => { ensure(w).grr.rows = w.grr.rows.filter((r) => r.id !== id); return w; });

  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const tGoal = sum("goal"), tWon = sum("closedWon"), tCall = sum("grrCall");
  const ownerOpts = (o) => (meta.managers.includes(o) || !o ? meta.managers : [o, ...meta.managers]);
  const card = { padding: "12px 16px" };
  const lbl = { fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: ".5px" };

  return (
    <>
      <h2>Gross revenue retention</h2>
      <p className="sub">Per-manager GRR goal, closed-won so far, and the call on where it lands. Attainment is closed-won vs. goal.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
        <div className="card" style={card}><div style={lbl}>GRR goal</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{money(tGoal)}</div></div>
        <div className="card" style={card}><div style={lbl}>Closed-won</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: T.up }}>{money(tWon)}</div></div>
        <div className="card" style={card}><div style={lbl}>Attainment</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: tGoal && tWon / tGoal >= 1 ? T.up : T.warn }}>{tGoal ? pct(tWon / tGoal * 100) : "—"}</div></div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <div style={{ padding: 18 }}><div className="empty"><b>No GRR rows yet</b>Add a manager row to start tracking retention.</div></div> :
        <table>
          <thead><tr><th>Manager</th><th>Segment</th><th style={{ textAlign: "right" }}>Goal</th><th style={{ textAlign: "right" }}>Closed-won</th><th style={{ textAlign: "right" }}>GRR call</th><th style={{ textAlign: "right" }}>Attain</th><th>Notes</th><th></th></tr></thead>
          <tbody>{rows.map((r) => {
            const at = r.goal ? (r.closedWon ?? 0) / r.goal * 100 : null;
            return (
              <tr key={r.id}>
                <td><select value={r.manager} onChange={(e) => upd(r.id, "manager", e.target.value)}>{ownerOpts(r.manager).map((m) => <option key={m}>{m}</option>)}</select></td>
                <td><input value={r.segment || ""} placeholder="segment" onChange={(e) => upd(r.id, "segment", e.target.value)} /></td>
                <td className="cellnum"><input type="number" value={r.goal ?? ""} placeholder="—" onChange={(e) => upd(r.id, "goal", e.target.value)} /></td>
                <td className="cellnum"><input type="number" value={r.closedWon ?? ""} placeholder="—" onChange={(e) => upd(r.id, "closedWon", e.target.value)} /></td>
                <td className="cellnum"><input type="number" value={r.grrCall ?? ""} placeholder="—" onChange={(e) => upd(r.id, "grrCall", e.target.value)} /></td>
                <td className="mono" style={{ textAlign: "right", color: at == null ? T.muted : at >= 100 ? T.up : at >= 90 ? T.warn : T.down }}>{at == null ? "—" : pct(at)}</td>
                <td><input value={r.notes || ""} placeholder="notes…" onChange={(e) => upd(r.id, "notes", e.target.value)} /></td>
                <td><button className="ico" onClick={() => del(r.id)}><Trash2 size={15} /></button></td>
              </tr>);
          })}</tbody>
          <tfoot><tr><td style={{ fontWeight: 600 }}>Total</td><td></td>
            <td className="mono" style={{ textAlign: "right" }}>{money(tGoal)}</td>
            <td className="mono" style={{ textAlign: "right", color: T.up }}>{money(tWon)}</td>
            <td className="mono" style={{ textAlign: "right" }}>{money(tCall)}</td>
            <td colSpan={3}></td></tr></tfoot>
        </table>}
      </div>
      <button className="btn gho sm" style={{ marginTop: 12 }} onClick={add}><Plus size={14} />Add row</button>
    </>
  );
}

/* ============================== ASK AI ============================== */
function AskAI({ meta, weeks }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const weekCount = Object.keys(weeks || {}).length;
  const examples = [
    "Which managers are furthest behind their goal this week?",
    "How did the total call change versus last week, and who moved it?",
    "Which trending-behind accounts still have no action plan?",
    "Summarize the biggest risks to the number this week.",
  ];

  async function ask(question) {
    const Q = (question ?? q).trim();
    if (!Q) return;
    setBusy(true); setErr(""); setAnswer(""); setAsked(Q); setQ(Q);
    try {
      const { answer } = await callAI({ action: "ask", question: Q, context: { meta, weeks } });
      setAnswer(answer || "(no answer returned)");
    } catch (e) { setErr(e.message || "Couldn't get an answer."); }
    setBusy(false);
  }

  return (
    <>
      <h2>Ask AI</h2>
      <p className="sub">Ask a question about the forecast. The assistant answers from your data across the current week and {weekCount > 1 ? `the prior ${weekCount - 1} week${weekCount - 1 === 1 ? "" : "s"}` : "previous weeks"} — manager calls, swings, GRR, trending, and tips.</p>

      {!supabaseConfigured && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>AI runs on the deployed app (Vercel AI Gateway). Sign in to the hosted site to use it.</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <textarea style={{ width: "100%", minHeight: 80, resize: "vertical", marginBottom: 10 }}
          value={q} placeholder="e.g. Which accounts slipped the most week over week?"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask(); }} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn pri sm" onClick={() => ask()} disabled={busy || !supabaseConfigured}>
            <Send size={14} />{busy ? "Thinking…" : "Ask"}
          </button>
          <span style={{ fontSize: 11, color: T.faint }}>⌘/Ctrl + Enter</span>
        </div>
      </div>

      {!asked && !busy && (
        <div className="grid" style={{ gap: 8 }}>
          {examples.map((ex) => (
            <button key={ex} className="btn gho sm" style={{ justifyContent: "flex-start", textAlign: "left" }}
              disabled={!supabaseConfigured} onClick={() => ask(ex)}>
              <Sparkles size={13} style={{ color: T.accent, flexShrink: 0 }} />{ex}
            </button>
          ))}
        </div>
      )}

      {err && <div className="notice" style={{ marginTop: 4 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{err}</span></div>}

      {(busy || answer) && (
        <div className="card" style={{ marginTop: 4 }}>
          {asked && <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{asked}</div>}
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: T.text }}>
            {busy ? "Analyzing the forecast…" : answer}
          </div>
        </div>
      )}
    </>
  );
}

/* ============================== TRENDING ============================== */
function Trending({ week, meta, updateWeek, flagged }) {
  const t = meta.thresholds;
  const [view, setView] = useState("flagged");
  const add = () => updateWeek((w) => { w.trending.push({ id: uid(), account: "", owner: meta.managers[0] || "", day180: null, day270: null, actionPlan: "" }); return w; });
  const upd = (id, f, v) => updateWeek((w) => { w.trending = w.trending.map((r) => r.id === id ? { ...r, [f]: f === "day180" || f === "day270" ? num(v) : v } : r); return w; });
  const del = (id) => updateWeek((w) => { w.trending = w.trending.filter((r) => r.id !== id); return w; });

  const hasD270 = week.trending.some((r) => r.day270 != null);
  const aheadList = week.trending.filter((r) => flagAhead(r, t));
  const shown = view === "flagged" ? week.trending.filter((r) => flag(r, t))
    : view === "ahead" ? aheadList : week.trending;
  const ownerOpts = (o) => (meta.managers.includes(o) || !o ? meta.managers : [o, ...meta.managers]);

  return (
    <>
      <h2>Trending</h2>
      <p className="sub">Accounts by pace vs. expected. <b style={{ color: T.down }}>Behind</b> = under <b style={{ color: T.text }}>{t.d180}%</b> at Day 180 {hasD270 ? <><b style={{ color: T.text }}>{t.mode === "and" ? "and" : "or"}</b> under <b style={{ color: T.text }}>{t.d270}%</b> at Day 270</> : ""}; <b style={{ color: T.up }}>Ahead</b> = at/over <b style={{ color: T.text }}>{t.aheadD180 ?? 90}%</b> at Day 180. Values are attainment vs. expected pace (42 = at 42% of where it should be). Adjust both rules in Settings.</p>

      {!hasD270 && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>This week's file is the <b>Day 180</b> export only, so the rule is running on the Day 180 line alone. Drop the matching <b>Day 270</b> export too and accounts present in both will be evaluated against the full both-milestones rule.</span>
        </div>
      )}

      <div className="between" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13, color: T.muted }}>{week.trending.length} tracked · {flagged.length} behind · {aheadList.length} ahead</b>
        <div className="seg">
          <button className={view === "flagged" ? "on" : ""} onClick={() => setView("flagged")}>Behind ({flagged.length})</button>
          <button className={view === "ahead" ? "on" : ""} onClick={() => setView("ahead")}>Ahead ({aheadList.length})</button>
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>All ({week.trending.length})</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        {shown.length === 0 ? <div style={{ padding: 18 }}><div className="empty"><b>{view === "flagged" ? "Nothing behind" : view === "ahead" ? "Nothing ahead" : "No accounts yet"}</b>{view === "all" ? "Drop your CSV export below to populate the segment." : "No accounts in this view this week."}</div></div> :
        <table>
          <thead><tr><th>Account</th><th>Owner</th><th style={{ textAlign: "right" }}>Day 180</th><th style={{ textAlign: "right" }}>Day 270</th><th>Status</th><th>Action plan</th><th></th></tr></thead>
          <tbody>{shown.map((r) => {
            const st = paceState(r, t);
            const bg = st === "behind" ? "rgba(248,81,73,.06)" : st === "ahead" ? "rgba(63,185,80,.06)" : "transparent";
            return (
              <tr key={r.id} style={{ background: bg }}>
                <td><input value={r.account} placeholder="account" onChange={(e) => upd(r.id, "account", e.target.value)} /></td>
                <td><select value={r.owner} onChange={(e) => upd(r.id, "owner", e.target.value)}>{ownerOpts(r.owner).map((m) => <option key={m}>{m}</option>)}</select></td>
                <td className="cellnum"><input type="number" value={r.day180 ?? ""} placeholder="—" onChange={(e) => upd(r.id, "day180", e.target.value)} /></td>
                <td className="cellnum"><input type="number" value={r.day270 ?? ""} placeholder="—" onChange={(e) => upd(r.id, "day270", e.target.value)} /></td>
                <td>{st === "behind" ? <span className="tag" style={{ background: "rgba(248,81,73,.15)", color: T.down }}>Behind</span>
                  : st === "ahead" ? <span className="tag" style={{ background: "rgba(63,185,80,.15)", color: T.up }}>Ahead</span>
                  : <span className="tag" style={{ background: T.panel2, color: T.muted }}>On pace</span>}</td>
                <td><input value={r.actionPlan || ""} placeholder="plan…" onChange={(e) => upd(r.id, "actionPlan", e.target.value)} /></td>
                <td><button className="ico" onClick={() => del(r.id)}><Trash2 size={15} /></button></td>
              </tr>);
          })}</tbody>
        </table>}
      </div>

      <button className="btn gho sm" onClick={add}><Plus size={14} />Add account</button>

      <Importer meta={meta} updateWeek={updateWeek} />
    </>
  );
}

/* ============================== IMPORTER ============================== */
function Importer({ meta, updateWeek }) {
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({ account: "", owner: "", day180: "", day270: "" });
  const [scale, setScale] = useState("percent");
  const [mode, setMode] = useState("replace");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [bulk, setBulk] = useState("");
  const inputRef = useRef(null);

  const pctNum = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };

  function autoMap(fields) {
    const find = (re) => fields.find((f) => re.test(f)) || "";
    const milestone = (day) => {
      const metric = (f) => /ratio|attain|percent|pct|%|pacing|index|score/i.test(f) && !/cutoff|date|day\)|expected|purchased|used/i.test(f);
      return fields.find((f) => new RegExp(day).test(f) && metric(f)) || fields.find((f) => new RegExp(day).test(f) && !/cutoff|date/i.test(f)) || "";
    };
    return {
      account: find(/account|customer|company|client|logo/i) || find(/name/i),
      owner: find(/manager/i) || find(/owner/i) || find(/\brep\b|\bae\b|csm|exec/i),
      day180: milestone("180"),
      day270: milestone("270"),
    };
  }

  // ratios (0–1) vs percentages (0–100): if the day columns top out near 1–3, they're ratios
  function guessScale(data, m) {
    const vals = [];
    [m.day180, m.day270].filter(Boolean).forEach((c) => data.forEach((r) => { const n = pctNum(r[c]); if (n != null) vals.push(Math.abs(n)); }));
    if (!vals.length) return "percent";
    return Math.max(...vals) <= 3 ? "ratio" : "percent";
  }

  function handleFile(file) {
    setErr("");
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { setErr("That's not a .csv — export the dashboard as CSV and try again."); return; }
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields || []).filter(Boolean);
        const data = (res.data || []).filter((r) => Object.values(r).some((v) => String(v).trim()));
        if (!fields.length || !data.length) { setErr("The file opened but had no rows. Check the export and try again."); return; }
        const m = autoMap(fields);
        setHeaders(fields); setRows(data); setMap(m); setScale(guessScale(data, m));
      },
      error: () => setErr("Couldn't read that file. Make sure it's a valid CSV."),
    });
  }

  const onDrop = (e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); };

  function build() {
    const f = scale === "ratio" ? 100 : 1;
    const conv = (v) => { const n = pctNum(v); return n == null ? null : Math.round(n * f * 10) / 10; };
    return rows.map((r) => ({
      id: uid(),
      account: String(r[map.account] ?? "").trim(),
      owner: String(r[map.owner] ?? "").trim() || (meta.managers[0] || ""),
      day180: map.day180 ? conv(r[map.day180]) : null,
      day270: map.day270 ? conv(r[map.day270]) : null,
    })).filter((x) => x.account);
  }

  function doImport() {
    if (!map.account) { setErr("Tell me which column is the account name first."); return; }
    const built = build();
    if (!built.length) { setErr("No rows landed — double-check the account column."); return; }
    updateWeek((w) => { w.trending = mode === "replace" ? built : [...w.trending, ...built]; return w; });
    reset();
  }
  function reset() { setRows(null); setHeaders([]); setFileName(""); setErr(""); }

  function importPaste() {
    const lines = bulk.trim().split("\n").map((l) => l.split(/[\t,]/).map((x) => x.trim())).filter((r) => r[0]);
    if (!lines.length) { setErr("Nothing to import."); return; }
    const built = lines.map((r) => ({ id: uid(), account: r[0], owner: r[1] || meta.managers[0] || "", day180: pctNum(r[2]), day270: pctNum(r[3]) }));
    updateWeek((w) => { w.trending = mode === "replace" ? built : [...w.trending, ...built]; return w; });
    setBulk(""); setErr("");
  }

  const TARGETS = [["account", "Account"], ["owner", "Owner"], ["day180", "Day 180 %"], ["day270", "Day 270 %"]];

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>Import this week's export</b>
        <button className="btn gho sm" onClick={() => { setShowPaste(!showPaste); reset(); }}>
          {showPaste ? "Use file upload" : "Paste rows instead"}
        </button>
      </div>

      {!showPaste && !rows && (
        <div className={"drop" + (over ? " over" : "")} role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <div className="di"><FileText size={26} /></div>
          <b>Drop your CSV here</b>
          <span style={{ fontSize: 12.5 }}>or click to browse · columns map automatically</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      )}

      {!showPaste && rows && (
        <>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: T.muted }}>
              <span className="mono" style={{ color: T.text }}>{fileName}</span> · {rows.length} row{rows.length !== 1 ? "s" : ""} · matched columns shown below
            </span>
            <button className="btn gho sm" onClick={reset}>Choose another file</button>
          </div>
          <div className="map">
            {TARGETS.map(([k, label]) => (
              <label key={k}>{label}{k === "account" && " *"}
                <select className={k === "account" && !map[k] ? "bad" : ""} value={map[k]}
                  onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                  <option value="">— none —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="row" style={{ gap: 10, marginBottom: 12, fontSize: 12, color: T.muted }}>
            <span>Pacing values are</span>
            <div className="seg">
              <button className={scale === "percent" ? "on" : ""} onClick={() => setScale("percent")}>Percent (0–100)</button>
              <button className={scale === "ratio" ? "on" : ""} onClick={() => setScale("ratio")}>Ratio (0–1)</button>
            </div>
            {scale === "ratio" && <span style={{ color: T.faint }}>× 100 on import — e.g. 0.43 → 43%</span>}
          </div>

          <div style={{ border: "1px solid " + T.line, borderRadius: 9, overflow: "hidden", marginBottom: 12 }}>
            <table className="prev">
              <thead><tr>{TARGETS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
              <tbody>
                {build().slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <td>{r.account || <span style={{ color: T.faint }}>—</span>}</td>
                    <td>{r.owner}</td>
                    <td className="mono">{r.day180 == null ? "—" : r.day180 + "%"}</td>
                    <td className="mono">{r.day270 == null ? "—" : r.day270 + "%"}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="seg">
              <button className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace list</button>
              <button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add to list</button>
            </div>
            <button className="btn pri sm" onClick={doImport}><Check size={14} />Import {build().length} account{build().length !== 1 ? "s" : ""}</button>
          </div>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 11.5 }}>
            “Replace” swaps the whole segment for this week — the right choice for a fresh weekly export. “Add” appends without clearing what's there.
          </p>
        </>
      )}

      {showPaste && (
        <>
          <p className="sub" style={{ margin: "0 0 9px" }}>One per line: <span className="mono" style={{ color: T.text }}>Account, Owner, Day180%, Day270%</span> (comma or tab separated)</p>
          <textarea style={{ width: "100%", minHeight: 70, resize: "vertical", marginBottom: 10 }} value={bulk}
            placeholder={"Account name, Owner, 42, 78\nAnother account, Owner, 61, 85"} onChange={(e) => setBulk(e.target.value)} />
          <div className="row">
            <div className="seg">
              <button className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace list</button>
              <button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add to list</button>
            </div>
            <button className="btn gho sm" onClick={importPaste}>Import rows</button>
          </div>
        </>
      )}

      {err && <p style={{ fontSize: 12, color: T.down, margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}

/* ============================== UPDATE ============================== */
function Update({ meta, week, totalCall, totalCommit, netSwing, flagged }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    const L = [];
    L.push(`📊 Weekly Forecast Update — Wk of ${fmtDate(week.date)}`);
    L.push(``);
    L.push(`TOP LINE`);
    L.push(`• Call: ${money(totalCall)}${week.plan ? `  (${((totalCall / week.plan) * 100).toFixed(0)}% to plan ${money(week.plan)})` : ""}`);
    L.push(`• Commit floor: ${money(totalCommit)}`);
    L.push(`• Net swing in play: ${netSwing >= 0 ? "+" : "−"}${money(Math.abs(netSwing))}`);
    L.push(``);
    L.push(`MANAGER CALLS`);
    meta.managers.forEach((m) => { const c = week.calls[m] || {}; L.push(`• ${m}: ${money(c.call)}${c.note ? ` — ${c.note}` : ""}`); });
    if (week.swings.length) {
      L.push(``); L.push(`SWING FACTORS`);
      week.swings.forEach((s) => L.push(`• ${s.dir === "up" ? "▲" : "▼"} ${s.account} (${s.owner}) ${s.dir === "up" ? "+" : "−"}${money(s.amount)}${s.note ? ` — ${s.note}` : ""}`));
    }
    if (week.headlines.length) {
      L.push(``); L.push(`HEADLINES`);
      week.headlines.forEach((h) => L.push(`• ${h.account} (${h.owner}): ${h.note}`));
    }
    const tips = week.tips.filter((t) => t.included);
    if (tips.length) {
      L.push(``); L.push(`PIPELINE GENERATION TIPS`);
      tips.forEach((t) => L.push(`• [${t.source}] ${t.text}`));
    }
    if (flagged.length) {
      L.push(``); L.push(`TRENDING BEHIND`);
      flagged.forEach((r) => L.push(`• ${r.account} (${r.owner}) — ${pct(r.day180)} @ D180, ${pct(r.day270)} @ D270`));
    }
    return L.join("\n");
  }, [meta, week, totalCall, totalCommit, netSwing, flagged]);

  function copy() { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }

  return (
    <>
      <div className="between">
        <div><h2>Weekly update</h2><p className="sub">Auto-assembled from this week — including only the pipeline tips you selected. Copy and drop it into Slack or email.</p></div>
        <button className="btn pri" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy update"}</button>
      </div>
      <div className="out mono">{text}</div>
    </>
  );
}

/* ============================== SETTINGS ============================== */
function SettingsTab({ meta, saveMeta, updateWeek, week, exportData, importData }) {
  const [nm, setNm] = useState("");
  const t = meta.thresholds;

  // Import / export the whole dataset as JSON.
  const fileRef = useRef(null);
  const [ioMsg, setIoMsg] = useState("");
  const [ioErr, setIoErr] = useState("");
  async function onPickFile(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setIoMsg(""); setIoErr("");
    try {
      const obj = JSON.parse(await file.text());
      const replace = confirm(
        "Replace ALL current data with this file?\n\nOK = replace everything (use this for a clean import).\nCancel = merge (add/overwrite weeks, keep the rest)."
      );
      const n = await importData(obj, { replace });
      setIoMsg(`Imported ${n} week${n === 1 ? "" : "s"} (${replace ? "replaced" : "merged"}).`);
    } catch (err) {
      setIoErr(err?.message || "Couldn't read that file.");
    }
  }

  // Team access (invite-only). Authenticated users invite teammates via the
  // server-side /api/invite function (which holds the service_role key).
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  async function invite() {
    const target = inviteEmail.trim().toLowerCase();
    setInviteMsg(""); setInviteErr("");
    if (ALLOWED_EMAIL_DOMAIN && !target.endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
      setInviteErr(`Only @${ALLOWED_EMAIL_DOMAIN} emails can be invited.`); return;
    }
    setInviteBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ email: target }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setInviteErr(j.error || "Invite failed.");
      else { setInviteMsg(j.note === "already invited" ? `${target} already has access.` : `Invite sent to ${target}.`); setInviteEmail(""); }
    } catch {
      setInviteErr("Invite failed — is the app deployed with the /api/invite function?");
    }
    setInviteBusy(false);
  }
  function addMgr() {
    const name = nm.trim(); if (!name || meta.managers.includes(name)) return;
    saveMeta({ ...meta, managers: [...meta.managers, name] });
    updateWeek((w) => { w.calls[name] = { call: null, commit: null, best: null, goal: null, closedWon: null, note: "", prior: null }; return w; });
    setNm("");
  }
  function delMgr(m) {
    if (!confirm(`Remove ${m}? Their calls stay in past weeks but they won't appear going forward.`)) return;
    saveMeta({ ...meta, managers: meta.managers.filter((x) => x !== m) });
  }
  const setT = (patch) => saveMeta({ ...meta, thresholds: { ...t, ...patch } });
  const setPlan = (v) => updateWeek((w) => { w.plan = num(v); return w; });

  return (
    <>
      <h2>Settings</h2>
      <p className="sub">Managers and the trending-behind rule. Changes to the rule re-evaluate every account immediately.</p>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card">
          <b style={{ fontSize: 14 }}>Managers</b>
          <div className="grid" style={{ gap: 7, margin: "12px 0" }}>
            {meta.managers.map((m) => (
              <div className="row between" key={m} style={{ padding: "7px 10px", background: T.panel2, borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>{m}</span>
                <button className="ico" onClick={() => delMgr(m)}><Trash2 size={14} /></button>
              </div>))}
          </div>
          <div className="row"><input style={{ flex: 1 }} value={nm} placeholder="Add manager…" onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMgr()} />
            <button className="btn gho sm" onClick={addMgr}><Plus size={14} />Add</button></div>
        </div>

        <div className="card">
          <b style={{ fontSize: 14 }}>Trending-behind rule</b>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <label className="fld">Behind threshold at Day 180 (%)
              <input type="number" value={t.d180} onChange={(e) => setT({ d180: Number(e.target.value) })} /></label>
            <label className="fld">Behind threshold at Day 270 (%)
              <input type="number" value={t.d270} onChange={(e) => setT({ d270: Number(e.target.value) })} /></label>
            <label className="fld">Combine conditions with
              <div className="seg">
                <button className={t.mode === "and" ? "on" : ""} onClick={() => setT({ mode: "and" })}>AND (both)</button>
                <button className={t.mode === "or" ? "on" : ""} onClick={() => setT({ mode: "or" })}>OR (either)</button>
              </div></label>
          </div>
        </div>

        <div className="card">
          <b style={{ fontSize: 14 }}>Ahead-of-pace rule</b>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <label className="fld">Ahead threshold at Day 180 (%)
              <input type="number" value={t.aheadD180 ?? 90} onChange={(e) => setT({ aheadD180: Number(e.target.value) })} /></label>
            <label className="fld">Ahead threshold at Day 270 (%)
              <input type="number" value={t.aheadD270 ?? 100} onChange={(e) => setT({ aheadD270: Number(e.target.value) })} /></label>
            <label className="fld">Combine conditions with
              <div className="seg">
                <button className={(t.aheadMode || "and") === "and" ? "on" : ""} onClick={() => setT({ aheadMode: "and" })}>AND (both)</button>
                <button className={t.aheadMode === "or" ? "on" : ""} onClick={() => setT({ aheadMode: "or" })}>OR (either)</button>
              </div></label>
          </div>
        </div>

        <div className="card">
          <b style={{ fontSize: 14 }}>Plan for this week</b>
          <p className="sub" style={{ margin: "5px 0 10px" }}>Target the call is measured against on {fmtDate(week.date)}.</p>
          <input type="number" className="mono" style={{ width: "100%" }} value={week.plan ?? ""} placeholder="e.g. 4200000" onChange={(e) => setPlan(e.target.value)} />
        </div>

        {supabaseConfigured && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <b style={{ fontSize: 14 }}>Team access</b>
            <p className="sub" style={{ margin: "5px 0 10px" }}>
              Invite a teammate{ALLOWED_EMAIL_DOMAIN ? ` (@${ALLOWED_EMAIL_DOMAIN} only)` : ""}. They'll get an email to
              sign in with a one-time code. There is no public sign-up — access is invite-only.
            </p>
            <div className="row">
              <input style={{ flex: 1 }} type="email" value={inviteEmail}
                placeholder={`teammate@${ALLOWED_EMAIL_DOMAIN || "company.com"}`}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()} />
              <button className="btn pri sm" onClick={invite} disabled={inviteBusy}>
                {inviteBusy ? "Inviting…" : "Invite"}
              </button>
            </div>
            {inviteMsg && <div style={{ color: T.up, fontSize: 12, marginTop: 8 }}>{inviteMsg}</div>}
            {inviteErr && <div style={{ color: T.down, fontSize: 12, marginTop: 8 }}>{inviteErr}</div>}
          </div>
        )}

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <b style={{ fontSize: 14 }}>Import / export data</b>
          <p className="sub" style={{ margin: "5px 0 10px" }}>
            Export the full dataset (every week) as a JSON file for a backup or to move it elsewhere.
            Import a JSON export to restore or bulk-add weeks.
          </p>
          <div className="row">
            <button className="btn gho sm" onClick={exportData}><Download size={14} />Export JSON</button>
            <button className="btn gho sm" onClick={() => fileRef.current?.click()}><Upload size={14} />Import JSON…</button>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onPickFile} />
          </div>
          {ioMsg && <div style={{ color: T.up, fontSize: 12, marginTop: 8 }}>{ioMsg}</div>}
          {ioErr && <div style={{ color: T.down, fontSize: 12, marginTop: 8 }}>{ioErr}</div>}
        </div>
      </div>
    </>
  );
}
