// marketing/render/gen_scene.cjs
//
// Nová scéna s maskotmi SelfRace cez OpenAI (gpt-image) – podľa referenčných
// obrázkov z marketing/assets, s priehľadným pozadím, aby šla rovno do šablóny.
//
// Použitie (z koreňa repa):
//   node marketing/render/gen_scene.cjs --refs woman,man --prompt "beží v daždi po parku" --out /tmp/scena.png
//
// Potrebuje premennú OPENAI_API_KEY (nastavenie prostredia) a povolený
// api.openai.com. Model: OPENAI_IMAGE_MODEL (predvolene gpt-image-1).
// Pri chybe skončí s kódom 1 – volajúci vtedy použije hotového maskota.
//
// PREČO edits s referenciami: postavičky musia vyzerať stále rovnako (zelený
// smajlík, čierne tričko „selfrace“) – samotný text prompt ich zakaždým
// nakreslil inak.

const fs = require("fs");
const path = require("path");

const ASSETS = path.resolve(__dirname, "..", "assets");
const REFS = ["lift", "trail", "ocr", "woman", "man", "pair"];

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const STYLE =
  "Use the characters from the reference images exactly as they are: cartoon mascots with a round " +
  "lime-green smiley-face head (two black dot eyes, simple smile), lime-green skin, black t-shirt with " +
  "the lowercase word 'selfrace' in white, black shorts or leggings, sports shoes. Woman has a long " +
  "lime-green ponytail. Bold comic illustration style with dark outlines and soft shading, like the " +
  "references. Full body, centered, dynamic but clear pose. Transparent background, no scenery box, " +
  "no other text, no logos, no watermarks.";

(async () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("Chýba OPENAI_API_KEY – použi hotového maskota.");
    process.exit(1);
  }
  const scene = arg("prompt");
  const out = arg("out");
  const refs = String(arg("refs", "man"))
    .split(",")
    .map((s) => s.trim())
    .filter((s) => REFS.includes(s))
    .slice(0, 3);
  if (!scene || !out || !refs.length) {
    console.error('Použitie: node gen_scene.cjs --refs woman,man --prompt "scéna" --out /tmp/scena.png');
    process.exit(1);
  }

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.append("prompt", `${scene}\n\n${STYLE}`);
  form.append("size", arg("size", "1024x1536"));
  form.append("quality", arg("quality", "medium"));
  form.append("background", "transparent");
  form.append("output_format", "png");
  for (const r of refs) {
    const buf = fs.readFileSync(path.join(ASSETS, `${r}.webp`));
    form.append("image[]", new Blob([buf], { type: "image/webp" }), `${r}.webp`);
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  const b64 = json?.data?.[0]?.b64_json;
  if (!res.ok || !b64) {
    console.error("OpenAI chyba:", res.status, json?.error?.message || JSON.stringify(json).slice(0, 300));
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("OK", out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
