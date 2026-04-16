// src/app/shared/ui/components/ShowAdvancedToggle.tsx
"use client";

import React from "react";
import Toggle from "@/app/shared/ui/components/Toggle";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

interface Props {
  label?: string; // 👈 Urobíme label nepovinným
  description?: string;
}

export default function ShowAdvancedToggle({ label, description }: Props) {
  const { settings, setSettings } = useSettings();
  const t = useT();

  // Ak hodnota ešte neexistuje (init stav), bude defaultne false
  const isAdvanced = settings?.show_advanced ?? false;

  const handleChange = (checked: boolean) => {
    if (setSettings) {
      // Toto sa automaticky uloží do LS a synchronizuje do DB
      setSettings({ show_advanced: checked });
    }
  };

  // Ak nie je explicitne zadaný label, použijeme default z katalógu (alebo hardcoded fallback)
  const finalLabel = label || (t("common.showAdvanced" as any) === "common.showAdvanced" ? "Zobraziť pokročilé možnosti" : t("common.showAdvanced" as any));

  return (
    <Toggle
      label={finalLabel}
      description={description}
      checked={isAdvanced}
      onChange={handleChange}
    />
  );
}
