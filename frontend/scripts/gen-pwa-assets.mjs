// Generuje PWA ikony a iOS štartovacie obrázky (public/pwa/) = prvý snímok AppSplash.
// Spustenie: cd frontend && node scripts/gen-pwa-assets.mjs (potrebuje playwright + chromium).
// Výpis media queries skopíruj do src/app/shared/ui/pwaStartupImages.ts.
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
const PUB = path.resolve("public");
const OUT = PUB + "/pwa";
fs.mkdirSync(OUT, { recursive: true });
const icon = "data:image/svg+xml;base64," + fs.readFileSync(PUB + "/logo/actual/selfrace_icon.svg").toString("base64");
const word = "data:image/svg+xml;base64," + fs.readFileSync(PUB + "/logo/actual/selfrace_logo.svg").toString("base64");
const BG = "#0A2814", GLOW = "rgba(232, 213, 135, 0.18)", BRAND = "#BFF159", DIV = "rgba(18, 48, 37, 0.55)";

// prvý snímok AppSplash (bez animácií) - offsetY posúva stred podľa status baru/home indikátora
const splashHtml = (offsetY) => `<!doctype html><html><body style="margin:0;background:${BG};width:100vw;height:100vh;overflow:hidden">
<div style="position:fixed;inset:0;display:grid;place-items:center;transform:translateY(${offsetY}px)">
  <div style="position:absolute;width:min(460px,120vw);height:min(460px,120vw);border-radius:9999px;filter:blur(30px);opacity:.55;transform:scale(.9);background:radial-gradient(circle, ${GLOW} 0%, transparent 65%)"></div>
  <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:22px">
    <div style="position:relative;width:104px;height:104px;display:grid;place-items:center">
      <span style="position:absolute;inset:0;border-radius:9999px;border:1.5px solid ${BRAND};opacity:.5;transform:scale(.72)"></span>
      <img src="${icon}" style="width:74px;height:auto">
    </div>
    <img src="${word}" style="width:150px;height:auto;opacity:.92">
    <div style="position:relative;width:132px;height:3px;border-radius:9999px;overflow:hidden;background:${DIV}"></div>
  </div>
</div></body></html>`;

const iconHtml = (pad, bg) => `<!doctype html><html><body style="margin:0;background:${bg};width:100vw;height:100vh;display:grid;place-items:center;overflow:hidden">
<img src="${icon}" style="width:${100 - 2 * pad}vw;height:auto"></body></html>`;

// [šírka, výška (CSS px), DPR, výška status baru, spodný safe area]
const DEVICES = [
  [440, 956, 3, 62, 34], [430, 932, 3, 59, 34], [420, 912, 3, 62, 34], [402, 874, 3, 62, 34],
  [393, 852, 3, 59, 34], [428, 926, 3, 47, 34], [390, 844, 3, 47, 34], [375, 812, 3, 44, 34],
  [414, 896, 3, 44, 34], [414, 896, 2, 48, 34], [414, 736, 3, 20, 0], [375, 667, 2, 20, 0], [320, 568, 2, 20, 0],
];

const browser = await chromium.launch();
const links = [];
for (const [w, h, dpr, sb, bottom] of DEVICES) {
  // status bar "default" = stránka začína pod ním; splash má spodný padding = safe area
  const offsetY = sb / 2 - bottom / 2;
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await p.setContent(splashHtml(offsetY)); await p.waitForTimeout(150);
  const name = `splash-${w * dpr}x${h * dpr}.png`;
  await p.screenshot({ path: `${OUT}/${name}` });
  links.push({ url: `/pwa/${name}`, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)` });
  await p.close();
}
for (const [name, size, pad, bg] of [["icon-192.png", 192, 12, BG], ["icon-512.png", 512, 12, BG], ["icon-maskable-512.png", 512, 22, BG], ["apple-touch-icon.png", 180, 14, BG]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(iconHtml(pad, bg)); await p.waitForTimeout(100);
  await p.screenshot({ path: `${OUT}/${name}` });
  await p.close();
}
console.log(JSON.stringify(links, null, 2));
await browser.close();

