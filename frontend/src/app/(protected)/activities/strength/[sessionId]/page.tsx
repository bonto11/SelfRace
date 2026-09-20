// src/app/(protected)/activities/strength/[sessionId]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import StrengthLogEditor from "@/app/features/activities/components/StrengthLogEditor";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  const raw = params?.sessionId;
  const sessionId = Number(Array.isArray(raw) ? raw[0] : raw);

  if (!sessionId || Number.isNaN(sessionId)) {
    return (
      <PageShell title={t("strengthLog.widget.title")} showBack showPoweredByStrava={false}>
        <div className="py-10 text-center text-sm opacity-50">
          {t("common.errors.missingUser")}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("strengthLog.widget.title")}
      showBack
      showPoweredByStrava={false}
    >
      <StrengthLogEditor
        sessionId={sessionId}
        showAdvanced={showAdvanced}
        onDeleted={() => router.push("/activities/strength")}
      />
    </PageShell>
  );
}
