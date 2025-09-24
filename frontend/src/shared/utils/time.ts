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

export function hhmmssToSec(s: string): number | null {
  if (!s) return null;
  const parts = s.split(":").map(x => x.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const [h, m, sec] =
    parts.length === 3 ? parts.map(Number) : [0, Number(parts[0]), Number(parts[1])];
  if ([h,m,sec].some(n => Number.isNaN(n) || n < 0)) return null;
  return h * 3600 + m * 60 + sec;
}

export function secToHHMMSS(sec?: number | null): string {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(v => v.toString().padStart(2, "0")).join(":");
}

/** auto vkladanie `:` pri písaní (ako v Recovery) */
export function maskHHMMSS(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6); // max 6 číslic (hhmmss bez dvojbodiek)
  const [h, m, s] = [
    digits.slice(0, Math.max(0, digits.length - 4)),
    digits.slice(Math.max(0, digits.length - 4), Math.max(0, digits.length - 2)),
    digits.slice(Math.max(0, digits.length - 2))
  ];
  const seg = [h, m, s].filter(Boolean);
  return seg.map(v => v.padStart(2, "0")).join(":");
}