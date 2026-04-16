// src/app/shared/ui/components/ShowAdvancedToggle.tsx
"use client";

import React from "react";
import Toggle from "@/app/shared/ui/components/Toggle";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

interface Props {
  label: string;
  description?: string;
}

export default function ShowAdvancedToggle({ label, description }: Props) {
  // Predpokladám, že tvoj SettingsProvider vracia objekt 'settings' a funkciu 'updateSettings'
  const { settings, updateSettings } = useSettings() as any;

  // Ak hodnota ešte neexistuje (init stav), bude false
  const isAdvanced = settings?.show_advanced ?? false;

  const handleChange = (checked: boolean) => {
    if (updateSettings) {
      // Tu voláš tvoju existujúcu funkciu na update, ktorá to uloží do LS a syncne do DB
      updateSettings({ show_advanced: checked });
    }
  };

  return (
    <Toggle
      label={label}
      description={description}
      checked={isAdvanced}
      onChange={handleChange}
    />
  );
}
