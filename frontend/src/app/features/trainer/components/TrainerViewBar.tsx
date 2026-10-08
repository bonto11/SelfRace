// src/app/features/trainer/components/TrainerViewBar.tsx
"use client";

import { useEffect } from "react";
import { Eye, X } from "lucide-react";

import { fmt, useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { endTrainerView, type TrainerView } from "@/app/shared/state/trainerViewStore";
import { apiTrainerOverview } from "@/app/features/trainer/api/trainer";

type Props = {
  view: TrainerView;
  /** vlastný účet trénera – overview sa číta za neho, nie za zverenca */
  ownUserId: number | null;
};

/**
 * Hlavička počas prezerania zverenca (namiesto loga): meno + návrat k sebe.
 * Pri štarte overí, že spolupráca stále beží – ak ju atlét medzitým ukončil,
 * režim sa sám vypne (RLS by aj tak nič nevrátila, ale appka by ostala
 * v prázdnom cudzom profile).
 */
export default function TrainerViewBar({ view, ownUserId }: Props) {
  const t = useT();

  useEffect(() => {
    if (!ownUserId) return;
    let alive = true;
    apiTrainerOverview(ownUserId).then((ov) => {
      // null = chyba siete/BE – režim nechávame, overí sa pri ďalšom štarte
      if (!alive || !ov) return;
      const stillActive =
        ov.enabled && ov.athletes.some((a) => a.athlete_user_id === view.athleteId);
      if (!stillActive) endTrainerView();
    });
    return () => {
      alive = false;
    };
  }, [ownUserId, view.athleteId]);

  const name = view.name || t("trainer.unnamed");

  return (
    <div
      className="flex items-center gap-2 min-w-0 rounded-full pl-3 pr-1 py-1"
      style={{
        border: `1px solid ${appColors.statusWarning}`,
        color: appColors.statusWarning,
      }}
      title={fmt(t("trainer.view.viewing"), { name })}
    >
      <Eye size={16} className="shrink-0" aria-hidden />
      <span className="text-sm font-semibold truncate min-w-0">{name}</span>
      <button
        type="button"
        onClick={() => endTrainerView()}
        className="shrink-0 rounded-full p-1"
        aria-label={t("trainer.view.exit")}
        title={t("trainer.view.exit")}
        style={{ color: appColors.textPrimary }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
