"use client";

import { Suspense, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/app/shared/i18n/useT";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { startTrainerView } from "@/app/shared/state/trainerViewStore";
import { useTrainerOverview } from "@/app/features/trainer/hooks/useTrainerOverview";

/** Len interná cesta appky – nič z URL nesmie poslať trénera mimo SelfRace. */
function safePath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/coach";
  return raw;
}

/*
 * Odkaz z notifikácie trénerovi (Services/trainer_links.py, _athlete_url):
 * /trainer/view/<id>?to=/recovery – overí, že zverenca stále trénuje,
 * zapne prezeranie a otvorí danú stránku.
 */
function TrainerViewRedirect() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ athleteId: string }>();
  const search = useSearchParams();
  const { userUuid, overview, loading, trainerView } = useTrainerOverview();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || loading || !userUuid) return;
    done.current = true;

    const athleteId = Number(params?.athleteId);
    const to = safePath(search.get("to"));
    const athlete = overview?.enabled
      ? overview.athletes.find((a) => a.athlete_user_id === athleteId)
      : undefined;

    if (!athlete) {
      toast.error(t("trainer.view.notFound"));
      router.replace("/settings");
      return;
    }
    if (trainerView?.athleteId === athleteId) {
      router.replace(to);
      return;
    }
    startTrainerView(
      { athleteId, name: athlete.name || t("trainer.unnamed"), ownerUuid: userUuid },
      to,
    );
  }, [loading, userUuid, overview, trainerView, params, search, router, t]);

  return (
    <div className="flex justify-center py-16">
      <LoadingSpinner size="button" />
    </div>
  );
}

export default function TrainerViewPage() {
  return (
    // Vercel build vyžaduje Suspense pre komponenty používajúce useSearchParams()
    <Suspense fallback={null}>
      <TrainerViewRedirect />
    </Suspense>
  );
}
