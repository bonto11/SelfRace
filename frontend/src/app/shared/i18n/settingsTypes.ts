export type AppLang = "sk" | "en" | "fr" | "de" | "es" | "it";

export type UserSettingsV1 = {
  units: "metric" | "imperial";
  language: AppLang;
  timezone: string;
  week_start: "Mon" | "Sun";
  date_format: "dd.mm.yyyy" | "yyyy-MM-dd";
  time_format_24h: boolean;
  onboarding_seen?: boolean;
  push_prompt_dismissed?: boolean;
  show_advanced: boolean; 
};
