// src/app/shared/ui/components/ShowAdvancedToggle.tsx
"use client";

import React from "react";
import Toggle from "@/app/shared/ui/components/Toggle";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

interface Props {
  description?: string;
}

export default function ShowAdvancedToggle({ description }: Props) {
  const { settings, setSettings } = useSettings();
  const t = useT();

  const isAdvanced = settings?.show_advanced ?? false;

  const handleChange = (checked: boolean) => {
    if (setSettings) {
      setSettings({ show_advanced: checked });
    }
  };

  return (
    <Toggle
      label={t("common.showAdvanced" as any)}
      description={description}
      checked={isAdvanced}
      onChange={handleChange}
    />
  );
}
