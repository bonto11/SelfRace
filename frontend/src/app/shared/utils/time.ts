// src/utils/time.ts
import { THEME } from "@/app/shared/theme/tokens";

export function parseHHMMSS(s?: string | null): number | null {
  if (!s) return null;
  const parts = s.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    const [h, m, sec] = parts;
    return h * 3600 + m * 60 + sec;
  }
  if (parts.length === 2) {
    const [m, sec] = parts;
    return m * 60 + sec;
  }
  return null;
}

export function formatHHMMSS(total?: number | null): string {
  if (total == null) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

// Plynulá maska pri písaní času
export function maskHHMMSS(raw: string): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, ""); // číslice
  if (d.length <= 2) return d; // s
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`; // m:s

  // 5+ číslic: h:mm:ss (hodiny môžu mať ľubovoľný počet číslic)
  const s = d.slice(-2);
  const m = d.slice(-4, -2);
  const h = d.slice(0, -4);
  return `${h}:${m}:${s}`;
}

// Tolerantný parser "ss" | "m:ss" | "h:mm:ss"
export function hhmmssToSec(s?: string | null): number | null {
  if (!s) return null;
  const parts = s
    .split(":")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) return null;

  let h = 0,
    m = 0,
    sec = 0;
  if (nums.length === 1) [sec] = nums;
  else if (nums.length === 2) [m, sec] = nums;
  else {
    const last3 = nums.slice(-3);
    [h, m, sec] = last3;
  }
  return h * 3600 + m * 60 + sec;
}

// Vždy vráti "H:MM:SS" (H bez nulovania na 2 cifry)
export function secToHHMMSS(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function fmtSecondsHMS(v?: number | null): string {
  const sTot = Number(v);
  if (!Number.isFinite(sTot) || sTot < 0) return "—";

  const h = Math.floor(sTot / 3600);
  const m = Math.floor((sTot % 3600) / 60);
  const s = Math.round(sTot % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// minúty (float) -> "5h 30m" / "4m" / "0m"
export function fmtMinutes(v?: number | null): string {
  const min = Number(v);
  if (!Number.isFinite(min) || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// minúty (float) -> celé minúty: "123 min" / "—"
export function fmtMinutesWhole(v?: number | null): string {
  const min = Number(v);
  if (!Number.isFinite(min) || min < 0) return "—";
  return `${Math.round(min)} min`;
}

export function prettySkDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

export function isoDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}
// alias – niektoré importy volajú toISODate
export const toISODate = isoDate;

// pondelok?
export function isMonday(dateIso: string) {
  const d = new Date(dateIso + "T00:00:00");
  const wd = d.getDay(); // 0=NE, 1=PO
  return wd === 1;
}

// „6–12.10.“ z pondelka
export function formatWeekRange(startIso: string) {
  const s = new Date(startIso + "T00:00:00");
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  const sd = s.getDate(),
    sm = s.getMonth() + 1;
  const ed = e.getDate(),
    em = e.getMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}

export function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function HHMMToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]),
    min = Number(m[2]);
  return h * 60 + min;
}

/** Lokálny "dnes" v tvare YYYY-MM-DD (bez UTC posunu). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Bezpečne vytiahne ISO dátum (YYYY-MM-DD) z hodnoty string/Date. */
export function toISODateLoose(
  v: string | Date | null | undefined
): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    // predpokladáme "YYYY-MM-DD" alebo ISO datetime → vezmi prvých 10 znakov
    const s = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  // Date → lokálna ISO bez časovej zóny
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, "0");
  const d = String(v.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Formát na zobrazenie pre SK (napr. 9. 10. 2025). */
export function formatSk(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("sk-SK");
}

// robustný addDays pre ISO bez časovej zóny (žiadne skákanie o dva dni)
export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function handleTimeInput(
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string) => void
) {
  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + ":" + v.slice(2);
  setter(v);
}

/* --------------------- dátumové utily --------------------- */
export function addDays(iso: string, d: number): string {
  const dt = new Date(iso + "T00:00:00");
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO týždeň (Po–Ne) vo formáte YYYY-Www + start/end tohto týždňa. */
export function isoWeekInfo(iso: string) {
  const dt = new Date(iso + "T00:00:00Z");
  // dostať sa na najbližší pondelok (Mon=1)
  const day = dt.getUTCDay() || 7; // Sun=0 -> 7
  const mon = new Date(dt);
  mon.setUTCDate(dt.getUTCDate() - day + 1);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  const start = mon.toISOString().slice(0, 10);
  const end = sun.toISOString().slice(0, 10);

  // číslo týždňa
  const year = mon.getUTCFullYear();
  const week = isoWeekNumber(mon);
  const weekKey = `${year}-W${String(week).padStart(2, "0")}`;

  const label = rangeLabel(start, end);
  return { weekKey, start, end, label };
}

export function isoWeekNumber(d: Date): number {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return weekNo;
}

export function rangeLabel(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  const sd = s.getUTCDate(),
    sm = s.getUTCMonth() + 1;
  const ed = e.getUTCDate(),
    em = e.getUTCMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}

export function fmtShortDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sk-SK", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

// denné ISO labely
export function iso(d: Date) {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10);
}

export function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1))
    out.push(iso(d));
  return out;
}

export function minToHM(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return { h, m };
}
export function fmtRange(s: string, e: string) {
  const sd = new Date(s),
    ed = new Date(e);
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return "—";
  const sdD = sd.getDate(),
    sdM = sd.getMonth() + 1;
  const edD = ed.getDate(),
    edM = ed.getMonth() + 1;
  return sdM === edM
    ? `${sdD}–${edD}.${edM}.`
    : `${sdD}.${sdM}.–${edD}.${edM}.`;
}

export function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("sk-SK") : "—";
}

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Lokalizovaný dátum pre summary. */
export function formatMetricDate(d?: string | null): string {
  const loc = THEME.i18n?.dateLocale ?? "sk-SK";
  return d ? new Date(d).toLocaleDateString(loc) : "—";
}
