// src/app/shared/ui/components/ShowAdvancedToggle.tsx
"use client";

import React from "react";
import Toggle from "@/app/shared/ui/components/Toggle";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

interface Props {
  description?: string;
}

export default function ShowAdvancedToggle({ description }: Props) {
  const { settings, setSettings } = useSettings();

  const isAdvanced = settings?.show_advanced ?? false;

  const handleChange = (checked: boolean) => {
    if (setSettings) {
      setSettings({ show_advanced: checked });
    }
  };

  // Názov vytiahnutý natvrdo bez t(), neskôr môžeš pridať t("common.showAdvanced")
  return (
    <Toggle
      label="Zobraziť detaily a pokročilé možnosti"
      description={description}
      checked={isAdvanced}
      onChange={handleChange}
    />
  );
}
