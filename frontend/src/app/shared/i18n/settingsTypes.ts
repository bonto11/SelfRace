//i18n/settingsTypes
export type AppLang = "sk" | "en" | "cs" | "fr" | "de" | "es" | "it";

/** Skupiny pravidelných notifikácií - zrkadlo NOTIF_* v BE Services/notifications.py */
export type NotificationCategory =
  | "training"
  | "recovery"
  | "activities"
  | "motivation"
  // živý tréner: zdravie, recovery a žiadosti zverencov (len pre trénera)
  | "athletes";

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
  /** false = skupina vypnutá; chýbajúci kľúč = zapnutá */
  notifications?: Partial<Record<NotificationCategory, boolean>>;
};
