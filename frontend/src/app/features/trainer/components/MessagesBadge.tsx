// src/app/features/trainer/components/MessagesBadge.tsx
"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { fmt, useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { threadPath } from "@/app/features/trainer/api/sessionMessages";
import { useThreadUnread } from "@/app/features/trainer/hooks/useThreadUnread";

/**
 * Hlavička: neprečítané správy od trénera / zverencov. Bez neprečítaných sa
 * nezobrazí. Klik otvorí najnovšie vlákno – veľký kalendár na dni tréningu
 * s rozbaleným tréningom; trénerovi mimo prezerania najprv zapne zverenca.
 */
export default function MessagesBadge() {
  const t = useT();
  const router = useRouter();
  const { threads, athletes, total } = useThreadUnread();

  if (total <= 0) return null;

  const onClick = () => {
    const mine = threads[0];
    const ath = athletes[0];
    // novšia z oboch (vlastné vlákno vs. zverenec)
    if (mine && (!ath || mine.last_at >= ath.last_at)) {
      router.push(threadPath(mine));
      return;
    }
    if (ath) {
      const to = encodeURIComponent(threadPath(ath.latest));
      router.push(`/trainer/view/${ath.athlete_user_id}?to=${to}`);
    }
  };

  const label = fmt(t("trainer.thread.headerBadge"), { n: total });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative shrink-0 rounded-full p-1.5"
      style={{ color: appColors.textPrimary }}
    >
      <MessageCircle size={20} aria-hidden />
      <span
        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center tabular-nums"
        style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
      >
        {total > 9 ? "9+" : total}
      </span>
    </button>
  );
}
