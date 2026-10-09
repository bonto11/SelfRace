// src/app/shared/widgets/ProfileSetup.tsx
"use client";

import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Footprints, HeartPulse, LayoutGrid } from "lucide-react";

import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { saveWidgetPrefs } from "@/app/shared/state/widgetPrefsStore";
import { newWidgetPrefs, type WidgetProfile } from "@/app/shared/widgets/widgetCatalog";

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const PROFILE_ICONS: Record<WidgetProfile, IconCmp> = {
  strength: Dumbbell,
  endurance: Footprints,
  health: HeartPulse,
  all: LayoutGrid,
};

/** Karty profilov – rovnaké v úvodnom výbere aj v Nastaveniach. */
export function ProfileOptions({
  value,
  onChange,
}: {
  value: WidgetProfile | null;
  onChange: (p: WidgetProfile) => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup">
      {(Object.keys(PROFILE_ICONS) as WidgetProfile[]).map((p) => {
        const Icon = PROFILE_ICONS[p];
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p)}
            className="relative flex items-start gap-3 rounded-2xl p-3.5 text-left transition-colors cursor-pointer"
            style={{
              background: active ? appColors.pillActiveBg : appColors.surfaceCard,
              border: `1.5px solid ${active ? appColors.brandPrimary : appColors.surfaceCardBorder}`,
            }}
          >
            <span
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: appColors.surfaceSolid,
                border: `1px solid ${active ? appColors.brandPrimary : appColors.surfaceCardBorder}`,
              }}
            >
              <Icon size={20} color={appColors.brandPrimary} strokeWidth={2} />
            </span>
            <span className="min-w-0 pr-5">
              <span className="block text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                {t(`widgetSetup.profiles.${p}.title` as any)}
              </span>
              <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: appColors.textMuted }}>
                {t(`widgetSetup.profiles.${p}.desc` as any)}
              </span>
            </span>
            {active ? (
              <span
                className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: appColors.brandPrimary }}
              >
                <Check size={12} strokeWidth={3} color={appColors.buttonPrimaryText} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Úvodné nastavenie pri prvom prihlásení: jedna otázka „Čo chceš robiť?“.
 *
 * PREČO namiesto 5-kapitolového návodu: nový user (hlavne nie technický)
 * dostal naraz text o PWA, notifikáciách, Strave aj trénerovi a potom
 * appku plnú VO2max, zón a pretekov. Teraz jedným ťuknutím povie, čo ho
 * zaujíma, a appka mu ukáže len to. Návod ostáva v user menu (/onboarding).
 */
export default function ProfileSetup({ userId }: { userId: number }) {
  const t = useT();
  const router = useRouter();
  const { setSettings } = useSettings();
  const [profile, setProfile] = useState<WidgetProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleContinue = () => {
    if (!profile) return;
    // voľba platí hneď (store + localStorage), DB na pozadí
    saveWidgetPrefs(userId, newWidgetPrefs(profile)).catch(() => toast.error(t("widgetCatalog.saveFailed")));
    // starý návod sa už neotvára a výzvy na notifikácie/PWA môžu prísť pri ďalšom štarte
    setSettings({ onboarding_seen: true });
    router.push("/dashboard");
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ zIndex: 2147483000, background: appColors.overlay }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-profile-setup-title"
        className="w-full max-w-lg rounded-3xl overflow-y-auto"
        style={{
          maxHeight: "calc(100dvh - 32px)",
          background: appColors.surfaceSolid,
          border: `1px solid ${appColors.panelBorder}`,
          boxShadow: appColors.shadowCard,
        }}
      >
        <div className="p-5 sm:p-7 space-y-5">
          <div>
            <h2
              id="sr-profile-setup-title"
              className="text-xl sm:text-2xl font-bold leading-tight"
              style={{ color: appColors.textPrimary }}
            >
              {t("widgetSetup.title")}
            </h2>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: appColors.textMuted }}>
              {t("widgetSetup.subtitle")}
            </p>
          </div>

          <ProfileOptions value={profile} onChange={setProfile} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs" style={{ color: appColors.textMuted }}>
              {t("widgetSetup.changeLater")}
            </p>
            <Button variant="primary" size="md" disabled={!profile} onClick={handleContinue}>
              {t("widgetSetup.continue")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
