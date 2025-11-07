"use client";

import {useEffect, useRef} from "react";

type Hit = {
  el: Element;
  reason: string;
  bbox?: DOMRect;
  scrollW?: number;
  clientW?: number;
};

function label(el: Element) {
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
  const cls = (el as HTMLElement).className
    ? "." + String((el as HTMLElement).className).trim().split(/\s+/).slice(0,3).join(".")
    : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

function chain(el: Element) {
  const parts: string[] = [];
  let cur: Element | null = el;
  let hops = 0;
  while (cur && hops < 8) {
    parts.unshift(label(cur));
    cur = cur.parentElement;
    hops++;
  }
  return parts.join(" > ");
}

function scanOnce(root: HTMLElement): Hit[] {
  const hits: Hit[] = [];
  const vw = window.innerWidth;

  // 1) globálne – element lezie mimo viewport
  const all = root.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(all)) {
    // skontroluj skutočný box vs. viewport
    const r = el.getBoundingClientRect();
    if (r.right - 0.5 > vw) {
      hits.push({ el, reason: `bbox.right ${Math.round(r.right)} > vw ${vw}`, bbox: r });
      continue;
    }

    // 2) obsah širší ako vlastný box (scrollWidth > clientWidth)
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    if (sw > cw + 1) {
      hits.push({ el, reason: `scrollWidth ${sw} > clientWidth ${cw}`, scrollW: sw, clientW: cw });
      continue;
    }
  }

  return hits;
}

export default function OverflowHunter({
  rootSelector = "main, #__next, body",
  paint = true,
  log = true,
}: {
  rootSelector?: string;
  paint?: boolean;
  log?: boolean;
}) {
  const painted = useRef<Set<Element>>(new Set());

  useEffect(() => {
    const root =
      (document.querySelector(rootSelector) as HTMLElement) || document.body;

    const mark = (els: Element[]) => {
      if (!paint) return;
      els.forEach((el) => {
        if (painted.current.has(el)) return;
        painted.current.add(el);
        (el as HTMLElement).style.outline = "2px solid #ff4d4d";
        (el as HTMLElement).style.outlineOffset = "0px";
        (el as HTMLElement).setAttribute("data-overflow-hit", "1");
      });
    };

    const run = (why: string) => {
      const hits = scanOnce(root);
      if (hits.length && log) {
        console.groupCollapsed(`OverflowHunter ➜ ${hits.length} hit(s) [${why}]`);
        for (const h of hits) {
          // eslint-disable-next-line no-console
          console.log(h.reason, h.el, "path:", chain(h.el));
        }
        console.groupEnd();
      }
      mark(hits.map((h) => h.el));
    };

    // 1) hneď po mounte
    run("mount");

    // 2) pri resizie / scroll (bez ohľadu na scroll event, je lacné)
    const onResize = () => run("resize");
    window.addEventListener("resize", onResize);

    // 3) MutationObserver – keď sa dotiahnu PB karty
    const mo = new MutationObserver(() => run("mutation"));
    mo.observe(root, { childList: true, subtree: true, attributes: true });

    // 4) ešte pár rAF cyklov po loade (layouty/obrázky/grafy)
    let ticks = 8;
    const rafTick = () => {
      run(`raf-${8 - ticks}`);
      if (--ticks > 0) requestAnimationFrame(rafTick);
    };
    requestAnimationFrame(rafTick);

    return () => {
      window.removeEventListener("resize", onResize);
      mo.disconnect();
      painted.current.forEach((el) => {
        (el as HTMLElement).style.outline = "";
        el.removeAttribute("data-overflow-hit");
      });
      painted.current.clear();
    };
  }, [rootSelector, paint, log]);

  return null;
}