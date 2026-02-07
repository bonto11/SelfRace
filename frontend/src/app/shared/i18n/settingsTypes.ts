export type AppLang = "sk" | "en" | "fr" | "de" | "es" | "it";

export type UserSettings = {
  units: "metric" | "imperial";
  language: AppLang;
  timezone: string;
  week_start: "Mon" | "Sun";
  date_format: string; // "yyyy-MM-dd"
  time_format_24h: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  units: "metric",
  language: "en",
  timezone: "Europe/Bratislava",
  week_start: "Mon",
  date_format: "yyyy-MM-dd",
  time_format_24h: true,
};