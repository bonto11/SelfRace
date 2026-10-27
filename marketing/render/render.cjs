// marketing/render/render.cjs
//
// Obrázok na Instagram v štýle SelfRace (čierna + limetková, Inter, maskoti).
//
// Použitie (z koreňa repa):
//   NODE_PATH=/opt/node22/lib/node_modules node marketing/render/render.cjs spec.json out.png
//
// spec.json:
// {
//   "format": "post" | "story",       // post 1080×1350, story 1080×1920
//   "tag": "Tip na dnes",              // nepovinné – štítok nad nadpisom
//   "icon": "dumbbell",                // nepovinné – ikona v štítku (kľúč z icons.json)
//   "title": "Nadpis s **zvýraznením**",
//   "lead": "Podnadpis",               // nepovinné
//   "bullets": ["bod 1", "bod 2"],     // nepovinné, max 4
//   "figure": "trail",                 // nepovinné: lift | trail | ocr | woman | man | pair
//   "cta": "Vyskúšaj na selfrace.com", // nepovinné – výzva dole
//   "strava": false,                   // nepovinné – logo Powered by Strava (len pri Strava dátach)
//   "layout": "meme",                  // nepovinné – mem: title hore, maskot v strede, lead dole
//   "figureFile": "/tmp/scena.png",    // nepovinné – nakreslená scéna (gen_scene.cjs) namiesto maskota
//   "figureHeight": 820                // nepovinné – výška obrázka v px (hook slide bez bodov = väčšia scéna)
// }
// **text** = limetkové zvýraznenie.
//
// Porovnanie „bez / so SelfRace“ (slide rozdelený na dve polovice, každá s popisom):
// { "layout": "compare", "panels": [ { "image": "/tmp/bez.png", "caption": "Univerzálny plán…" },
//                                     { "image": "/tmp/so.png",  "caption": "SelfRace…" } ] }
// Posledný slide porovnania (vždy ten istý obrázok, mení sa len text):
// { "layout": "compare-end", "top": "Nie ty plánu. Plán tebe.", "bottom": "Prvý mesiac PRO zadarmo." }
// Obom porovnávacím layoutom pridaj "format": "story" = 9:16 (1080×1920) pre Reels/Stories
// a reklamy – bubliny ostanú mimo ovládania Instagramu.
//
// PREČO HTML + Chromium: rovnaký vzhľad ako ručne robené posty, písmo a ikony
// z appky, bez grafického editora.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const PUB = path.join(ROOT, "frontend", "public");
const ASSETS = path.join(ROOT, "marketing", "assets");
const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, "icons.json"), "utf8"));
const LIME = "#A4F52B";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// nakreslená scéna má prednosť pred hotovým maskotom
function figureSrc(spec, fallback) {
  if (spec.figureFile && fs.existsSync(spec.figureFile)) return "file://" + path.resolve(spec.figureFile);
  const fig = ["lift", "trail", "ocr", "woman", "man", "pair"].includes(spec.figure) ? spec.figure : fallback;
  return fig ? `file://${ASSETS}/${fig}.webp` : null;
}

const hl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');

function icon(name, size = 30, color = LIME, stroke = 2) {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function waves(w, h) {
  const paths = [];
  const base = h - 590;
  for (let i = 0; i < 34; i++) {
    const y0 = base + i * 15;
    const op = (0.1 + 0.22 * (i / 34)).toFixed(2);
    paths.push(`<path d="M -40 ${y0} C 260 ${y0 + 70 + i * 3}, 470 ${h - 140 + i * 2}, 760 ${h + 30}" stroke="${LIME}" stroke-opacity="${op}" stroke-width="1.2" fill="none"/>`);
    paths.push(`<path d="M ${w + 40} ${y0} C ${w - 260} ${y0 + 70 + i * 3}, ${w - 470} ${h - 140 + i * 2}, ${w - 760} ${h + 30}" stroke="${LIME}" stroke-opacity="${op}" stroke-width="1.2" fill="none"/>`);
  }
  return `<svg class="waves" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths.join("")}</svg><div class="glow"></div>`;
}

function buildMeme(spec) {
  const story = spec.format === "story";
  const W = 1080;
  const H = story ? 1920 : 1350;
  const src = figureSrc(spec, "man");
  const pad = story ? 260 : 90;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; font-family: 'Inter', sans-serif; }
.slide { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; color: #fff;
  background: radial-gradient(ellipse 900px 700px at 50% 55%, #0f1a07 0%, #000 70%); display: flex; flex-direction: column; align-items: center; }
.hl { color: ${LIME}; }
.top { margin-top: ${pad}px; padding: 0 70px; text-align: center; font-size: ${story ? 84 : 76}px; font-weight: 900; line-height: 1.08; letter-spacing: -.01em; }
.fig { flex: 1 1 auto; min-height: 0; max-width: 92%; object-fit: contain; margin: 30px 0; }
.bottom { padding: 0 70px; text-align: center; font-size: ${story ? 60 : 54}px; font-weight: 800; line-height: 1.12; }
.logo { height: 40px; margin: 34px 0 ${story ? 280 : 60}px; opacity: .9; }
</style></head><body>
<section class="slide">
  <div class="top">${hl(spec.title)}</div>
  <img class="fig" src="${src}"/>
  ${spec.lead ? `<div class="bottom">${hl(spec.lead)}</div>` : ""}
  <img class="logo" src="file://${PUB}/logo/actual/selfrace_logo_new.png"/>
</section></body></html>`;
}

// Porovnanie „bez / so SelfRace“ – vzhľad podľa prvého takého postu (13. 8. 2026):
// fotka cez celú šírku, svetlolimetková bublina s tmavým tučným textom na spodku polovice.
const BUBBLE = "#C9F070";
const COMPARE_END = path.join(ASSETS, "porovnanie_koniec.webp");

function bubbleCss() {
  return `.bub { position: absolute; left: 50%; transform: translateX(-50%); background: ${BUBBLE}; color: #0b0f05;
  font-family: 'Inter', sans-serif; font-weight: 800; font-size: 42px; line-height: 1.2; text-align: center; text-wrap: balance;
  padding: 16px 44px; max-width: 800px; width: max-content; display: flex; align-items: center; justify-content: center; }
.bub.up { bottom: 0; border-radius: 40px 40px 0 0; }
.bub.down { top: 0; border-radius: 0 0 40px 40px; }`;
}

function buildCompare(spec) {
  const panels = (spec.panels || []).slice(0, 2);
  const img = (p) => (p && p.image && fs.existsSync(p.image) ? "file://" + path.resolve(p.image) : "");
  if (spec.format === "story") return buildCompareStory(panels, img);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; }
.slide { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #000; }
.half { position: relative; width: 1080px; height: 675px; overflow: hidden; }
.half img { width: 100%; height: 100%; object-fit: cover; object-position: center 40%; display: block; }
${bubbleCss()}
</style></head><body>
<section class="slide">
  ${panels
    .map((p) => `<div class="half">${img(p) ? `<img src="${img(p)}"/>` : ""}<div class="bub up">${esc(p.caption)}</div></div>`)
    .join("")}
</section></body></html>`;
}

// 9:16 (Reels/Stories, reklamy): scény celé 3:2 (1080×720), okolo rozmazané pozadie.
// PREČO takto: Instagram má hore ~250 px a dole ~330 px svoje ovládanie a scéna má
// hlavu maskota hore – bublina cez vrch spodnej scény by zakryla tvár. Horná bublina
// preto leží na spodku hornej scény (nohy), spodná sedí nad spodnou scénou v medzere.
function buildCompareStory(panels, img) {
  const IMG_H = 720;
  const TOP1 = 170;
  const TOP2 = 1040;
  const bg = (p, top) => (img(p) ? `<img class="bg" style="top:${top}px" src="${img(p)}"/>` : "");
  const scene = (p, top) => (img(p) ? `<img class="scene" style="top:${top}px" src="${img(p)}"/>` : "");
  const [a, b] = panels;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; }
.slide { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
.bg { position: absolute; left: -60px; width: 1200px; height: 1080px; object-fit: cover; filter: blur(34px) brightness(.4); }
.scene { position: absolute; left: 0; width: 1080px; height: ${IMG_H}px; object-fit: cover; display: block; }
${bubbleCss()}
.bub.up.b1 { bottom: auto; top: ${TOP1 + IMG_H}px; transform: translate(-50%, -100%); }
.bub.up.b2 { bottom: auto; top: ${TOP2}px; transform: translate(-50%, -100%); }
</style></head><body>
<section class="slide">
  ${bg(a, -60)}${bg(b, 900)}
  ${scene(a, TOP1)}${scene(b, TOP2)}
  ${a ? `<div class="bub up b1">${esc(a.caption)}</div>` : ""}
  ${b ? `<div class="bub up b2">${esc(b.caption)}</div>` : ""}
</section></body></html>`;
}

function buildCompareEnd(spec) {
  const src = spec.figureFile && fs.existsSync(spec.figureFile) ? spec.figureFile : COMPARE_END;
  // 9:16: obrázok 4:5 v strede (od 250 px – pod ovládaním Instagramu), okolo jeho
  // rozmazaná kópia, aby nebol čierny pás.
  const story = spec.format === "story";
  const H = story ? 1920 : 1350;
  const top = story ? 250 : 0;
  // PREČO min-width a posunutý stred: v obrázku sú prázdne bubliny z pôvodného postu –
  // nová bublina ich musí celé prekryť (horná má stred na 564 px, dolná na 540 px).
  return `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; }
.slide { position: relative; width: 1080px; height: ${H}px; overflow: hidden; background: #000; }
.bg { position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px); object-fit: cover; filter: blur(30px) brightness(.45); }
.frame { position: absolute; left: 0; top: ${top}px; width: 1080px; height: 1350px; overflow: hidden; }
.frame > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
${bubbleCss()}
.bub { min-width: 666px; min-height: 130px; }
.bub.down { left: 564px; }
</style></head><body>
<section class="slide">
  ${story ? `<img class="bg" src="file://${path.resolve(src)}"/>` : ""}
  <div class="frame">
    <img src="file://${path.resolve(src)}"/>
    <div class="bub down">${esc(spec.top)}</div>
    <div class="bub up">${esc(spec.bottom)}</div>
  </div>
</section></body></html>`;
}

function build(spec) {
  if (spec.layout === "compare") return buildCompare(spec);
  if (spec.layout === "compare-end") return buildCompareEnd(spec);
  if (spec.layout === "meme") return buildMeme(spec);
  const story = spec.format === "story";
  const W = 1080;
  const H = story ? 1920 : 1350;
  // story: horná a spodná časť je pod ovládaním Instagramu – text drž v strede
  const top = story ? 250 : 64;
  const bottomSafe = story ? 330 : 54;
  const fig = figureSrc(spec, null);
  const figH = Number(spec.figureHeight) || (spec.figure === "pair" && !spec.figureFile ? (story ? 560 : 450) : story ? 720 : 560);
  const bullets = (spec.bullets || []).slice(0, 4);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; font-family: 'Inter', sans-serif; }
.slide { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; color: #fff;
  background: radial-gradient(ellipse 900px 600px at 50% 0%, #0d1406 0%, #000 70%); }
.waves { position: absolute; inset: 0; }
.glow { position: absolute; left: 140px; right: 140px; bottom: -6px; height: 14px; border-radius: 50%; background: ${LIME}; filter: blur(14px); opacity: .55; }
.hl { color: ${LIME}; }
.logo { position: absolute; top: ${top}px; left: 72px; height: 46px; }
.flow { position: absolute; top: ${top + 126}px; left: 72px; right: 72px; display: flex; flex-direction: column; align-items: flex-start; z-index: 2; }
.tag { display: inline-flex; gap: 14px; align-items: center; padding: 12px 24px 12px 18px; border: 2px solid ${LIME}; border-radius: 999px;
  font-size: 24px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${LIME}; margin-bottom: 30px; }
.title { font-size: ${story ? 92 : 88}px; font-weight: 800; letter-spacing: -.02em; line-height: 1.04; max-width: 940px; }
.lead { margin-top: 26px; font-size: 40px; line-height: 1.3; font-weight: 500; color: #f2f2f2; max-width: 920px; }
.divider { margin: 34px 0 30px; width: 180px; height: 3px; background: ${LIME}; box-shadow: 0 0 18px ${LIME}; }
.bul { list-style: none; display: flex; flex-direction: column; gap: 20px; width: ${fig ? 600 : 920}px; }
.bul li { display: flex; gap: 18px; align-items: flex-start; font-size: 33px; line-height: 1.27; font-weight: 500; }
.chk { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%; background: ${LIME}; display: flex; align-items: center; justify-content: center; }
.fig { position: absolute; right: 0; bottom: ${story ? bottomSafe - 60 : 0}px; height: ${figH}px; z-index: 1; }
.cta { position: absolute; left: 72px; bottom: ${bottomSafe + 74}px; z-index: 3; display: inline-flex; align-items: center; gap: 12px;
  padding: 18px 30px; border-radius: 999px; background: ${LIME}; color: #000; font-size: 32px; font-weight: 800; max-width: ${fig ? 600 : 936}px; }
.strava { position: absolute; left: 72px; bottom: ${bottomSafe}px; height: 30px; z-index: 3; }
</style></head><body>
<section class="slide">
  ${waves(W, H)}
  <img class="logo" src="file://${PUB}/logo/actual/selfrace_logo_new.png"/>
  <div class="flow">
    ${spec.tag ? `<div class="tag">${icon(spec.icon)}<span>${esc(spec.tag)}</span></div>` : ""}
    <h1 class="title">${hl(spec.title)}</h1>
    ${spec.lead ? `<p class="lead">${hl(spec.lead)}</p>` : ""}
    ${bullets.length ? `<div class="divider"></div><ul class="bul">${bullets
      .map((b) => `<li><span class="chk">${icon("check", 28, "#000", 3)}</span><span>${hl(b)}</span></li>`)
      .join("")}</ul>` : ""}
  </div>
  ${fig ? `<img class="fig" src="${fig}"/>` : ""}
  ${spec.cta ? `<div class="cta">${hl(spec.cta).replace(/class="hl"/g, "")}</div>` : ""}
  ${spec.strava ? `<img class="strava" src="file://${PUB}/strava/api_logo_pwrdBy_strava_horiz_white.svg"/>` : ""}
</section></body></html>`;
}

(async () => {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error("Použitie: node marketing/render/render.cjs spec.json out.png");
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const html = build(spec);
  const tmp = path.join(path.dirname(path.resolve(outPath)), `.render-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: spec.format === "story" ? 1920 : 1350 } });
    await page.goto("file://" + tmp);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.locator("section.slide").screenshot({ path: outPath });
    console.log("OK", outPath);
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
