// src/utils/time.ts
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
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

// Plynulá maska pri písaní času
export function maskHHMMSS(raw: string): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, ""); // číslice
  if (d.length <= 2) return d;                             // s
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
  const parts = s.split(":").map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  const nums = parts.map(p => Number.parseInt(p, 10));
  if (nums.some(n => Number.isNaN(n))) return null;

  let h = 0, m = 0, sec = 0;
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
