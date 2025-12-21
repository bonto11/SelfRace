export function hexToRgba(hex?: string, alpha = 0.15) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}