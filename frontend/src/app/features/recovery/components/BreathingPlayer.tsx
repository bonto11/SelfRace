"use client";

/*
 * Dychové cvičenie s vedením: kruh sa nafukuje a spľasne, hlas hovorí
 * „Nádych / Zadrž / Výdych“ a telefón zavibruje na začiatku fázy.
 *
 * PREČO hlas z prehliadača (speechSynthesis) a nie nahrávky: funguje v SK/CS/EN
 * bez súborov. iPhone nepodporuje vibrácie z webu (navigator.vibrate) – tam
 * vedie len hlas a kruh, user to vidí v poznámke.
 * Obrazovka sa počas cvičenia nevypne (Wake Lock, kde ho prehliadač má).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@/app/shared/ui/components/Button";
import Switch from "@/app/shared/ui/components/Switch";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { appLang, localeTag } from "@/app/shared/i18n/locale";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { todayIsoLocal } from "@/app/shared/ui/components/StatusMark";
import {
  BREATHING_PATTERNS,
  BREATHING_MINUTES,
  breathingDoneKey,
  type BreathingPatternId,
  type BreathPhase,
} from "@/app/features/recovery/constants/breathing";

type Run = { started: number; phaseIdx: number; phaseStart: number };

// vibrácia na začiatku fázy: nádych 1×, výdych 2×, zadržanie nič (ticho = drž)
const VIBRATION: Record<BreathPhase["kind"], number[] | null> = {
  in: [70],
  hold: null,
  out: [60, 90, 60],
  holdOut: null,
};

const SCALE_SMALL = 0.55;

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const tag = localeTag(appLang());
    u.lang = tag;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(tag.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    u.rate = 0.85;
    synth.speak(u);
  } catch {
    // bez hlasu cvičenie beží ďalej – kruh a vibrácia stačia
  }
}

export default function BreathingPlayer() {
  const t = useT();
  const { ownUserId } = useUserId();

  const [patternId, setPatternId] = useState<BreathingPatternId>("calm");
  const [minutes, setMinutes] = useState<number>(5);
  const [voice, setVoice] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);
  const vibrationOk = useMemo(canVibrate, []);

  const pattern = BREATHING_PATTERNS.find((p) => p.id === patternId)!;
  const wakeLock = useRef<any>(null);
  const cueRef = useRef({ voice, vibrate });
  cueRef.current = { voice, vibrate };

  const cue = (phase: BreathPhase) => {
    const { voice: v, vibrate: vib } = cueRef.current;
    if (v) speak(t(`breathing.phases.${phase.kind === "holdOut" ? "hold" : phase.kind}` as any));
    const pat = VIBRATION[phase.kind];
    if (vib && pat && canVibrate()) navigator.vibrate(pat);
  };

  const releaseWakeLock = () => {
    try {
      wakeLock.current?.release?.();
    } catch {
      /* nič */
    }
    wakeLock.current = null;
  };

  const stop = (finished: boolean) => {
    setRun(null);
    releaseWakeLock();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* nič */
    }
    if (finished) {
      setDone(true);
      if (cueRef.current.voice) speak(t("breathing.doneVoice"));
      if (cueRef.current.vibrate && canVibrate()) navigator.vibrate([100, 80, 100, 80, 100]);
      // PREČO localStorage: ranný zápis regenerácie zajtra predvyplní „Dychové cvičenia“
      try {
        if (ownUserId) localStorage.setItem(breathingDoneKey(ownUserId), todayIsoLocal());
      } catch {
        /* bez úložiska sa len nepredvyplní */
      }
    }
  };

  const start = async () => {
    setDone(false);
    const ts = performance.now();
    setRun({ started: ts, phaseIdx: 0, phaseStart: ts });
    setNow(ts);
    // prvý pokyn ešte v kliknutí – iOS inak hlas nepustí
    cue(pattern.phases[0]);
    try {
      wakeLock.current = await (navigator as any).wakeLock?.request?.("screen");
    } catch {
      /* obrazovka sa môže vypnúť – cvičenie beží ďalej */
    }
  };

  // tik 10× za sekundu – posun fáz a koniec. PREČO ref a nie updater stavu:
  // hlas a vibrácia sú vedľajšie efekty, updater môže React spustiť dvakrát
  const runRef = useRef<Run | null>(null);
  runRef.current = run;
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => {
      const ts = performance.now();
      setNow(ts);
      const r = runRef.current;
      if (!r) return;
      const phase = pattern.phases[r.phaseIdx];
      if (ts - r.phaseStart < phase.sec * 1000) return;
      const nextIdx = (r.phaseIdx + 1) % pattern.phases.length;
      // koniec až po celom cykle (po výdychu), nie uprostred nádychu
      if (nextIdx === 0 && ts - r.started >= minutes * 60_000) {
        runRef.current = null;
        stop(true);
        return;
      }
      const next = { ...r, phaseIdx: nextIdx, phaseStart: ts };
      runRef.current = next;
      setRun(next);
      cue(pattern.phases[nextIdx]);
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.started, pattern, minutes]);

  // odchod zo stránky = stop
  useEffect(() => () => stop(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const phase = run ? pattern.phases[run.phaseIdx] : null;
  const phaseLeft = run && phase ? Math.max(0, Math.ceil(phase.sec - (now - run.phaseStart) / 1000)) : null;
  const totalLeft = run ? Math.max(0, minutes * 60 - Math.floor((now - run.started) / 1000)) : minutes * 60;
  const scale = !phase ? SCALE_SMALL : phase.kind === "in" || phase.kind === "hold" ? 1 : SCALE_SMALL;
  const phaseLabel = phase
    ? t(`breathing.phases.${phase.kind === "holdOut" ? "hold" : phase.kind}` as any)
    : done
      ? t("breathing.done")
      : t("breathing.ready");

  return (
    <div className="flex flex-col gap-5">
      {!run && (
        <>
          <div className="flex flex-col gap-2">
            <div className="text-xs" style={{ color: appColors.textMuted }}>
              {t("breathing.patternLabel")}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {BREATHING_PATTERNS.map((p) => {
                const on = p.id === patternId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatternId(p.id)}
                    className="text-left rounded-xl px-3 py-2.5 transition-colors"
                    style={{
                      background: on ? appColors.pillActiveBg : appColors.pillBg,
                      border: `1px solid ${on ? appColors.pillActiveBorder : appColors.pillBorder}`,
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                      {t(`breathing.patterns.${p.id}.title` as any)}
                      <span className="ml-2 text-xs font-normal" style={{ color: appColors.textMuted }}>
                        {p.phases.map((ph) => ph.sec).join("–")}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: appColors.textSecondary }}>
                      {t(`breathing.patterns.${p.id}.desc` as any)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs" style={{ color: appColors.textMuted }}>
              {t("breathing.minutesLabel")}
            </div>
            <div className="flex gap-2">
              {BREATHING_MINUTES.map((m) => (
                <Button key={m} size="xs" variant="prefs" active={minutes === m} onClick={() => setMinutes(m)}>
                  {`${m} min`}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-3 text-sm" style={{ color: appColors.textPrimary }}>
              {t("breathing.voice")}
              <Switch checked={voice} onChange={setVoice} ariaLabel={t("breathing.voice")} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm" style={{ color: appColors.textPrimary }}>
              {t("breathing.vibration")}
              <Switch checked={vibrate && vibrationOk} onChange={setVibrate} disabled={!vibrationOk} ariaLabel={t("breathing.vibration")} />
            </label>
            {!vibrationOk && (
              <p className="text-xs" style={{ color: appColors.textMuted }}>
                {t("breathing.noVibration")}
              </p>
            )}
          </div>
        </>
      )}

      {/* kruh */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: appColors.pillActiveBg,
              border: `2px solid ${appColors.pillActiveBorder}`,
              transform: `scale(${scale})`,
              transition: `transform ${phase && (phase.kind === "in" || phase.kind === "out") ? phase.sec : 0.6}s ease-in-out`,
            }}
          />
          <div className="relative text-center">
            <div className="text-2xl font-bold" style={{ color: appColors.textPrimary }}>
              {phaseLabel}
            </div>
            {phaseLeft != null && (
              <div className="text-4xl font-black tabular-nums mt-1" style={{ color: appColors.textPrimary }}>
                {phaseLeft}
              </div>
            )}
          </div>
        </div>
        <div className="text-sm tabular-nums" style={{ color: appColors.textMuted }}>
          {`${Math.floor(totalLeft / 60)}:${String(totalLeft % 60).padStart(2, "0")}`}
        </div>
        {done && !run && (
          <p className="text-sm text-center max-w-xs" style={{ color: appColors.textSecondary }}>
            {t("breathing.doneHint")}
          </p>
        )}
      </div>

      <div className="flex justify-center">
        {run ? (
          <Button variant="secondary" onClick={() => stop(false)}>
            {t("breathing.stop")}
          </Button>
        ) : (
          <Button variant="primary" onClick={start}>
            {t("breathing.start")}
          </Button>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: appColors.textMuted }}>
        {t("breathing.safety")}
      </p>
    </div>
  );
}
