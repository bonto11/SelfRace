"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  RECOVERY_EXTRAS,
  RECOVERY_EXTRA_ICONS,
  type RecoveryExtra,
} from "@/app/features/recovery/constants/recoveryExtras";

type Props = {
  value: RecoveryExtra[];
  onChange: (next: RecoveryExtra[]) => void;
  disabled?: boolean;
};

/** Čipy „Včera som mal/a…“ – sauna, otužovanie, masáž… (viac naraz). */
export default function RecoveryExtrasPicker({ value, onChange, disabled }: Props) {
  const t = useT();
  const toggle = (k: RecoveryExtra) => {
    const has = value.includes(k);
    onChange(RECOVERY_EXTRAS.filter((x) => (x === k ? !has : value.includes(x))));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {RECOVERY_EXTRAS.map((k) => {
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(k)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold select-none transition-colors disabled:opacity-50"
            style={{
              background: on ? appColors.pillActiveBg : appColors.pillBg,
              border: `1px solid ${on ? appColors.pillActiveBorder : appColors.pillBorder}`,
              color: on ? appColors.pillActiveText : appColors.pillText,
            }}
          >
            <span aria-hidden>{RECOVERY_EXTRA_ICONS[k]}</span>
            {t(`recovery.extras.items.${k}` as any)}
          </button>
        );
      })}
    </div>
  );
}
