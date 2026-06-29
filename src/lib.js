/* Shared helpers, tokens, and the ported design CSS for the Clay "Terra" redesign. */

export const uid = () => Math.random().toString(36).slice(2, 9);
export const num = (v) => (v === "" || v == null ? null : Number(v));
export const money = (n) =>
  n == null || n === "" || isNaN(n) ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
export const fmtM = (n) => (n == null || isNaN(n) ? "—" : "$" + (n / 1e6).toFixed(1) + "M");
export const pct = (n) => (n == null || n === "" || isNaN(n) ? "—" : Math.round(Number(n)) + "%");
export const fmtDate = (d) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  catch { return d; }
};
export const fmtDateNum = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d;
  const [y, m, da] = d.split("-"); return da + "/" + m + "/" + y;
};
export const attainColor = (p) => (p == null ? "#A8A5A0" : p >= 100 ? "#808000" : p >= 90 ? "#9E5802" : "#C22E3D");

export const DEFAULT_THRESHOLDS = { d180: 50, d270: 90, mode: "and", aheadD180: 90, aheadD270: 100, aheadMode: "and" };

export function thisMonday() {
  const d = new Date(); const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10);
}

/* trending pace rules */
export function flag(r, t) {
  const c = [];
  if (r.day180 != null) c.push(r.day180 < t.d180);
  if (r.day270 != null) c.push(r.day270 < t.d270);
  if (!c.length) return false;
  return t.mode === "and" ? c.every(Boolean) : c.some(Boolean);
}
export function flagAhead(r, t) {
  const a180 = t.aheadD180 ?? 90, a270 = t.aheadD270 ?? 100, m = t.aheadMode || "and";
  const c = [];
  if (r.day180 != null) c.push(r.day180 >= a180);
  if (r.day270 != null) c.push(r.day270 >= a270);
  if (!c.length) return false;
  return m === "and" ? c.every(Boolean) : c.some(Boolean);
}
export const paceState = (r, t) => (flag(r, t) ? "behind" : flagAhead(r, t) ? "ahead" : "onpace");

/* a fresh empty week, carrying forward the parts that persist */
export function blankWeek(date, managers, prev) {
  const calls = {};
  (managers || []).forEach((m) => {
    const p = prev?.calls?.[m] || {};
    calls[m] = { goal: p.goal ?? null, commit: p.commit ?? null, call: p.call ?? null, best: p.best ?? null, closedWon: null, note: "", prior: p.call ?? null };
  });
  return {
    id: date, date, plan: prev?.plan ?? null, calls,
    swings: [],
    headlines: (prev?.headlines || []).map((h) => ({ ...h, id: uid() })),
    tips: [],
    trending: (prev?.trending || []).map((t) => ({ ...t, id: uid() })),
    grr: { rows: (prev?.grr?.rows || []).map((r) => ({ ...r, id: uid(), closedWon: null, grrCall: null })) },
  };
}

/* nav: [path, label, phosphor-icon] */
export const NAV = [
  ["/dashboard", "Overview", "ph-squares-four"],
  ["/calls", "Manager Calls", "ph-users-three"],
  ["/grr", "GRR", "ph-shield-check"],
  ["/swings", "Swings", "ph-arrows-down-up"],
  ["/headlines", "Headlines", "ph-megaphone"],
  ["/tips", "Pipeline Tips", "ph-lightbulb"],
  ["/trending", "Trending", "ph-trend-down"],
  ["/weekly-update", "Weekly Update", "ph-file-text"],
  ["/ask", "Ask AI", "ph-chat-circle-dots"],
  ["/settings", "Settings", "ph-gear-six"],
  ["/audit", "Audit Log", "ph-clock-counter-clockwise"],
];

export const ICONS = "/brand/assets/icons";
export const LOGO = "/brand/assets/Clay_Logo_Icon.png";

/* component styles ported from the design's <style> block */
export const FC_CSS = `
.fc-scroll::-webkit-scrollbar{width:10px;height:10px;}
.fc-scroll::-webkit-scrollbar-thumb{background:#E0DDD8;border-radius:99px;border:2px solid #FEFDFB;}
.fc input,.fc textarea,.fc select{font-family:'Roobert','Inter Tight',system-ui,sans-serif;}
.fc input::placeholder,.fc textarea::placeholder{color:#B6B2AC;}
.fc-in{width:100%;background:#FFFFFF;color:#1B1A18;border:1px solid #E6E3DE;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;transition:border-color .12s,box-shadow .12s;box-sizing:border-box;}
.fc-in:focus{border-color:#FF7714;box-shadow:0 0 0 3px rgba(255,119,20,.13);}
.fc-num{text-align:right;font-family:'Roobert SemiMono',monospace;font-variant-numeric:tabular-nums;}
.fc-navbtn:hover{background:#F4F3F0;}
.fc-row:hover{background:#FBFAF8;}
.fc-icobtn:hover{background:#F4F3F0;color:#C22E3D;}
.fc-ghost:hover{border-color:#FF7714;color:#B53D0A;}
.fc-pri:hover{background:#B53D0A;}
.fc table{width:100%;border-collapse:collapse;}
.fc th{text-align:left;font-family:'Roobert SemiMono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#A8A5A0;font-weight:600;padding:11px 12px;border-bottom:1px solid #EDEBE8;}
.fc th.num,.fc td.num{text-align:right;}
.fc td{padding:6px 12px;border-bottom:1px solid #F4F3F0;font-size:13px;vertical-align:middle;color:#1B1A18;}
.fc tbody tr:last-child td{border-bottom:none;}
.fc tfoot td{border-top:1.5px solid #EDEBE8;border-bottom:none;font-weight:600;padding:11px 12px;font-family:'Roobert SemiMono',monospace;}
.fc .drop:hover{border-color:#FF7714;background:#FFFBF7;}
.fc-weekbtn:hover{border-color:#FF7714;color:#B53D0A;}
.fc-navbtn{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;font-size:13px;font-weight:500;width:100%;border:none;cursor:pointer;background:transparent;color:#7B7974;transition:background .12s,color .12s;text-decoration:none;}
.fc-navbtn.on{background:#FFF3ED;color:#B53D0A;font-weight:600;}
.fc-navbtn.on i{color:#B53D0A;}
.fc-seg{display:inline-flex;border:1px solid #E6E3DE;border-radius:9px;overflow:hidden;background:#fff;}
.fc-seg button{padding:6px 13px;font-size:12px;font-weight:400;cursor:pointer;border:none;background:transparent;color:#7B7974;transition:background .12s,color .12s;}
.fc-seg button.on{background:#FF7714;color:#381005;font-weight:600;}
.fc-tip{display:flex;gap:12px;align-items:flex-start;padding:13px 15px;border-radius:13px;border:1px solid #EDEBE8;background:#fff;transition:background .12s,border-color .12s;}
.fc-tip.inc{border-color:#B6D44A;background:#FCFEE2;}
.fc-chk{width:21px;height:21px;border-radius:6px;flex:none;margin-top:1px;cursor:pointer;display:grid;place-items:center;border:1.5px solid #D1CDC7;background:#fff;color:#fff;transition:background .12s,border-color .12s;}
.fc-chk.on{border:none;background:#808000;}
.fc-st-not_tried{color:#7B7974;font-weight:600;}
.fc-st-in_progress{color:#9E5802;font-weight:600;}
.fc-st-successful{color:#808000;font-weight:600;}
.fc-tr-behind{background:#FFF7F7;}
.fc-tr-ahead{background:#FCFDF0;}
.fc-tr-onpace{background:#fff;}
.fc-tag{font-family:'Roobert SemiMono',monospace;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:99px;white-space:nowrap;}
.fc-tag-behind{background:#FFF1F2;color:#C22E3D;}
.fc-tag-ahead{background:#FCFEE2;color:#5C6B00;}
.fc-tag-onpace{background:#F4F3F0;color:#7B7974;}
.fc-pri{display:inline-flex;align-items:center;gap:6px;background:#FF7714;color:#381005;border:none;cursor:pointer;font-weight:600;transition:background .12s;}
.fc-ghost{display:inline-flex;align-items:center;gap:6px;border:1px solid #E0DDD8;background:#fff;color:#1B1A18;cursor:pointer;font-weight:500;transition:border-color .12s,color .12s;}
.fc-icobtn{border:none;background:none;color:#B6B2AC;cursor:pointer;transition:background .12s,color .12s;border-radius:7px;padding:6px;display:grid;place-items:center;}
@media (max-width:1180px){.fc-gauge{order:5;flex-basis:100% !important;max-width:none !important;}}
@media (max-width:1024px){.fc-acct-who{display:none;}}
@media (max-width:900px){.fc-netpill{display:none;}.fc-brand-sub{display:none;}}
@media (max-width:720px){.fc-newweek-label{display:none;}}
`;
