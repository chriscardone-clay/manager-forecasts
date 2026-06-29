import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase, supabaseConfigured, ALLOWED_EMAIL_DOMAIN } from "./supabase.js";
import { sget, sset, sdel } from "./storage.js";
import { callAI, useAIStatus } from "./ai.js";
import {
  uid, num, money, fmtM, pct, fmtDate, fmtDateNum, attainColor, thisMonday, valDetail,
  flag, flagAhead, paceState, blankWeek, DEFAULT_THRESHOLDS, NAV, ICONS, LOGO, FC_CSS,
} from "./lib.js";

/* ============================== AUTH GATE (email OTP) ============================== */
const gw = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FEFDFB", padding: 24, fontFamily: "'Roobert','Inter Tight',system-ui,sans-serif" };
const gc = { width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #EDEBE8", borderRadius: 18, padding: 28, textAlign: "center", boxShadow: "0 24px 48px rgba(0,0,0,.06)" };
const gin = { width: "100%", marginTop: 14, padding: "11px 12px", borderRadius: 9, fontSize: 14, boxSizing: "border-box", border: "1px solid #E6E3DE", background: "#fff", color: "#1B1A18" };
const gbtn = { width: "100%", marginTop: 16, padding: "11px 14px", borderRadius: 999, cursor: "pointer", border: "none", background: "#FF7714", color: "#381005", fontWeight: 600, fontSize: 14 };
const glink = { marginTop: 14, background: "none", border: "none", color: "#7B7974", cursor: "pointer", fontSize: 12, textDecoration: "underline" };

function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [step, setStep] = useState("email");
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

  if (!supabaseConfigured) return children;
  const domainOk = (e) => !ALLOWED_EMAIL_DOMAIN || e.trim().toLowerCase().endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase());

  async function sendCode(ev) {
    ev?.preventDefault?.();
    const addr = email.trim().toLowerCase();
    setErr(""); setMsg("");
    if (!domainOk(addr)) { setErr(`Use your @${ALLOWED_EMAIL_DOMAIN} email.`); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) { setErr(/signup|not allowed|not found/i.test(error.message) ? "No account for that email yet. Ask an admin to invite you." : error.message); return; }
    setStep("code"); setMsg(`We emailed a 6-digit code to ${addr}.`);
  }
  async function verify(ev) {
    ev?.preventDefault?.();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
  }

  if (session === undefined) return <div style={gw}><div style={{ color: "#7B7974" }}>Checking your session…</div></div>;
  if (!session) {
    return (
      <div style={gw}>
        <form style={gc} onSubmit={step === "email" ? sendCode : verify}>
          <img src={LOGO} alt="Clay" style={{ width: 40, height: 40, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em" }}>Forecast Cockpit</div>
          <div style={{ color: "#7B7974", fontSize: 13, marginTop: 4 }}>Weekly Manager Review</div>
          {step === "email" ? (
            <>
              <input style={gin} type="email" autoFocus autoComplete="email" placeholder={`you@${ALLOWED_EMAIL_DOMAIN || "company.com"}`} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button style={gbtn} type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
              {ALLOWED_EMAIL_DOMAIN && <div style={{ color: "#A8A5A0", fontSize: 11, marginTop: 14 }}>Invite-only · restricted to @{ALLOWED_EMAIL_DOMAIN}</div>}
            </>
          ) : (
            <>
              <input style={gin} inputMode="numeric" autoFocus autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button style={gbtn} type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in"}</button>
              <button style={glink} type="button" onClick={() => { setStep("email"); setCode(""); setErr(""); setMsg(""); }}>Use a different email</button>
            </>
          )}
          {msg && <div style={{ color: "#7B7974", fontSize: 12, marginTop: 12 }}>{msg}</div>}
          {err && <div style={{ color: "#C22E3D", fontSize: 12, marginTop: 12 }}>{err}</div>}
        </form>
      </div>
    );
  }
  const signedEmail = (session.user?.email || "").toLowerCase();
  if (ALLOWED_EMAIL_DOMAIN && !signedEmail.endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
    return (
      <div style={gw}><div style={gc}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#C22E3D" }}>Access restricted</div>
        <div style={{ color: "#7B7974", fontSize: 13, marginTop: 8 }}>{signedEmail || "This account"} isn't on the @{ALLOWED_EMAIL_DOMAIN} domain.</div>
        <button style={glink} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div></div>
    );
  }
  return children;
}

/* ============================== shared bits ============================== */
const card = { background: "#fff", border: "1px solid #EDEBE8", borderRadius: 16, padding: "18px 20px" };
const h2 = { fontSize: 26, fontWeight: 550, letterSpacing: "-.025em", margin: "0 0 4px" };
const sub = { fontSize: 14, color: "#7B7974", lineHeight: 1.5, margin: 0 };
const kpiLbl = { fontFamily: "'Roobert SemiMono',monospace", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "#A8A5A0", marginBottom: 7 };
const kpiNum = { fontFamily: "'Roobert SemiMono',monospace", fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" };
const addBtn = { padding: "8px 14px", borderRadius: 999, fontSize: 13 };
const priBtn = { padding: "8px 16px", borderRadius: 999, fontSize: 13 };
const Trash = ({ s = 15 }) => <i className="ph ph-trash" style={{ fontSize: s }} />;
const PageHead = ({ title, children }) => (
  <div style={{ marginBottom: 18 }}><h2 style={h2}>{title}</h2><p style={sub}>{children}</p></div>
);
const EmptyState = ({ icon, title, children }) => (
  <div style={{ padding: 36, textAlign: "center" }}>
    {icon && <img src={`${ICONS}/${icon}`} alt="" style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 8 }} />}
    <div style={{ fontWeight: 550, fontSize: 15, marginBottom: 3 }}>{title}</div>
    <div style={{ fontSize: 13, color: "#7B7974" }}>{children}</div>
  </div>
);
const ownerOptsFor = (managers, cur) => (managers.includes(cur) || !cur ? managers : [cur, ...managers]);

/* ============================== ROOT ============================== */
export default function Root() {
  return <AuthGate><App /></AuthGate>;
}

function App() {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [authEmail, setAuthEmail] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => setAuthEmail(data.user?.email || null));
  }, []);

  useEffect(() => {
    (async () => {
      let meta = await sget("meta");
      const weeks = {};
      if (!meta) {
        const d = thisMonday();
        meta = { managers: [], weeks: [d], activeWeek: d, thresholds: { ...DEFAULT_THRESHOLDS } };
        const wk = blankWeek(d, [], null);
        await sset("meta", meta); await sset("week:" + d, wk);
        weeks[d] = wk;
      } else {
        meta.thresholds = { ...DEFAULT_THRESHOLDS, ...(meta.thresholds || {}) };
        for (const id of meta.weeks) { const w = await sget("week:" + id); if (w) weeks[id] = w; }
        if (!meta.weeks.includes(meta.activeWeek)) meta.activeWeek = [...meta.weeks].sort().pop();
      }
      const lg = await sget("auditlog");
      setData({ meta, weeks }); setLog(Array.isArray(lg) ? lg : []); setLoaded(true);
    })();
  }, []);

  const USER = authEmail || "you@clay.com";

  function appendLog(entry, key, kind) {
    setLog((prev) => {
      const top = prev[0]; const now = Date.now();
      let next;
      if (top && key && top.key === key && top.kind === kind && top.user === entry.user && (now - new Date(top.ts).getTime()) < 45000) {
        const mergedDetail = (top.detail && entry.detail && entry.detail.after !== undefined) ? { ...entry.detail, before: top.detail.before } : (entry.detail || top.detail);
        next = [{ ...top, ts: entry.ts, action: entry.action, detail: mergedDetail }, ...prev.slice(1)];
      } else {
        next = [entry, ...prev];
      }
      // Retention: keep the full history for 30 days (no count cap — the audit
      // log is the source of truth). Older entries age out as new ones arrive.
      const cutoff = now - 30 * 86400000;
      next = next.filter((e) => new Date(e.ts).getTime() >= cutoff);
      sset("auditlog", next);
      return next;
    });
  }
  function fullSync(prev, next) {
    sset("meta", next.meta);
    next.meta.weeks.forEach((id) => { if (next.weeks[id]) sset("week:" + id, next.weeks[id]); });
    (prev.meta.weeks || []).forEach((id) => { if (!next.meta.weeks.includes(id)) sdel("week:" + id); });
  }
  function commit(action, key, kind, mutate, detail, opts) {
    const before = structuredClone(data);
    const next = structuredClone(data);
    mutate(next);
    setData(next);
    if (opts && opts.full) fullSync(before, next);
    else { sset("meta", next.meta); const aw = next.meta.activeWeek; if (next.weeks[aw]) sset("week:" + aw, next.weeks[aw]); }
    appendLog({ id: uid(), ts: new Date().toISOString(), user: USER, action, key: key || null, kind: kind || "edit", before, detail: detail || null }, key, kind || "edit");
  }
  const updateActive = (fn, action, key, detail) => commit(action, key, "edit", (d) => fn(d.weeks[d.meta.activeWeek]), detail);
  const setThreshold = (patch, label, detail) => commit(label || "Updated trending rule", "threshold:" + Object.keys(patch)[0], "settings", (d) => Object.assign(d.meta.thresholds, patch), detail);
  function switchWeek(id) { const next = structuredClone(data); next.meta.activeWeek = id; setData(next); sset("meta", next.meta); }

  function nextMonday(dates) { const max = [...dates].sort().pop(); const dt = new Date(max + "T00:00:00"); dt.setDate(dt.getDate() + 7); return dt.toISOString().slice(0, 10); }
  function newWeek() { createWeekAt(nextMonday(data.meta.weeks)); }
  function createWeekAt(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (data.meta.weeks.includes(date)) { switchWeek(date); return; }
    commit("Created week of " + fmtDateNum(date), "week:create:" + date, "week", (d) => {
      const prior = [...d.meta.weeks].sort().filter((x) => x < date).pop() || d.meta.activeWeek;
      const prev = d.weeks[prior];
      d.weeks[date] = blankWeek(date, d.meta.managers, prev);
      d.meta.weeks = [...d.meta.weeks, date].sort();
      d.meta.activeWeek = date;
    }, null, { full: true });
  }
  function renameWeekTo(date) {
    const cur = data.meta.activeWeek;
    if (!date || date === cur || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (data.meta.weeks.includes(date)) { alert("A week with that date already exists."); return; }
    commit(`Changed meeting date ${fmtDateNum(cur)} → ${fmtDateNum(date)}`, "week:rename", "week", (d) => {
      const wk = d.weeks[cur]; wk.id = date; wk.date = date;
      delete d.weeks[cur]; d.weeks[date] = wk;
      d.meta.weeks = d.meta.weeks.filter((x) => x !== cur).concat(date).sort();
      d.meta.activeWeek = date;
    }, null, { full: true });
  }
  function deleteWeek() {
    if (data.meta.weeks.length <= 1) { alert("You can't delete the only week. Create another first."); return; }
    const cur = data.meta.activeWeek;
    if (!confirm(`Delete the week of ${fmtDateNum(cur)}? You can undo this from the Audit Log.`)) return;
    commit("Deleted week of " + fmtDateNum(cur), "week:delete:" + cur, "week", (d) => {
      delete d.weeks[cur];
      d.meta.weeks = d.meta.weeks.filter((x) => x !== cur);
      d.meta.activeWeek = [...d.meta.weeks].sort().pop();
    }, null, { full: true });
  }
  function revertTo(id) {
    const entry = (log || []).find((e) => e.id === id);
    if (!entry || !entry.before) return;
    if (!confirm(`Revert the workspace to the state before "${entry.action}"?\n\nThis undoes every change made after that point. The revert is logged too.`)) return;
    const before = structuredClone(data);
    const restored = structuredClone(entry.before);
    if (!restored.weeks[restored.meta.activeWeek]) restored.meta.activeWeek = [...restored.meta.weeks].sort().pop();
    setData(restored);
    fullSync(before, restored);
    appendLog({ id: uid(), ts: new Date().toISOString(), user: USER, action: "Reverted to before: " + entry.action, key: null, kind: "revert", before, detail: null }, null, "revert");
  }

  function exportData() {
    const out = { exportedAt: new Date().toISOString(), meta: data.meta };
    for (const id of Object.keys(data.weeks)) out["week:" + id] = data.weeks[id];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `forecast-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  if (!loaded || !data) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FEFDFB", color: "#7B7974", fontFamily: "'Roobert',system-ui,sans-serif" }}>Loading the cockpit…</div>;
  }

  const meta = data.meta, weeks = data.weeks, t = meta.thresholds;
  const week = weeks[meta.activeWeek];
  const managers = meta.managers;
  const mgOpts = managers;
  const sortedWeeks = [...meta.weeks].sort();
  const prevIdx = sortedWeeks.indexOf(meta.activeWeek) - 1;
  const prevWeek = prevIdx >= 0 ? weeks[sortedWeeks[prevIdx]] : null;

  const sum = (f) => managers.reduce((s, m) => s + (f(week.calls[m] || {}) || 0), 0);
  const totalCall = sum((c) => c.call), totalCommit = sum((c) => c.commit), totalBest = sum((c) => c.best), totalClosed = sum((c) => c.closedWon), totalGoal = sum((c) => c.goal);
  const planPct = week.plan ? (totalCall / week.plan) * 100 : 0;
  const planColor = planPct >= 100 ? "#808000" : planPct >= 92 ? "#9E5802" : "#C22E3D";
  const netSwing = week.swings.reduce((s, x) => s + (x.dir === "up" ? 1 : -1) * (x.amount || 0), 0);
  const flagged = week.trending.filter((r) => flag(r, t));
  const includedTips = week.tips.filter((x) => x.included);

  const ctx = {
    meta, weeks, week, managers, t, prevWeek, mgOpts, USER,
    totals: { totalCall, totalCommit, totalBest, totalClosed, totalGoal, planPct, planColor, netSwing },
    updateActive, setThreshold, commit, switchWeek, createWeekAt, renameWeekTo, deleteWeek, newWeek,
    exportData, log, revertTo, authEmail,
  };

  return (
    <div className="fc" style={{ fontFamily: "'Roobert','Inter Tight',system-ui,sans-serif", background: "#FEFDFB", color: "#1B1A18", minHeight: "100vh", display: "flex", flexDirection: "column", WebkitFontSmoothing: "antialiased" }}>
      <style>{FC_CSS}</style>
      <TopBar ctx={ctx} sortedWeeks={sortedWeeks} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Nav flaggedCount={flagged.length} includedTips={includedTips.length} />
        <div className="fc-scroll" style={{ flex: 1, overflow: "auto", padding: "28px 32px 72px" }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Overview ctx={ctx} />} />
            <Route path="/calls" element={<Calls ctx={ctx} />} />
            <Route path="/grr" element={<GRR ctx={ctx} />} />
            <Route path="/swings" element={<Swings ctx={ctx} />} />
            <Route path="/headlines" element={<Headlines ctx={ctx} />} />
            <Route path="/tips" element={<Tips ctx={ctx} />} />
            <Route path="/trending" element={<Trending ctx={ctx} />} />
            <Route path="/weekly-update" element={<Update ctx={ctx} />} />
            <Route path="/ask" element={<AskAI ctx={ctx} />} />
            <Route path="/settings" element={<Settings ctx={ctx} />} />
            <Route path="/audit" element={<Audit ctx={ctx} />} />
            <Route path="/help" element={<Help />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

/* ============================== TOP BAR ============================== */
function TopBar({ ctx, sortedWeeks }) {
  const { meta, totals, authEmail, switchWeek, createWeekAt, renameWeekTo, deleteWeek } = ctx;
  const planPctFmt = meta && totals.planPct ? pct(totals.planPct) : "—";
  const planBarW = Math.min(100, totals.planPct || 0) + "%";
  const netFmt = (totals.netSwing >= 0 ? "+" : "−") + money(Math.abs(totals.netSwing));
  const netColor = totals.netSwing >= 0 ? "#808000" : "#C22E3D";
  const email = (authEmail || "").toLowerCase();
  const initials = (() => { const n = email.split("@")[0] || ""; const p = n.split(/[._-]/).filter(Boolean); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || (n[0] || "?").toUpperCase(); })();
  const onlyOne = meta.weeks.length <= 1;

  return (
    <div className="fc-top" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", rowGap: 12, padding: "14px 24px", position: "sticky", top: 0, zIndex: 20, background: "rgba(254,253,251,.86)", backdropFilter: "blur(12px)", borderBottom: "1px solid #EDEBE8" }}>
      <NavLink to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 11, flex: "none", textDecoration: "none", color: "inherit" }}>
        <img src={LOGO} alt="Clay" style={{ width: 34, height: 34, objectFit: "contain", display: "block" }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <b style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-.02em" }}>Forecast Cockpit</b>
          <span className="fc-brand-sub" style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "#A8A5A0" }}>Weekly Manager Review</span>
        </div>
      </NavLink>

      <div className="fc-gauge" style={{ flex: "1 1 240px", minWidth: 160 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'Roobert SemiMono',monospace", fontSize: 11, color: "#7B7974", marginBottom: 6 }}>
          <span style={{ letterSpacing: ".04em", whiteSpace: "nowrap", flex: "none" }}>CALL VS PLAN</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}><span style={{ color: "#1B1A18" }}>{money(totals.totalCall)}</span> / {money(meta && ctx.week.plan)} <span style={{ fontWeight: 600, marginLeft: 6, color: totals.planColor }}>{planPctFmt}</span></span>
        </div>
        <div style={{ height: 9, background: "#F0EEEA", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, width: planBarW, background: totals.planColor, transition: "width .5s cubic-bezier(.2,0,0,1)" }} />
        </div>
      </div>

      <div className="fc-netpill" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, padding: "7px 14px", border: "1px solid #EDEBE8", borderRadius: 12, background: "#fff", flex: "none" }}>
        <small style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 9, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: ".08em" }}>Net Swing</small>
        <b style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 17, fontWeight: 600, color: netColor, fontVariantNumeric: "tabular-nums" }}>{netFmt}</b>
      </div>

      <div className="fc-weeks" style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
        <select className="fc-in" style={{ width: "auto", fontFamily: "'Roobert SemiMono',monospace", fontSize: 12.5, cursor: "pointer", paddingRight: 8 }} value={meta.activeWeek} onChange={(e) => switchWeek(e.target.value)}>
          {sortedWeeks.slice().reverse().map((id) => <option key={id} value={id}>Wk of {fmtDate(id)}</option>)}
        </select>
        <label className="fc-weekbtn" title="Edit this week's meeting date" style={{ position: "relative", overflow: "hidden", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E6E3DE", background: "#fff", color: "#7B7974", cursor: "pointer", flex: "none" }}>
          <i className="ph ph-calendar-dots" style={{ fontSize: 15 }} />
          <input type="date" value={meta.activeWeek} onChange={(e) => renameWeekTo(e.target.value)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
        </label>
        <button className="fc-weekbtn" title="Delete this week" onClick={deleteWeek} style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E6E3DE", background: "#fff", color: "#7B7974", cursor: "pointer", flex: "none", opacity: onlyOne ? 0.4 : 1, pointerEvents: onlyOne ? "none" : "auto" }}><i className="ph ph-trash" style={{ fontSize: 15 }} /></button>
        <label className="fc-pri" title="Create a new week" style={{ position: "relative", overflow: "hidden", padding: "8px 13px", borderRadius: 999, fontSize: 12.5 }}>
          <i className="ph-bold ph-plus" style={{ fontSize: 13 }} /><span className="fc-newweek-label">New week</span>
          <input type="date" onChange={(e) => createWeekAt(e.target.value)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
        </label>
      </div>

      <button className="fc-acct" title="Sign out" onClick={() => supabaseConfigured && supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 16, borderLeft: "1px solid #EDEBE8", flex: "none", background: "none", border: "none", borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: "#EDEBE8", cursor: supabaseConfigured ? "pointer" : "default" }}>
        <div className="fc-acct-who" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
          <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 8.5, color: "#B6B2AC", textTransform: "uppercase", letterSpacing: ".08em" }}>Signed in</span>
          <span style={{ fontSize: 12, color: "#7B7974" }}>{authEmail || "local"}</span>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 99, background: "#FFF3ED", color: "#B53D0A", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 12 }}>{initials}</div>
      </button>
    </div>
  );
}

/* ============================== NAV ============================== */
function Nav({ flaggedCount, includedTips }) {
  return (
    <div style={{ width: 216, flexShrink: 0, borderRight: "1px solid #EDEBE8", padding: "16px 12px", background: "#FBFAF8", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#B6B2AC", padding: "4px 10px 8px" }}>This week</div>
      {NAV.map(([path, label, icon]) => {
        let badge = null, badgeBg = "#FB4450", badgeFg = "#fff";
        if (path === "/trending" && flaggedCount) badge = flaggedCount;
        if (path === "/tips" && includedTips) { badge = includedTips; badgeBg = "#CBD810"; badgeFg = "#102B03"; }
        return (
          <NavLink key={path} to={path} className={({ isActive }) => "fc-navbtn" + (isActive ? " on" : "")}>
            {({ isActive }) => (<>
              <i className={(isActive ? "ph-fill " : "ph ") + icon} style={{ fontSize: 17 }} />
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {badge != null && <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: badgeBg, color: badgeFg }}>{badge}</span>}
            </>)}
          </NavLink>
        );
      })}
    </div>
  );
}

/* ============================== OVERVIEW ============================== */
function Overview({ ctx }) {
  const { meta, weeks, week, managers, t, prevWeek, totals } = ctx;
  const { totalCall, totalCommit, totalBest, totalClosed, planPct, planColor, netSwing } = totals;
  const closedPct = totalCall ? (totalClosed / totalCall) * 100 : null;
  const circ = 2 * Math.PI * 50;
  const ringDash = (Math.min(100, planPct) / 100 * circ).toFixed(1) + " " + circ.toFixed(1);

  const cards = managers.map((m) => {
    const c = week.calls[m] || {};
    const prior = prevWeek?.calls?.[m]?.call ?? c.prior;
    const delta = c.call != null && prior != null ? c.call - prior : null;
    const attain = c.goal ? (c.call ?? 0) / c.goal * 100 : null;
    const ac = attainColor(attain);
    // Scale to the largest value actually present (call can exceed best/goal),
    // and clamp every bar to 0–100% so nothing overflows the track.
    const scale = (Math.max(c.commit || 0, c.call || 0, c.best || 0, c.goal || 0, 0) * 1.06) || 1;
    const w = (v) => Math.max(0, Math.min(100, (v || 0) / scale * 100)).toFixed(1) + "%";
    return {
      name: m, callFmt: money(c.call), attainFmt: attain == null ? "—" : pct(attain), attainColor: ac,
      commitW: w(c.commit), callW: w(c.call), goalX: w(c.goal), commitFmt: fmtM(c.commit), goalFmt: fmtM(c.goal),
      wowText: delta == null ? "—" : delta === 0 ? "flat" : (delta > 0 ? "+" : "−") + money(Math.abs(delta)),
      wowIcon: delta > 0 ? "ph-bold ph-arrow-up" : delta < 0 ? "ph-bold ph-arrow-down" : "ph ph-minus",
      wowColor: delta > 0 ? "#808000" : delta < 0 ? "#C22E3D" : "#A8A5A0",
      wowBg: delta > 0 ? "#FCFEE2" : delta < 0 ? "#FFF1F2" : "#F4F3F0",
    };
  });

  // chart
  const sw = [...meta.weeks].sort();
  const series = sw.map((id) => { const w = weeks[id]; const call = managers.reduce((s, m) => s + (w.calls[m]?.call || 0), 0); return { label: fmtDate(id), call, plan: w.plan || null }; });
  const W = 640, H = 250, padL = 46, padR = 16, padT = 18, padB = 30;
  const vals = series.flatMap((s) => [s.call, s.plan]).filter((v) => v);
  let mn = vals.length ? Math.min(...vals) : 0, mx = vals.length ? Math.max(...vals) : 1;
  const span = (mx - mn) || mx || 1; mn -= span * 0.18; mx += span * 0.12;
  const xFor = (i) => padL + (W - padL - padR) * (series.length <= 1 ? 0.5 : i / (series.length - 1));
  const yFor = (v) => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));
  const callPath = series.map((s, i) => (i ? "L" : "M") + xFor(i).toFixed(1) + " " + yFor(s.call).toFixed(1)).join(" ");
  const planPath = series.filter((s) => s.plan).map((s, i) => (i ? "L" : "M") + xFor(i).toFixed(1) + " " + yFor(s.plan).toFixed(1)).join(" ");
  const areaPath = series.length ? callPath + " L" + xFor(series.length - 1).toFixed(1) + " " + (H - padB) + " L" + xFor(0).toFixed(1) + " " + (H - padB) + " Z" : "";
  const dots = series.map((s, i) => ({ cx: xFor(i).toFixed(1), cy: yFor(s.call).toFixed(1), label: s.label }));
  const ygrid = []; for (let i = 0; i <= 4; i++) { const v = mn + (mx - mn) * (i / 4); const y = yFor(v); ygrid.push({ y: y.toFixed(1), ty: (y + 3).toFixed(1), label: fmtM(v) }); }

  const swingUp = week.swings.filter((s) => s.dir === "up").reduce((a, s) => a + (s.amount || 0), 0);
  const swingDn = week.swings.filter((s) => s.dir === "down").reduce((a, s) => a + (s.amount || 0), 0);
  const swMax = Math.max(swingUp, swingDn) || 1;
  const flagged = week.trending.filter((r) => flag(r, t));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#FF7714", marginBottom: 7 }}>Week of {fmtDate(week.date)}</div>
        <h2 style={{ fontSize: 28, fontWeight: 550, letterSpacing: "-.025em", margin: "0 0 4px" }}>This week at a glance</h2>
        <p style={{ ...sub, maxWidth: 680 }}>Live snapshot for the meeting on {fmtDate(week.date)}. Everything here is captured against this week and carried forward as you go.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: 104, height: 104, flex: "none" }}>
            <svg viewBox="0 0 120 120" style={{ width: 104, height: 104, transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#F0EEEA" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={planColor} strokeWidth="12" strokeLinecap="round" strokeDasharray={ringDash} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em", color: planColor }}>{week.plan ? pct(planPct) : "—"}</span>
              <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", color: "#A8A5A0", marginTop: 2 }}>to plan</span>
            </div>
          </div>
          <div>
            <div style={kpiLbl}>Total call</div>
            <div style={{ ...kpiNum, fontSize: 26 }}>{money(totalCall)}</div>
            <div style={{ fontSize: 12, color: "#7B7974", marginTop: 3 }}>against {money(week.plan)} plan</div>
          </div>
        </div>
        {[["Commit floor", money(totalCommit), "downside protected", "#1B1A18"], ["Best case", money(totalBest), "ceiling if it all lands", "#1B1A18"], ["Closed-won", money(totalClosed), (closedPct == null ? "—" : pct(closedPct)) + " of call booked", "#808000"]].map(([l, v, s, col]) => (
          <div key={l} style={card}>
            <div style={kpiLbl}>{l}</div>
            <div style={{ ...kpiNum, fontSize: 24, color: col }}>{v}</div>
            <div style={{ fontSize: 12, color: "#7B7974", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {cards.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 12, marginBottom: 16 }}>
          {cards.map((c) => (
            <div key={c.name} style={{ ...card, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "'Roobert SemiMono',monospace", fontSize: 10.5, fontWeight: 600, color: c.wowColor, background: c.wowBg, padding: "2px 7px", borderRadius: 99 }}><i className={c.wowIcon} style={{ fontSize: 11 }} />{c.wowText}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 11 }}>
                <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>{c.callFmt}</span>
                <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 12, fontWeight: 600, color: c.attainColor }}>{c.attainFmt}</span>
              </div>
              <div style={{ position: "relative", height: 8, background: "#F0EEEA", borderRadius: 99, marginBottom: 6 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 99, width: c.commitW, background: "#D1CDC7" }} />
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 99, width: c.callW, background: c.attainColor }} />
                <div style={{ position: "absolute", top: -2, height: 12, width: 2, borderRadius: 2, background: "#1B1A18", left: c.goalX }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Roobert SemiMono',monospace", fontSize: 9.5, letterSpacing: ".04em", textTransform: "uppercase", color: "#B6B2AC" }}>
                <span>Commit {c.commitFmt}</span><span>Goal {c.goalFmt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <b style={{ fontSize: 14.5, fontWeight: 550 }}>Total call vs plan</b>
            <div style={{ display: "flex", gap: 14, fontFamily: "'Roobert SemiMono',monospace", fontSize: 10.5, color: "#7B7974" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: "#FF7714", display: "inline-block" }} />Call</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #B6B2AC", display: "inline-block" }} />Plan</span>
            </div>
          </div>
          <svg viewBox="0 0 640 250" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
            {ygrid.map((g, i) => (<g key={i}><line x1="46" x2="624" y1={g.y} y2={g.y} stroke="#F0EEEA" strokeWidth="1" /><text x="40" y={g.ty} textAnchor="end" fontFamily="Roobert SemiMono, monospace" fontSize="10" fill="#B6B2AC">{g.label}</text></g>))}
            {areaPath && <path d={areaPath} fill="#FFF3ED" />}
            {planPath && <path d={planPath} fill="none" stroke="#B6B2AC" strokeWidth="2" strokeDasharray="5 5" />}
            {callPath && <path d={callPath} fill="none" stroke="#FF7714" strokeWidth="2.5" strokeLinejoin="round" />}
            {dots.map((d, i) => (<g key={i}><circle cx={d.cx} cy={d.cy} r="4" fill="#fff" stroke="#FF7714" strokeWidth="2.5" /><text x={d.cx} y="240" textAnchor="middle" fontFamily="Roobert SemiMono, monospace" fontSize="10.5" fill="#7B7974">{d.label}</text></g>))}
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <b style={{ fontSize: 14.5, fontWeight: 550 }}>Swing in play</b>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7B7974", marginBottom: 5 }}><span>Upside</span><span style={{ fontFamily: "'Roobert SemiMono',monospace", color: "#808000", fontWeight: 600 }}>{money(swingUp)}</span></div>
                <div style={{ height: 8, background: "#F0EEEA", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 99, background: "#CBD810", width: (swingUp / swMax * 100) + "%" }} /></div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7B7974", marginBottom: 5 }}><span>Downside</span><span style={{ fontFamily: "'Roobert SemiMono',monospace", color: "#C22E3D", fontWeight: 600 }}>{money(swingDn)}</span></div>
                <div style={{ height: 8, background: "#F0EEEA", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 99, background: "#FB4450", width: (swingDn / swMax * 100) + "%" }} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 11, borderTop: "1px solid #EDEBE8" }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Net swing</span>
                <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 18, fontWeight: 600, color: netSwing >= 0 ? "#808000" : "#C22E3D" }}>{(netSwing >= 0 ? "+" : "−") + money(Math.abs(netSwing))}</span>
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <b style={{ fontSize: 14.5, fontWeight: 550 }}>Trending behind</b>
              {flagged.length > 0 && <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "#FFF1F2", color: "#C22E3D" }}>{flagged.length} flagged</span>}
            </div>
            {flagged.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {flagged.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F4F3F0" }}>
                    <span>{r.account} <span style={{ color: "#B6B2AC" }}>· {r.owner}</span></span>
                    <span style={{ fontFamily: "'Roobert SemiMono',monospace", color: "#C22E3D", fontWeight: 600 }}>{r.day180 != null ? pct(r.day180) : "—"}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 12.5, color: "#7B7974" }}>No accounts breaching thresholds.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================== MANAGER CALLS ============================== */
function Calls({ ctx }) {
  const { managers, week, prevWeek, updateActive, totals } = ctx;
  const set = (m, f, v) => { const oldV = (week.calls[m] || {})[f]; updateActive((w) => { w.calls[m] = { ...w.calls[m], [f]: f === "note" ? v : num(v) }; }, `Edited ${m} — ${f}`, `call:${m}:${f}`, f === "note" ? valDetail(oldV, v, "text") : valDetail(oldV, num(v), "money")); };
  return (
    <>
      <PageHead title="Manager calls">Each manager's call on where they'll land. The prior week's call is carried in automatically so you can see movement — commit is the floor, best is the ceiling. Or drop this week's forecast export to fill the table at once.</PageHead>
      <ForecastImporter ctx={ctx} />
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr><th>Manager</th><th className="num">Goal</th><th className="num">Commit</th><th className="num">Call</th><th className="num">Best</th><th className="num">Closed-won</th><th className="num">Attain</th><th className="num">WoW</th><th>Note</th></tr></thead>
          <tbody>
            {managers.length === 0 && <tr><td colSpan={9} style={{ padding: 26, textAlign: "center", color: "#7B7974" }}>No managers yet — add them in Settings, or drop a forecast export above.</td></tr>}
            {managers.map((m) => {
              const c = week.calls[m] || {};
              const prior = prevWeek?.calls?.[m]?.call ?? c.prior;
              const d = c.call != null && prior != null ? c.call - prior : null;
              const attain = c.goal ? (c.call ?? 0) / c.goal * 100 : null;
              return (
                <tr key={m} className="fc-row">
                  <td style={{ fontWeight: 500 }}>{m}</td>
                  {["goal", "commit", "call", "best", "closedWon"].map((f) => (
                    <td key={f} className="num"><input className="fc-in fc-num" type="number" value={c[f] ?? ""} placeholder="—" onChange={(e) => set(m, f, e.target.value)} /></td>
                  ))}
                  <td className="num" style={{ fontFamily: "'Roobert SemiMono',monospace", fontWeight: 600, color: attainColor(attain) }}>{attain == null ? "—" : pct(attain)}</td>
                  <td className="num" style={{ fontFamily: "'Roobert SemiMono',monospace", color: d > 0 ? "#808000" : d < 0 ? "#C22E3D" : "#A8A5A0" }}>{d == null ? "—" : d === 0 ? "flat" : (d > 0 ? "+" : "−") + money(Math.abs(d))}</td>
                  <td style={{ minWidth: 200 }}><input className="fc-in" value={c.note || ""} placeholder="add context…" onChange={(e) => set(m, "note", e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
          {managers.length > 0 && <tfoot><tr><td>Total</td><td className="num" style={{ color: "#7B7974" }}>{money(totals.totalGoal)}</td><td></td><td className="num" style={{ color: "#B53D0A" }}>{money(totals.totalCall)}</td><td></td><td className="num" style={{ color: "#808000" }}>{money(totals.totalClosed)}</td><td colSpan={3}></td></tr></tfoot>}
        </table>
      </div>
    </>
  );
}

/* ============================== GRR ============================== */
function GRR({ ctx }) {
  const { week, managers, updateActive } = ctx;
  const rows = week.grr?.rows || [];
  const upd = (id, f, v) => { const row = (week.grr?.rows || []).find((r) => r.id === id) || {}; const isMoney = f === "goal" || f === "closedWon" || f === "grrCall"; updateActive((w) => { if (!w.grr) w.grr = { rows: [] }; w.grr.rows = w.grr.rows.map((r) => r.id === id ? { ...r, [f]: isMoney ? num(v) : v } : r); }, `Edited GRR — ${f}`, `grr:${id}:${f}`, isMoney ? valDetail(row[f], num(v), "money") : valDetail(row[f], v, "text")); };
  const add = () => updateActive((w) => { if (!w.grr) w.grr = { rows: [] }; w.grr.rows.push({ id: uid(), manager: managers[0] || "", segment: "Enterprise", goal: null, closedWon: null, grrCall: null, notes: "" }); }, "Added GRR row", "grr:add");
  const del = (id) => updateActive((w) => { w.grr.rows = w.grr.rows.filter((r) => r.id !== id); }, "Removed GRR row", "grr:del:" + id);
  const tGoal = rows.reduce((s, r) => s + (r.goal || 0), 0), tWon = rows.reduce((s, r) => s + (r.closedWon || 0), 0), tCall = rows.reduce((s, r) => s + (r.grrCall || 0), 0);
  const at = tGoal ? tWon / tGoal * 100 : null;
  return (
    <>
      <PageHead title="Gross revenue retention">Per-manager GRR goal, closed-won so far, and the call on where it lands. Attainment is closed-won vs. goal.</PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <div style={card}><div style={kpiLbl}>GRR goal</div><div style={kpiNum}>{money(tGoal)}</div></div>
        <div style={card}><div style={kpiLbl}>Closed-won</div><div style={{ ...kpiNum, color: "#808000" }}>{money(tWon)}</div></div>
        <div style={card}><div style={kpiLbl}>Attainment</div><div style={{ ...kpiNum, color: attainColor(at) }}>{at == null ? "—" : pct(at)}</div></div>
      </div>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? <EmptyState icon="Target.png" title="No GRR rows yet">Add a manager row to start tracking retention.</EmptyState> : (
          <table>
            <thead><tr><th>Manager</th><th>Segment</th><th className="num">Goal</th><th className="num">Closed-won</th><th className="num">GRR call</th><th className="num">Attain</th><th>Notes</th><th></th></tr></thead>
            <tbody>{rows.map((r) => {
              const a = r.goal ? (r.closedWon ?? 0) / r.goal * 100 : null;
              return (
                <tr key={r.id} className="fc-row">
                  <td><select className="fc-in" value={r.manager} onChange={(e) => upd(r.id, "manager", e.target.value)}>{ownerOptsFor(managers, r.manager).map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                  <td><input className="fc-in" value={r.segment || ""} placeholder="segment" onChange={(e) => upd(r.id, "segment", e.target.value)} /></td>
                  <td className="num"><input className="fc-in fc-num" type="number" value={r.goal ?? ""} placeholder="—" onChange={(e) => upd(r.id, "goal", e.target.value)} /></td>
                  <td className="num"><input className="fc-in fc-num" type="number" value={r.closedWon ?? ""} placeholder="—" onChange={(e) => upd(r.id, "closedWon", e.target.value)} /></td>
                  <td className="num"><input className="fc-in fc-num" type="number" value={r.grrCall ?? ""} placeholder="—" onChange={(e) => upd(r.id, "grrCall", e.target.value)} /></td>
                  <td className="num" style={{ fontFamily: "'Roobert SemiMono',monospace", fontWeight: 600, color: attainColor(a) }}>{a == null ? "—" : pct(a)}</td>
                  <td style={{ minWidth: 160 }}><input className="fc-in" value={r.notes || ""} placeholder="notes…" onChange={(e) => upd(r.id, "notes", e.target.value)} /></td>
                  <td><button className="fc-icobtn" onClick={() => del(r.id)}><Trash /></button></td>
                </tr>
              );
            })}</tbody>
            <tfoot><tr><td>Total</td><td></td><td className="num">{money(tGoal)}</td><td className="num" style={{ color: "#808000" }}>{money(tWon)}</td><td className="num">{money(tCall)}</td><td colSpan={3}></td></tr></tfoot>
          </table>
        )}
      </div>
      <button className="fc-ghost" onClick={add} style={{ ...addBtn, marginTop: 14 }}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Add row</button>
    </>
  );
}

/* ============================== SWINGS ============================== */
function Swings({ ctx }) {
  const { week, managers, updateActive } = ctx;
  const rows = week.swings;
  const upd = (id, f, v) => { const row = week.swings.find((r) => r.id === id) || {}; updateActive((w) => { w.swings = w.swings.map((r) => r.id === id ? { ...r, [f]: f === "amount" ? num(v) : v } : r); }, `Edited swing — ${f}`, `swing:${id}:${f}`, f === "amount" ? valDetail(row.amount, num(v), "money") : valDetail(row[f], v, "text")); };
  const add = () => updateActive((w) => { w.swings.push({ id: uid(), account: "", owner: managers[0] || "", dir: "up", amount: null, note: "" }); }, "Added swing", "swing:add");
  const del = (id) => updateActive((w) => { w.swings = w.swings.filter((r) => r.id !== id); }, "Removed swing", "swing:del:" + id);
  const up = rows.filter((s) => s.dir === "up").reduce((a, s) => a + (s.amount || 0), 0);
  const dn = rows.filter((s) => s.dir === "down").reduce((a, s) => a + (s.amount || 0), 0);
  const net = up - dn;
  return (
    <>
      <PageHead title="Swing factors">Deals or accounts that could move the number up or down before quarter close. Net swing rolls up to the top bar.</PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <div style={card}><div style={kpiLbl}>Potential upside</div><div style={{ ...kpiNum, color: "#808000" }}>{money(up)}</div></div>
        <div style={card}><div style={kpiLbl}>Potential downside</div><div style={{ ...kpiNum, color: "#C22E3D" }}>{money(dn)}</div></div>
        <div style={card}><div style={kpiLbl}>Net</div><div style={{ ...kpiNum, color: net >= 0 ? "#808000" : "#C22E3D" }}>{(net >= 0 ? "+" : "−") + money(Math.abs(net))}</div></div>
      </div>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? <EmptyState icon="Growth-chart.png" title="No swings logged">Track the deals most likely to move your call this week.</EmptyState> : (
          <table>
            <thead><tr><th>Account</th><th>Owner</th><th>Direction</th><th className="num">Amount</th><th>Why</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="fc-row">
                <td><input className="fc-in" value={r.account} placeholder="account" onChange={(e) => upd(r.id, "account", e.target.value)} /></td>
                <td><select className="fc-in" value={r.owner} onChange={(e) => upd(r.id, "owner", e.target.value)}>{ownerOptsFor(managers, r.owner).map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                <td><div className="fc-seg"><button className={r.dir === "up" ? "on" : ""} onClick={() => upd(r.id, "dir", "up")}>Up</button><button className={r.dir === "down" ? "on" : ""} onClick={() => upd(r.id, "dir", "down")}>Down</button></div></td>
                <td className="num"><input className="fc-in fc-num" type="number" value={r.amount ?? ""} placeholder="0" onChange={(e) => upd(r.id, "amount", e.target.value)} /></td>
                <td style={{ minWidth: 200 }}><input className="fc-in" value={r.note || ""} placeholder="context…" onChange={(e) => upd(r.id, "note", e.target.value)} /></td>
                <td><button className="fc-icobtn" onClick={() => del(r.id)}><Trash /></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <button className="fc-ghost" onClick={add} style={{ ...addBtn, marginTop: 14 }}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Add swing</button>
    </>
  );
}

/* ============================== HEADLINES ============================== */
function Headlines({ ctx }) {
  const { week, managers, updateActive } = ctx;
  const rows = week.headlines;
  const upd = (id, f, v) => { const row = week.headlines.find((r) => r.id === id) || {}; updateActive((w) => { w.headlines = w.headlines.map((r) => r.id === id ? { ...r, [f]: v } : r); }, `Edited headline — ${f}`, `hl:${id}:${f}`, valDetail(row[f], v, "text")); };
  const add = () => updateActive((w) => { w.headlines.push({ id: uid(), account: "", owner: managers[0] || "", note: "" }); }, "Added headline", "hl:add");
  const del = (id) => updateActive((w) => { w.headlines = w.headlines.filter((r) => r.id !== id); }, "Removed headline", "hl:del:" + id);
  return (
    <>
      <PageHead title="Rep & customer headlines">The notable stories from the week — expansions, risks, champion changes. These carry forward week over week so you can keep editing the running narrative.</PageHead>
      {rows.length === 0 && <div style={{ ...card, marginBottom: 14 }}><EmptyState icon="Email.png" title="No headlines yet">Capture what your managers are calling out this week.</EmptyState></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ ...card, borderRadius: 14, padding: "13px 15px" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 9 }}>
              <input className="fc-in" style={{ flex: "0 0 220px" }} value={r.account} placeholder="Account / rep" onChange={(e) => upd(r.id, "account", e.target.value)} />
              <select className="fc-in" style={{ flex: "0 0 150px" }} value={r.owner} onChange={(e) => upd(r.id, "owner", e.target.value)}>{ownerOptsFor(managers, r.owner).map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <button className="fc-icobtn" style={{ marginLeft: "auto" }} onClick={() => del(r.id)}><Trash /></button>
            </div>
            <textarea className="fc-in" style={{ minHeight: 54, resize: "vertical" }} value={r.note || ""} placeholder="What's the story?" onChange={(e) => upd(r.id, "note", e.target.value)} />
          </div>
        ))}
      </div>
      <button className="fc-ghost" onClick={add} style={{ ...addBtn, marginTop: 14 }}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Add headline</button>
    </>
  );
}

/* ============================== PIPELINE TIPS ============================== */
const TIP_STATUS = [["not_tried", "Not tried"], ["in_progress", "In progress"], ["successful", "Successful"]];
function Tips({ ctx }) {
  const { week, managers, updateActive } = ctx;
  const ai = useAIStatus();
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rows = week.tips;
  const toggle = (id) => updateActive((w) => { w.tips = w.tips.map((t) => t.id === id ? { ...t, included: !t.included } : t); }, "Toggled tip", `tip:inc:${id}`);
  const del = (id) => updateActive((w) => { w.tips = w.tips.filter((t) => t.id !== id); }, "Removed tip", "tip:del:" + id);
  const addManual = () => updateActive((w) => { w.tips.push({ id: uid(), source: "Other", text: "", owner: "", status: "not_tried", included: false }); }, "Added tip", "tip:add");
  const setField = (id, f, v) => { const row = week.tips.find((t) => t.id === id) || {}; updateActive((w) => { w.tips = w.tips.map((t) => t.id === id ? { ...t, [f]: v } : t); }, `Edited tip — ${f}`, `tip:${id}:${f}`, valDetail(row[f], v, "text")); };
  const ownerOpts = (o) => ["", ...ownerOptsFor(managers, o)];
  async function suggest() {
    if (!paste.trim()) { setErr("Paste some Slack wins or Gong notes first."); return; }
    setBusy(true); setErr("");
    try {
      const { tips } = await callAI({ action: "tips", notes: paste });
      const arr = Array.isArray(tips) ? tips : [];
      if (!arr.length) setErr("No tips came back — add more detail, or add one manually.");
      else { updateActive((w) => { arr.slice(0, 3).forEach((t) => w.tips.push({ id: uid(), source: t.source || "Other", text: t.text, owner: "", status: "not_tried", included: false })); }, "AI drafted tips", "tip:ai"); setPaste(""); }
    } catch (e) { setErr(e.message || "Couldn't generate suggestions."); }
    setBusy(false);
  }
  const inc = rows.filter((t) => t.included).length;
  return (
    <>
      <PageHead title="Pipeline generation tips">Wins and talk tracks to share with the team. Check the ones to include in this week's update. Until Gong and Slack are connected live, paste recent wins or call notes and let the assistant draft suggestions.</PageHead>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-sparkle" style={{ fontSize: 17, color: "#FF7714" }} /><b style={{ fontSize: 14, fontWeight: 550 }}>Draft from Slack / Gong</b></div>
          {ai !== "on" && <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 10.5, color: "#7B7974", background: "#F4F3F0", padding: "3px 9px", borderRadius: 99 }}>{ai === "checking" ? "Checking AI…" : "AI coming soon"}</span>}
        </div>
        {ai === "off" && <p style={{ ...sub, fontSize: 12.5, margin: "0 0 10px" }}>AI drafting turns on once the Claude API key is added. You can still add tips manually.</p>}
        <textarea className="fc-in" style={{ minHeight: 92, resize: "vertical", marginBottom: 10 }} value={paste} disabled={ai !== "on"} placeholder="Paste recent Slack wins, closed-won notes, or Gong call snippets here…" onChange={(e) => setPaste(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="fc-pri" onClick={suggest} disabled={busy || ai !== "on"} style={priBtn}><i className="ph-fill ph-sparkle" style={{ fontSize: 13 }} />{busy ? "Drafting…" : ai === "on" ? "Suggest tips" : "Suggest tips (soon)"}</button>
          <button className="fc-ghost" onClick={addManual} style={addBtn}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Add manually</button>
          {err && <span style={{ fontSize: 12, color: "#C22E3D" }}>{err}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <b style={{ fontSize: 13, color: "#7B7974" }}>{rows.length} suggestion{rows.length !== 1 ? "s" : ""}</b>
        <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "#FCFEE2", color: "#5C6B00" }}>{inc} selected for update</span>
      </div>
      {rows.length === 0 ? <div style={card}><EmptyState title="No tips yet">Draft some from your wins above, or add one manually.</EmptyState></div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className={"fc-tip" + (r.included ? " inc" : "")}>
              <button className={"fc-chk" + (r.included ? " on" : "")} onClick={() => toggle(r.id)}>{r.included && <i className="ph-bold ph-check" style={{ fontSize: 13 }} />}</button>
              <div style={{ flex: 1 }}>
                <textarea className="fc-in" style={{ border: "none", background: "transparent", padding: 0, minHeight: 38, resize: "vertical" }} value={r.text} onChange={(e) => setField(r.id, "text", e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
                  <select className="fc-in" style={{ width: "auto", fontSize: 12, padding: "5px 8px" }} value={r.owner || ""} onChange={(e) => setField(r.id, "owner", e.target.value)}>{ownerOpts(r.owner).map((m) => <option key={m || "none"} value={m}>{m || "Unassigned"}</option>)}</select>
                  <select className={"fc-in fc-st-" + (r.status || "not_tried")} style={{ width: "auto", fontSize: 12, padding: "5px 8px" }} value={r.status || "not_tried"} onChange={(e) => setField(r.id, "status", e.target.value)}>{TIP_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 9.5, letterSpacing: ".04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 99, border: "1px solid #E6E3DE", color: "#7B7974" }}>{r.source}</span>
                </div>
              </div>
              <button className="fc-icobtn" onClick={() => del(r.id)}><i className="ph ph-x" style={{ fontSize: 15 }} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============================== TRENDING ============================== */
function Trending({ ctx }) {
  const { week, managers, t, updateActive, commit } = ctx;
  const [view, setView] = useState("behind");
  const upd = (id, f, v) => { const row = week.trending.find((r) => r.id === id) || {}; const isDay = f === "day180" || f === "day270"; updateActive((w) => { w.trending = w.trending.map((r) => r.id === id ? { ...r, [f]: isDay ? num(v) : v } : r); }, `Edited trending — ${f}`, `trend:${id}:${f}`, isDay ? valDetail(row[f], num(v), "pct") : valDetail(row[f], v, "text")); };
  const add = () => updateActive((w) => { w.trending.push({ id: uid(), account: "", owner: managers[0] || "", day180: null, day270: null, actionPlan: "" }); }, "Added trending account", "trend:add");
  const del = (id) => updateActive((w) => { w.trending = w.trending.filter((r) => r.id !== id); }, "Removed trending account", "trend:del:" + id);
  const behind = week.trending.filter((r) => flag(r, t));
  const ahead = week.trending.filter((r) => flagAhead(r, t));
  const hasD270 = week.trending.some((r) => r.day270 != null);
  const shown = view === "behind" ? behind : view === "ahead" ? ahead : week.trending;
  const ruleText = `Behind = under ${t.d180}% at Day 180${hasD270 ? ` ${t.mode === "and" ? "and" : "or"} under ${t.d270}% at Day 270` : ""}; Ahead = at/over ${t.aheadD180 ?? 90}% at Day 180.`;
  return (
    <>
      <PageHead title="Trending">{ruleText} Values are attainment vs. expected pace. Adjust both rules in Settings.</PageHead>
      {!hasD270 && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEFAE8", border: "1px solid #F5DE9A", borderRadius: 11, padding: "11px 14px", marginBottom: 14, fontSize: 12.5, color: "#7A5A07", lineHeight: 1.5 }}><i className="ph-fill ph-warning" style={{ fontSize: 15, color: "#9E5802", flex: "none", marginTop: 1 }} /><span>This week's file is the <b>Day 180</b> export only — the rule is running on the Day 180 line alone. Drop the matching <b>Day 270</b> export too to evaluate both milestones.</span></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <b style={{ fontSize: 13, color: "#7B7974" }}>{week.trending.length} tracked · {behind.length} behind · {ahead.length} ahead</b>
        <div className="fc-seg">
          <button className={view === "behind" ? "on" : ""} onClick={() => setView("behind")}>Behind ({behind.length})</button>
          <button className={view === "ahead" ? "on" : ""} onClick={() => setView("ahead")}>Ahead ({ahead.length})</button>
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>All ({week.trending.length})</button>
        </div>
      </div>
      <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {shown.length === 0 ? <EmptyState icon="Signals-satellite.png" title={view === "behind" ? "Nothing behind" : view === "ahead" ? "Nothing ahead" : "No accounts yet"}>No accounts in this view this week.</EmptyState> : (
          <table>
            <thead><tr><th>Account</th><th>Owner</th><th className="num">Day 180</th><th className="num">Day 270</th><th>Status</th><th>Action plan</th><th></th></tr></thead>
            <tbody>{shown.map((r) => {
              const st = paceState(r, t);
              return (
                <tr key={r.id} className={"fc-row fc-tr-" + st}>
                  <td><input className="fc-in" value={r.account} placeholder="account" onChange={(e) => upd(r.id, "account", e.target.value)} /></td>
                  <td><select className="fc-in" value={r.owner} onChange={(e) => upd(r.id, "owner", e.target.value)}>{ownerOptsFor(managers, r.owner).map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                  <td className="num"><input className="fc-in fc-num" type="number" value={r.day180 ?? ""} placeholder="—" onChange={(e) => upd(r.id, "day180", e.target.value)} /></td>
                  <td className="num"><input className="fc-in fc-num" type="number" value={r.day270 ?? ""} placeholder="—" onChange={(e) => upd(r.id, "day270", e.target.value)} /></td>
                  <td><span className={"fc-tag fc-tag-" + st}>{st === "behind" ? "Behind" : st === "ahead" ? "Ahead" : "On pace"}</span></td>
                  <td style={{ minWidth: 180 }}><input className="fc-in" value={r.actionPlan || ""} placeholder="plan…" onChange={(e) => upd(r.id, "actionPlan", e.target.value)} /></td>
                  <td><button className="fc-icobtn" onClick={() => del(r.id)}><Trash /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      <button className="fc-ghost" onClick={add} style={{ ...addBtn, marginBottom: 18 }}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Add account</button>
      <TrendingImporter ctx={ctx} commit={commit} />
    </>
  );
}

/* ============================== WEEKLY UPDATE ============================== */
function Update({ ctx }) {
  const { week, managers, t, totals } = ctx;
  const [copied, setCopied] = useState(false);
  const inc = week.tips.filter((x) => x.included);
  const flagged = week.trending.filter((r) => flag(r, t));
  const lines = [];
  lines.push(`FORECAST — week of ${fmtDate(week.date)}`, "");
  lines.push(`Total call: ${money(totals.totalCall)} / ${money(week.plan)} plan (${week.plan ? pct(totals.planPct) : "—"})`);
  lines.push(`Commit floor: ${money(totals.totalCommit)} · Best case: ${money(totals.totalBest)} · Closed-won: ${money(totals.totalClosed)}`);
  lines.push(`Net swing: ${(totals.netSwing >= 0 ? "+" : "−") + money(Math.abs(totals.netSwing))}`, "");
  if (managers.length) { lines.push("MANAGER CALLS"); managers.forEach((m) => { const c = week.calls[m] || {}; lines.push(`• ${m}: ${money(c.call)}${c.note ? " — " + c.note : ""}`); }); lines.push(""); }
  if (flagged.length) { lines.push("TRENDING BEHIND"); flagged.forEach((r) => lines.push(`• ${r.account} (${r.owner}) — Day180 ${r.day180 != null ? pct(r.day180) : "—"}${r.actionPlan ? " · " + r.actionPlan : ""}`)); lines.push(""); }
  if (inc.length) { lines.push("PIPELINE TIPS"); inc.forEach((tp) => lines.push(`• ${tp.text}${tp.owner ? " (" + tp.owner + ")" : ""}`)); lines.push(""); }
  const text = lines.join("\n");
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* */ } }
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div><h2 style={h2}>Weekly update</h2><p style={{ ...sub, maxWidth: 600 }}>Auto-assembled from this week — including only the pipeline tips you selected. Copy and drop it into Slack or email.</p></div>
        <button className="fc-pri" onClick={copy} style={{ padding: "10px 16px", borderRadius: 999, fontSize: 13.5, whiteSpace: "nowrap" }}><i className={copied ? "ph-bold ph-check" : "ph ph-copy"} style={{ fontSize: 15 }} />{copied ? "Copied" : "Copy update"}</button>
      </div>
      <pre style={{ ...card, fontFamily: "'Roobert SemiMono',monospace", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, maxWidth: 760 }}>{text}</pre>
    </>
  );
}

/* ============================== ASK AI ============================== */
function AskAI({ ctx }) {
  const { meta, weeks } = ctx;
  const ai = useAIStatus();
  const ready = ai === "on";
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const examples = [
    "Which managers are furthest behind their goal this week?",
    "How did the total call change versus last week, and who moved it?",
    "Which trending-behind accounts still have no action plan?",
    "Summarize the biggest risks to the number this week.",
  ];
  async function ask(question) {
    const Q = (question ?? q).trim(); if (!Q) return;
    setBusy(true); setErr(""); setAnswer(""); setAsked(Q); setQ(Q);
    try { const { answer } = await callAI({ action: "ask", question: Q, context: { meta, weeks } }); setAnswer(answer || "(no answer returned)"); }
    catch (e) { setErr(e.message || "Couldn't get an answer."); }
    setBusy(false);
  }
  return (
    <>
      <PageHead title="Ask AI">Ask a question about the forecast. The assistant answers from your data across the current and prior weeks — manager calls, swings, GRR, trending, and tips.</PageHead>
      {ai === "off" && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEFAE8", border: "1px solid #F5DE9A", borderRadius: 11, padding: "11px 14px", marginBottom: 14, fontSize: 12.5, color: "#7A5A07", lineHeight: 1.5, maxWidth: 760 }}><i className="ph-fill ph-warning" style={{ fontSize: 15, color: "#9E5802", flex: "none", marginTop: 1 }} /><span><b>Coming soon.</b> Ask AI turns on once the Claude API key is added. Everything else works as normal.</span></div>}
      <div style={{ ...card, marginBottom: 14, maxWidth: 760 }}>
        <textarea className="fc-in" style={{ minHeight: 78, resize: "vertical", marginBottom: 10 }} value={q} disabled={!ready} placeholder={ready ? "e.g. Which accounts slipped the most week over week?" : "AI is coming soon…"} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask(); }} />
        <button className="fc-pri" onClick={() => ask()} disabled={busy || !ready} style={priBtn}><i className="ph-fill ph-paper-plane-tilt" style={{ fontSize: 13 }} />{busy ? "Thinking…" : ready ? "Ask" : "Ask (soon)"}</button>
      </div>
      {ready && !asked && !busy && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
          {examples.map((ex) => <button key={ex} className="fc-ghost" onClick={() => ask(ex)} style={{ justifyContent: "flex-start", textAlign: "left", padding: "11px 14px", borderRadius: 11, fontSize: 13 }}><i className="ph-fill ph-sparkle" style={{ fontSize: 14, color: "#FF7714", flex: "none" }} />{ex}</button>)}
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: "#C22E3D", marginTop: 4 }}>{err}</div>}
      {(busy || answer) && (
        <div style={{ ...card, maxWidth: 760, marginTop: 4 }}>
          {asked && <div style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 11, letterSpacing: ".04em", color: "#A8A5A0", marginBottom: 10, textTransform: "uppercase" }}>{asked}</div>}
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6 }}>{busy ? "Analyzing the forecast…" : answer}</div>
        </div>
      )}
    </>
  );
}

/* ============================== SETTINGS ============================== */
function Settings({ ctx }) {
  const { meta, week, managers, t, commit, updateActive, setThreshold, exportData } = ctx;
  const [nm, setNm] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState(""); const [inviteErr, setInviteErr] = useState(""); const [inviteBusy, setInviteBusy] = useState(false);
  function addMgr() {
    const name = nm.trim(); if (!name || managers.includes(name)) return;
    commit("Added manager " + name, "mgr:add", "edit", (d) => { d.meta.managers = [...d.meta.managers, name]; const wk = d.weeks[d.meta.activeWeek]; wk.calls[name] = { goal: null, commit: null, call: null, best: null, closedWon: null, note: "", prior: null }; });
    setNm("");
  }
  function delMgr(m) { if (!confirm(`Remove ${m}? Their calls stay in past weeks but they won't appear going forward.`)) return; commit("Removed manager " + m, "mgr:del", "edit", (d) => { d.meta.managers = d.meta.managers.filter((x) => x !== m); }); }
  const setPlan = (v) => { const oldV = week.plan; updateActive((w) => { w.plan = num(v); }, "Set weekly plan", "plan", valDetail(oldV, num(v), "money")); };
  async function invite() {
    const target = inviteEmail.trim().toLowerCase(); setInviteMsg(""); setInviteErr("");
    if (ALLOWED_EMAIL_DOMAIN && !target.endsWith("@" + ALLOWED_EMAIL_DOMAIN.toLowerCase())) { setInviteErr(`Only @${ALLOWED_EMAIL_DOMAIN} emails can be invited.`); return; }
    setInviteBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ email: target }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setInviteErr(j.error || "Invite failed."); else { setInviteMsg(j.note === "already invited" ? `${target} already has access.` : `Invite sent to ${target}.`); setInviteEmail(""); }
    } catch { setInviteErr("Invite failed — is the app deployed with /api/invite?"); }
    setInviteBusy(false);
  }
  const ruleCard = (title, keys) => (
    <div style={card}>
      <b style={{ fontSize: 14.5, fontWeight: 550 }}>{title}</b>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 13 }}>
        {keys.map(([k, label]) => (
          <label key={k} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#7B7974" }}>{label}
            <input className="fc-in fc-num" type="number" value={t[k] ?? ""} onChange={(e) => setThreshold({ [k]: Number(e.target.value) }, "Updated " + title.toLowerCase(), valDetail(t[k], Number(e.target.value), "pct"))} /></label>
        ))}
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#7B7974" }}>Combine conditions with
          <div className="fc-seg">
            <button className={(t[keys.modeKey] || "and") === "and" ? "on" : ""} onClick={() => setThreshold({ [keys.modeKey]: "and" }, "Updated " + title.toLowerCase(), { before: (t[keys.modeKey] || "and").toUpperCase(), after: "AND" })}>AND (both)</button>
            <button className={t[keys.modeKey] === "or" ? "on" : ""} onClick={() => setThreshold({ [keys.modeKey]: "or" }, "Updated " + title.toLowerCase(), { before: (t[keys.modeKey] || "and").toUpperCase(), after: "OR" })}>OR (either)</button>
          </div></label>
      </div>
    </div>
  );
  const behindKeys = Object.assign([["d180", "Behind under Day 180 (%)"], ["d270", "Behind under Day 270 (%)"]], { modeKey: "mode" });
  const aheadKeys = Object.assign([["aheadD180", "Ahead at/over Day 180 (%)"], ["aheadD270", "Ahead at/over Day 270 (%)"]], { modeKey: "aheadMode" });
  return (
    <>
      <PageHead title="Settings">Managers, the trending rules, and the weekly plan. Changes to a rule re-evaluate every account immediately.</PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <b style={{ fontSize: 14.5, fontWeight: 550 }}>Managers</b>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "13px 0" }}>
            {managers.length === 0 && <div style={{ fontSize: 12.5, color: "#7B7974" }}>No managers yet.</div>}
            {managers.map((m) => <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 11px", background: "#F4F3F0", borderRadius: 9 }}><span style={{ fontSize: 13 }}>{m}</span><button className="fc-icobtn" onClick={() => delMgr(m)}><i className="ph ph-trash" style={{ fontSize: 14 }} /></button></div>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}><input className="fc-in" style={{ flex: 1 }} value={nm} placeholder="Add manager…" onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMgr()} /><button className="fc-ghost" onClick={addMgr} style={{ padding: "8px 13px", borderRadius: 999, fontSize: 13 }}><i className="ph-bold ph-plus" style={{ fontSize: 12 }} />Add</button></div>
        </div>
        <div style={card}>
          <b style={{ fontSize: 14.5, fontWeight: 550 }}>Plan for this week</b>
          <p style={{ ...sub, fontSize: 12.5, margin: "5px 0 11px" }}>Target the call is measured against.</p>
          <input className="fc-in fc-num" type="number" style={{ fontSize: 15 }} value={week.plan ?? ""} placeholder="e.g. 5300000" onChange={(e) => setPlan(e.target.value)} />
        </div>
        {ruleCard("Trending-behind rule", behindKeys)}
        {ruleCard("Ahead-of-pace rule", aheadKeys)}
        {supabaseConfigured && (
          <div style={{ ...card, gridColumn: "1 / -1" }}>
            <b style={{ fontSize: 14.5, fontWeight: 550 }}>Team access</b>
            <p style={{ ...sub, fontSize: 12.5, margin: "5px 0 11px" }}>Invite a teammate{ALLOWED_EMAIL_DOMAIN ? ` (@${ALLOWED_EMAIL_DOMAIN} only)` : ""}. They'll get an email to sign in with a one-time code — access is invite-only.</p>
            <div style={{ display: "flex", gap: 8, maxWidth: 480 }}><input className="fc-in" style={{ flex: 1 }} type="email" value={inviteEmail} placeholder={`teammate@${ALLOWED_EMAIL_DOMAIN || "company.com"}`} onChange={(e) => setInviteEmail(e.target.value)} /><button className="fc-pri" onClick={invite} disabled={inviteBusy} style={priBtn}>{inviteBusy ? "Inviting…" : "Invite"}</button></div>
            {inviteMsg && <div style={{ fontSize: 12, color: "#5C6B00", marginTop: 9 }}>{inviteMsg}</div>}
            {inviteErr && <div style={{ fontSize: 12, color: "#C22E3D", marginTop: 9 }}>{inviteErr}</div>}
          </div>
        )}
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <b style={{ fontSize: 14.5, fontWeight: 550 }}>Import / export data</b>
          <p style={{ ...sub, fontSize: 12.5, margin: "5px 0 11px" }}>Export the full dataset (every week) as a JSON file for a backup or to move it elsewhere.</p>
          <button className="fc-ghost" onClick={exportData} style={addBtn}><i className="ph ph-download-simple" style={{ fontSize: 14 }} />Export JSON</button>
        </div>
      </div>
    </>
  );
}

/* ============================== AUDIT LOG ============================== */
function Audit({ ctx }) {
  const { log, revertTo } = ctx;
  const [open, setOpen] = useState({});
  const kindMeta = {
    edit: { icon: "ph ph-pencil-simple", label: "Edit", bg: "#EEF2FF", fg: "#3B5BDB" },
    import: { icon: "ph ph-database", label: "Bulk import", bg: "#FFF3ED", fg: "#B53D0A" },
    settings: { icon: "ph ph-gear-six", label: "Settings", bg: "#F4F3F0", fg: "#7B7974" },
    week: { icon: "ph ph-calendar-dots", label: "Week", bg: "#F0FCFF", fg: "#008BAD" },
    revert: { icon: "ph ph-arrow-counter-clockwise", label: "Revert", bg: "#FCFEE2", fg: "#5C6B00" },
  };
  const rel = (ts) => { const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return "just now"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; const h = Math.floor(m / 60); if (h < 24) return h + "h ago"; return Math.floor(h / 24) + "d ago"; };
  const absT = (ts) => { try { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  return (
    <>
      <PageHead title="Audit log">Every change made across the cockpit, newest first — who made it, when, and what changed. Revert rolls the whole workspace back to the state just before that change.</PageHead>
      <div style={{ marginBottom: 11 }}><b style={{ fontSize: 13, color: "#7B7974" }}>{log.length} change{log.length !== 1 ? "s" : ""}</b></div>
      {log.length === 0 ? <div style={card}><EmptyState icon="Calendar.png" title="No changes yet">Edits, imports and settings changes will appear here as you work.</EmptyState></div> : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {log.map((r) => {
            const km = kindMeta[r.kind] || kindMeta.edit;
            const d = r.detail; const hasDelta = d && d.after !== undefined && d.before !== undefined;
            const isText = hasDelta && d.kind === "text";   // long text diff → collapsed
            const isVal = hasDelta && !isText;               // short money/% diff → inline
            const isImport = r.kind === "import" && Array.isArray(d?.rows);
            return (
              <div key={r.id} style={{ borderTop: "1px solid #F4F3F0" }}>
                <div className="fc-row" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 18px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: km.bg, color: km.fg }}><i className={km.icon} style={{ fontSize: 16 }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.action}</div>
                    <div style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 11, color: "#A8A5A0", marginTop: 3 }}>{r.user} · {absT(r.ts)} · {rel(r.ts)}</div>
                    {isVal && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}><span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 11.5, color: "#C22E3D", background: "#FFF1F2", padding: "2px 9px", borderRadius: 6, textDecoration: "line-through" }}>{d.before}</span><i className="ph-bold ph-arrow-right" style={{ fontSize: 11, color: "#A8A5A0" }} /><span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 11.5, color: "#5C6B00", background: "#FCFEE2", padding: "2px 9px", borderRadius: 6 }}>{d.after}</span></div>}
                    {isText && <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "'Roobert SemiMono',monospace", fontSize: 11.5, color: "#2B6CB0", padding: 0 }}><i className={open[r.id] ? "ph ph-caret-up" : "ph ph-caret-down"} style={{ fontSize: 12 }} />{open[r.id] ? "Hide change" : "Inspect change"}</button>}
                    {isImport && <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "'Roobert SemiMono',monospace", fontSize: 11.5, color: "#2B6CB0", padding: 0 }}><i className={open[r.id] ? "ph ph-caret-up" : "ph ph-caret-down"} style={{ fontSize: 12 }} />{open[r.id] ? "Hide" : "Show"} {d.rows.length} rows</button>}
                  </div>
                  <span style={{ fontFamily: "'Roobert SemiMono',monospace", fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: km.bg, color: km.fg, flex: "none" }}>{km.label}</span>
                  <button className="fc-ghost" onClick={() => revertTo(r.id)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12, flex: "none" }}><i className="ph ph-arrow-counter-clockwise" style={{ fontSize: 13 }} />Revert</button>
                </div>
                {isImport && open[r.id] && (
                  <div style={{ padding: "0 18px 14px 64px" }}>
                    <div style={{ border: "1px solid #EDEBE8", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "flex", background: "#FBFAF8", fontFamily: "'Roobert SemiMono',monospace", fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#A8A5A0", padding: "7px 12px" }}><span style={{ flex: 2 }}>Account</span><span style={{ flex: 1.4 }}>Owner</span><span style={{ flex: 1, textAlign: "right" }}>Day 180</span><span style={{ flex: 1, textAlign: "right" }}>Day 270</span></div>
                      {d.rows.map((ir, i) => <div key={i} style={{ display: "flex", fontSize: 12, padding: "6px 12px", borderTop: "1px solid #F4F3F0" }}><span style={{ flex: 2 }}>{ir.account}</span><span style={{ flex: 1.4, color: "#7B7974" }}>{ir.owner}</span><span style={{ flex: 1, textAlign: "right", fontFamily: "'Roobert SemiMono',monospace" }}>{ir.day180 ?? "—"}</span><span style={{ flex: 1, textAlign: "right", fontFamily: "'Roobert SemiMono',monospace" }}>{ir.day270 ?? "—"}</span></div>)}
                    </div>
                  </div>
                )}
                {isText && open[r.id] && (
                  <div style={{ padding: "0 18px 14px 64px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ alignSelf: "flex-start", maxWidth: "100%", fontSize: 12.5, color: "#C22E3D", background: "#FFF1F2", padding: "6px 11px", borderRadius: 8, textDecoration: "line-through", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}>{d.before || "—"}</span>
                    <span style={{ alignSelf: "flex-start", maxWidth: "100%", fontSize: 12.5, color: "#5C6B00", background: "#FCFEE2", padding: "6px 11px", borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}>{d.after || "—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============================== HELP ============================== */
const HELP_SECTIONS = [
  ["ph-sign-in", "Signing in", "Access is invite-only and restricted to @clay.com. Enter your Clay email and we email you a 6-digit one-time code — type it in to sign in. There's no password to remember. If your email isn't recognized, ask an admin to invite you (Settings → Team access)."],
  ["ph-calendar-dots", "Picking a week", "The top bar runs the whole app off one active week. Use the dropdown to switch weeks, the calendar button to change a week's meeting date, the trash to delete a week, and “New week” (pick a date) to start a fresh one — last week's calls, headlines, trending and GRR rows carry forward automatically."],
  ["ph-squares-four", "Overview", "Your at-a-glance read for the meeting. The ring shows total call vs plan; the four tiles are total call, commit floor (downside), best case (ceiling) and closed-won. The per-manager cards show each call, attainment to goal, the commit→goal range, and week-over-week movement. Below: the call-vs-plan trend, swing in play, and accounts trending behind."],
  ["ph-users-three", "Manager Calls", "The core table — each manager's Goal, Commit (floor), Call (most likely), Best case, Closed-won, plus auto-computed Attainment and week-over-week change, and a free-text note. Edit any cell and it saves instantly. To fill the whole table at once, drop your forecast CSV export onto the drop zone — it maps Most Likely / Commit / Best Case and sets the plan from the Total goal."],
  ["ph-shield-check", "GRR", "Gross revenue retention per manager: segment, GRR goal, closed-won so far, the call on where it lands, and notes. Attainment (closed-won ÷ goal) and totals compute automatically. Add or remove rows as needed."],
  ["ph-arrows-down-up", "Swings", "Log the deals most likely to move the number before quarter close — pick a direction (up/down), an amount and why. Potential upside, downside and the net all roll up, and the net swing also shows in the top bar."],
  ["ph-megaphone", "Headlines", "The notable rep & customer stories of the week — expansions, risks, champion changes. They carry forward week to week so you can keep editing the running narrative."],
  ["ph-lightbulb", "Pipeline Tips", "Wins and talk tracks worth sharing. Add them manually (with an owner and a status: not tried / in progress / successful) and check the ones to include in the Weekly Update. When the AI assistant is enabled you can paste Slack/Gong notes and have it draft tips for you."],
  ["ph-trend-down", "Trending", "Accounts by adoption pace vs. expected. Each account shows Day-180 and Day-270 attainment and is tagged Behind, Ahead, or On-pace based on the thresholds in Settings. Switch between Behind / Ahead / All, jot an action plan per account, and drop your adoption CSV to bulk-load (it maps columns and converts 0–1 ratios to %)."],
  ["ph-file-text", "Weekly Update", "A ready-to-send summary auto-assembled from this week — totals, manager calls, trending-behind accounts, and only the pipeline tips you checked. Hit Copy and paste it straight into Slack or email."],
  ["ph-chat-circle-dots", "Ask AI", "Ask a plain-English question about the forecast (“who's furthest behind goal?”, “what moved week over week?”) and get an answer drawn from your data across the current and prior weeks. Shows “coming soon” until the AI key is configured."],
  ["ph-gear-six", "Settings", "Manage the manager roster, the weekly plan, and the Trending rules (the Day-180/270 thresholds for Behind and Ahead). Invite teammates under Team access (@clay.com only), and export the full dataset as JSON for a backup."],
  ["ph-clock-counter-clockwise", "Audit Log", "A complete history of every change — who made it, when, and the before → after. Bulk imports can be expanded to see every row. Need to undo? Revert rolls the whole workspace back to the state just before any change. History is kept for 30 days."],
];
function Help() {
  return (
    <>
      <PageHead title="Help & how-to">Everything you need to run the weekly forecast review yourself — no demo required. Each section below maps to a tab in the left nav. Changes save automatically to the shared workspace, so everyone on the team sees the same live numbers.</PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>
        {HELP_SECTIONS.map(([icon, title, body]) => (
          <div key={title} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: "#FFF3ED", color: "#B53D0A" }}><i className={"ph " + icon} style={{ fontSize: 17 }} /></div>
              <b style={{ fontSize: 14.5, fontWeight: 550 }}>{title}</b>
            </div>
            <p style={{ ...sub, fontSize: 13 }}>{body}</p>
          </div>
        ))}
      </div>
      <div style={{ ...card, marginTop: 14, display: "flex", alignItems: "center", gap: 12, background: "#FFFBF7", borderColor: "#FCD9BE" }}>
        <i className="ph-fill ph-lifebuoy" style={{ fontSize: 22, color: "#B53D0A", flex: "none" }} />
        <div><b style={{ fontSize: 13.5, fontWeight: 550 }}>Still stuck?</b><div style={{ ...sub, fontSize: 13 }}>Your edits can't break anything permanently — the Audit Log can revert any change. For access issues or anything not covered here, reach out to Chris on Slack.</div></div>
      </div>
    </>
  );
}

/* ============================== IMPORTERS ============================== */
function ForecastImporter({ ctx }) {
  const { commit, managers } = ctx;
  const [err, setErr] = useState(""); const [done, setDone] = useState(""); const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const moneyNum = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : Math.round(n); };
  const isIndented = (s) => s !== s.replace(/^[\s   ]+/, "");
  function handleFile(file) {
    setErr(""); setDone(""); if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { setErr("That's not a .csv — export the forecast as CSV."); return; }
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => {
      const fields = (res.meta.fields || []).filter(Boolean);
      const find = (re) => fields.find((f) => re.test(f)) || "";
      const cMgr = find(/manager|name/i), cCall = find(/most likely/i) || find(/forecast|call/i), cCommit = find(/^commit/i) || find(/commit/i), cBest = find(/best/i);
      const cGoal = fields.find((f) => /goal/i.test(f) && !/attain/i.test(f)) || "";
      if (!cMgr || !cCall) { setErr("Couldn't find Manager and Most Likely columns."); return; }
      const mgrs = []; const calls = {}; let planTotal = null;
      res.data.forEach((r) => {
        const raw = String(r[cMgr] ?? ""); const name = raw.trim(); if (!name) return;
        if (/^total$/i.test(name)) { planTotal = cGoal ? moneyNum(r[cGoal]) : null; return; }
        if (isIndented(raw)) return;
        mgrs.push(name);
        calls[name] = { goal: cGoal ? moneyNum(r[cGoal]) : null, commit: cCommit ? moneyNum(r[cCommit]) : null, call: moneyNum(r[cCall]), best: cBest ? moneyNum(r[cBest]) : null, closedWon: null, note: "", prior: null };
      });
      if (!mgrs.length) { setErr("No manager rows detected."); return; }
      commit(`Imported forecast — ${mgrs.length} managers`, "import:forecast", "import", (d) => {
        const wk = d.weeks[d.meta.activeWeek];
        mgrs.forEach((m) => { const ex = wk.calls[m]; calls[m].prior = ex?.call ?? null; if (ex?.note) calls[m].note = ex.note; });
        wk.calls = calls; if (planTotal != null) wk.plan = planTotal; d.meta.managers = mgrs;
      });
      setDone(`Loaded ${mgrs.length} managers${planTotal != null ? " · plan " + money(planTotal) : ""}.`);
    }, error: () => setErr("Couldn't read that file.") });
  }
  return (
    <div className="drop" role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      style={{ border: "1.5px dashed " + (over ? "#FF7714" : "#E0DDD8"), borderRadius: 14, padding: "18px 20px", textAlign: "center", color: "#7B7974", cursor: "pointer", marginBottom: 16, background: over ? "#FFFBF7" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}><i className="ph ph-file-arrow-up" style={{ fontSize: 20, color: "#FF7714" }} /><b style={{ fontSize: 13.5, color: "#1B1A18" }}>Drop the forecast export</b><span style={{ fontSize: 12.5 }}>— fills calls from Most Likely, Commit, Best Case; sets plan from the Total goal</span></div>
      {done && <div style={{ fontSize: 12, color: "#5C6B00", marginTop: 7 }}>{done}</div>}
      {err && <div style={{ fontSize: 12, color: "#C22E3D", marginTop: 7 }}>{err}</div>}
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}

function TrendingImporter({ ctx, commit }) {
  const { managers } = ctx;
  const [mode, setMode] = useState("replace"); const [done, setDone] = useState(""); const [err, setErr] = useState(""); const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const pctNum = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };
  function handleFile(file) {
    setErr(""); setDone(""); if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { setErr("That's not a .csv."); return; }
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => {
      const fields = (res.meta.fields || []).filter(Boolean);
      const data = (res.data || []).filter((r) => Object.values(r).some((v) => String(v).trim()));
      if (!fields.length || !data.length) { setErr("No rows found."); return; }
      const find = (re) => fields.find((f) => re.test(f)) || "";
      const milestone = (day) => { const metric = (f) => /ratio|attain|percent|pct|%|pacing|index|score/i.test(f) && !/cutoff|date|expected/i.test(f); return fields.find((f) => new RegExp(day).test(f) && metric(f)) || fields.find((f) => new RegExp(day).test(f) && !/cutoff|date/i.test(f)) || ""; };
      const map = { account: find(/account|customer|company|client|logo/i) || find(/name/i), owner: find(/manager|owner|rep|ae|csm/i), day180: milestone("180"), day270: milestone("270") };
      if (!map.account) { setErr("Couldn't find an account column."); return; }
      const allVals = []; [map.day180, map.day270].filter(Boolean).forEach((c) => data.forEach((r) => { const n = pctNum(r[c]); if (n != null) allVals.push(Math.abs(n)); }));
      const f = allVals.length && Math.max(...allVals) <= 3 ? 100 : 1;
      const conv = (v) => { const n = pctNum(v); return n == null ? null : Math.round(n * f * 10) / 10; };
      const rows = data.map((r) => ({ id: uid(), account: String(r[map.account] ?? "").trim(), owner: String(r[map.owner] ?? "").trim() || (managers[0] || ""), day180: map.day180 ? conv(r[map.day180]) : null, day270: map.day270 ? conv(r[map.day270]) : null, actionPlan: "" })).filter((x) => x.account);
      if (!rows.length) { setErr("No accounts parsed."); return; }
      const detailRows = rows.map((r) => ({ account: r.account, owner: r.owner, day180: r.day180, day270: r.day270 }));
      commit(`Bulk import — ${rows.length} trending accounts (${mode === "replace" ? "replaced" : "added"})`, "import:trending", "import", (d) => {
        const wk = d.weeks[d.meta.activeWeek]; wk.trending = mode === "replace" ? rows : [...wk.trending, ...rows];
      }, { mode, rows: detailRows });
      setDone(`Imported ${rows.length} accounts (${mode}).`);
    }, error: () => setErr("Couldn't read that file.") });
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><b style={{ fontSize: 14, fontWeight: 550 }}>Import this week's adoption export</b><div className="fc-seg"><button className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace list</button><button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add to list</button></div></div>
      <label className="drop" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{ display: "block", border: "1.5px dashed " + (over ? "#FF7714" : "#E0DDD8"), borderRadius: 13, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: over ? "#FFFBF7" : "transparent" }}>
        <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
        <i className="ph ph-file-arrow-up" style={{ fontSize: 26, color: "#FF7714" }} />
        <div style={{ fontWeight: 550, fontSize: 14, color: "#1B1A18", marginTop: 6 }}>Drop your CSV here</div>
        <div style={{ fontSize: 12.5, color: "#7B7974", marginTop: 2 }}>or click to browse · columns map automatically · ratios (0–1) convert to %</div>
      </label>
      {done && <div style={{ fontSize: 12, color: "#5C6B00", marginTop: 9 }}>{done}</div>}
      {err && <div style={{ fontSize: 12, color: "#C22E3D", marginTop: 9 }}>{err}</div>}
    </div>
  );
}
