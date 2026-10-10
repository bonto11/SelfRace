// src/app/features/settings/components/WidgetsEditor.tsx
"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import Button from "@/app/shared/ui/components/Button";
import Switch from "@/app/shared/ui/components/Switch";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { ProfileOptions } from "@/app/shared/widgets/ProfileSetup";
import { useWidgetLayout } from "@/app/shared/widgets/useWidgetLayout";
import {
  WIDGETS,
  WIDGET_BY_ID,
  WIDGET_SECTIONS,
  homeOrder,
  newWidgetView,
  widgetOn,
  type WidgetId,
  type WidgetProfile,
  type WidgetView,
} from "@/app/shared/widgets/widgetCatalog";

function IconBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:cursor-default disabled:opacity-30"
      style={{
        background: active ? appColors.pillActiveBg : appColors.buttonGhostBg,
        border: `1px solid ${active ? appColors.pillActiveBorder : appColors.surfaceCardBorder}`,
        color: active ? appColors.brandPrimary : appColors.textMuted,
      }}
    >
      {children}
    </button>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={[CARD, "p-4 sm:p-5"].join(" ")} style={SURFACE_CARD_STYLE}>
      <div className="mb-3">
        <h2 className="text-base font-bold" style={{ color: appColors.textPrimary }}>
          {title}
        </h2>
        {hint ? (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: appColors.textMuted }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Výber widgetov: profil, poradie Domova a zapnutie/vypnutie jednotlivých
 * widgetov. Ukladá sa do users_preferences "ui.widgets" (store + localStorage
 * hneď, DB s malým oneskorením). Počas prezerania zverenca upravuje trénerov
 * pohľad na tohto zverenca – zverencov vlastný výber sa nemení.
 */
export default function WidgetsEditor() {
  const t = useT();
  const { trainerView } = useUserId();
  const { prefs, stored, saveView, facts, editable, isOn, sectionVisible } = useWidgetLayout();

  if (!editable) return null;

  const onSaveError = () => toast.error(t("widgetCatalog.saveFailed"));
  const update = (fn: (p: WidgetView) => WidgetView) => saveView(fn(prefs), { debounced: true, onError: onSaveError });

  const isCustomized = !!stored && (Object.keys(stored.overrides).length > 0 || stored.home != null);

  const changeProfile = async (profile: WidgetProfile) => {
    if (stored && profile === stored.profile) return;
    if (isCustomized) {
      const ok = await confirm({
        title: t("widgetCatalog.profileConfirm.title"),
        message: t("widgetCatalog.profileConfirm.message"),
        okText: t("widgetCatalog.profileConfirm.ok"),
        cancelText: t("common.cancel"),
      });
      if (!ok) return;
    }
    saveView(newWidgetView(profile), { onError: onSaveError });
  };

  const resetToProfile = async () => {
    const ok = await confirm({
      title: t("widgetCatalog.resetConfirm.title"),
      message: t("widgetCatalog.resetConfirm.message"),
      okText: t("widgetCatalog.resetConfirm.ok"),
      cancelText: t("common.cancel"),
    });
    if (ok) saveView(newWidgetView(prefs.profile), { onError: onSaveError });
  };

  // výslovná voľba sa ukladá vždy – automatické pravidlo ju už neprepíše
  const toggleOn = (id: WidgetId) =>
    update((p) => ({ ...p, overrides: { ...p.overrides, [id]: !widgetOn(p, id, facts) } }));

  const toggleHome = (id: WidgetId) =>
    update((p) => {
      const order = homeOrder(p);
      const on = widgetOn(p, id, facts);
      if (on && order.includes(id)) return { ...p, home: order.filter((x) => x !== id) };
      // pridanie na Domov zapne aj vypnutý widget
      return {
        ...p,
        home: [...order.filter((x) => x !== id), id],
        overrides: on ? p.overrides : { ...p.overrides, [id]: true },
      };
    });

  const moveHome = (id: WidgetId, dir: -1 | 1) =>
    update((p) => {
      const order = homeOrder(p);
      const visible = order.filter((x) => widgetOn(p, x, facts));
      const i = visible.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= visible.length) return p;
      [visible[i], visible[j]] = [visible[j], visible[i]];
      // vypnuté ostanú v zozname na konci – po zapnutí sa vrátia na Domov
      return { ...p, home: [...visible, ...order.filter((x) => !visible.includes(x))] };
    });

  const home = homeOrder(prefs).filter(isOn);

  return (
    <div className="space-y-3 pb-12 mt-4">
      {trainerView ? (
        <p
          className="text-sm rounded-xl px-3 py-2"
          style={{ color: appColors.textPrimary, background: appColors.pillActiveBg, border: `1px solid ${appColors.pillActiveBorder}` }}
        >
          {fmt(t("widgetCatalog.trainerViewNote"), { name: trainerView.name })}
        </p>
      ) : null}

      <Card title={t("widgetCatalog.profileTitle")} hint={t("widgetCatalog.profileHint")}>
        <ProfileOptions value={stored?.profile ?? null} onChange={changeProfile} />
      </Card>

      <Card title={t("widgetCatalog.homeTitle")} hint={t("widgetCatalog.homeHint")}>
        {home.length ? (
          <ol className="space-y-2">
            {home.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
              >
                <span className="w-5 text-xs tabular-nums" style={{ color: appColors.textMuted }}>
                  {i + 1}.
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
                  {t(WIDGET_BY_ID[id].titleKey as any)}
                </span>
                <IconBtn label={t("widgetCatalog.moveUp")} onClick={() => moveHome(id, -1)} disabled={i === 0}>
                  <ChevronUp size={16} />
                </IconBtn>
                <IconBtn
                  label={t("widgetCatalog.moveDown")}
                  onClick={() => moveHome(id, 1)}
                  disabled={i === home.length - 1}
                >
                  <ChevronDown size={16} />
                </IconBtn>
                <IconBtn label={t("widgetCatalog.removeFromHome")} onClick={() => toggleHome(id)} active>
                  <Star size={15} fill="currentColor" />
                </IconBtn>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm" style={{ color: appColors.textMuted }}>
            {t("widgetCatalog.homeEmpty")}
          </p>
        )}
      </Card>

      {WIDGET_SECTIONS.map((section) => (
        <Card
          key={section}
          title={t(`${section}.title` as any)}
          hint={sectionVisible(section) ? undefined : t("widgetCatalog.sectionHidden")}
        >
          <ul className="divide-y" style={{ borderColor: appColors.divider }}>
            {WIDGETS.filter((w) => w.section === section).map((w) => {
              const on = isOn(w.id);
              const onHome = on && home.includes(w.id);
              const title = t(w.titleKey as any);
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderColor: appColors.divider }}
                >
                  <div className="flex-1 min-w-0" style={{ opacity: on ? 1 : 0.6 }}>
                    <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                      {title}
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: appColors.textMuted }}>
                      {t(`widgetCatalog.desc.${w.id}` as any)}
                    </div>
                  </div>
                  <IconBtn
                    label={onHome ? t("widgetCatalog.removeFromHome") : t("widgetCatalog.addToHome")}
                    onClick={() => toggleHome(w.id)}
                    active={onHome}
                  >
                    <Star size={15} fill={onHome ? "currentColor" : "none"} />
                  </IconBtn>
                  <Switch checked={on} onChange={() => toggleOn(w.id)} ariaLabel={title} />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {stored ? (
        <div className="flex justify-center pt-1">
          <Button size="sm" variant="ghost" onClick={resetToProfile} disabled={!isCustomized}>
            {t("widgetCatalog.reset")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
