"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import WidgetsEditor from "@/app/features/settings/components/WidgetsEditor";

export default function WidgetsSettingsPage() {
  const t = useT();
  return (
    <PageShell title={t("widgetCatalog.title")} showBack showPoweredByStrava={false}>
      <WidgetsEditor />
    </PageShell>
  );
}
