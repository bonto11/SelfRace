"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  getBootPending,
  isBootDone,
  markBootDone,
  subscribeBoot,
} from "@/app/shared/state/bootLoadStore";

/*
 * Úvodný splash pri štarte appky.
 *
 * Obsah stránky sa pod ním už vykresľuje a widgety načítavajú - splash len
 * zakrýva postupné "doskakovanie" widgetov. Zmizne, keď:
 *  - je overený user a žiadny provider nečaká na dáta, ktoré ešte nemá
 *    (s dátami z cache nečaká nič -> pri ďalšom otvorení appky zmizne hneď),
 *  - alebo najneskôr po SPLASH_MAX_MS, aby pomalý BE nikdy nezablokoval appku.
 *
 * Ukáže sa len raz za načítanie appky, pri prechode medzi stránkami nie.
 */

const SPLASH_MAX_MS = 3500;
// krátka rezerva, kým widgety po zistení usera spustia svoje requesty
const SETTLE_MS = 160;
const LEAVE_MS = 420;
// nad modalmi (2147483000), pod menu (2147483600)
const SPLASH_Z = 2147483300;

function getServerPending() {
  return 0;
}

export default function AppSplash() {
  const t = useT();
  const { isChecking } = useUserId();
  const pending = useSyncExternalStore(subscribeBoot, getBootPending, getServerPending);

  const [phase, setPhase] = useState<"show" | "leave" | "gone">(() =>
    isBootDone() ? "gone" : "show",
  );

  const finish = useCallback(() => {
    markBootDone();
    setPhase((p) => (p === "show" ? "leave" : p));
  }, []);

  // poistka - splash nikdy nezostane dlhšie ako SPLASH_MAX_MS
  useEffect(() => {
    if (phase !== "show") return;
    const id = window.setTimeout(finish, SPLASH_MAX_MS);
    return () => window.clearTimeout(id);
  }, [phase, finish]);

  // user overený a nič nečaká na dáta -> preč
  useEffect(() => {
    if (phase !== "show" || isChecking || pending > 0) return;
    const id = window.setTimeout(() => {
      if (getBootPending() === 0) finish();
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [phase, isChecking, pending, finish]);

  useEffect(() => {
    if (phase !== "leave") return;
    const id = window.setTimeout(() => setPhase("gone"), LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={phase === "show"}
      aria-label={t("common.loading")}
      className={["sr-splash", phase === "leave" ? "sr-splash--leave" : ""].join(" ")}
      style={{
        zIndex: SPLASH_Z,
        background: appColors.backgroundMain,
        color: appColors.textPrimary,
      }}
    >
      <div
        aria-hidden
        className="sr-splash__glow"
        style={{
          background: `radial-gradient(circle, ${appColors.accentYellowDim} 0%, transparent 65%)`,
        }}
      />

      <div className="sr-splash__center">
        <div className="sr-splash__mark" aria-hidden>
          <span className="sr-splash__ring" style={{ borderColor: appColors.brandPrimary }} />
          <span
            className="sr-splash__ring sr-splash__ring--late"
            style={{ borderColor: appColors.brandPrimary }}
          />
          <Image
            src="/logo/actual/selfrace_icon.svg"
            alt=""
            width={88}
            height={80}
            priority
            className="sr-splash__icon"
          />
        </div>

        <Image
          src="/logo/actual/selfrace_logo.svg"
          alt="SelfRace"
          width={176}
          height={44}
          priority
          className="sr-splash__word"
        />

        <div className="sr-splash__bar" style={{ background: appColors.divider }} aria-hidden>
          <span
            style={{
              background: `linear-gradient(90deg, transparent, ${appColors.brandPrimary}, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
