// src/shared/ui/classes.ts

// vrstvy pozadia – konzistentné naprieč appkou
export const BG1 = "rounded-2xl shadow-lg border border-white/10 bg-[#0b0f1a]/95 dark:bg-[#0b0f1a]/95 backdrop-blur"; // najtmavšia
export const BG2 = "rounded-2xl shadow-lg border border-white/10 bg-slate-900/80 dark:bg-slate-900/80 backdrop-blur";
export const BG3 = "rounded-2xl shadow-lg border border-white/10 bg-slate-800/70 dark:bg-slate-800/70 backdrop-blur";
export const BG4 = "rounded-2xl shadow shadow-white/5 border border-white/10 bg-slate-700/60 dark:bg-slate-700/60 backdrop-blur";

// zachovaj existujúce, ale nech volajú nové
export const CARD    = `${BG2} p-4`;
export const SUBCARD = `${BG3} p-4`;
export const PANEL   = `${BG2}`;