"use client";

/* ---------- Types & Opts ---------- */

export const SPORT_SELECT_OPTIONS = (t: any) => [
  { value: "all", label: t("common.sports.all") },
  { value: "run", label: t("common.sports.run") },
  { value: "ride", label: t("common.sports.ride") },
  { value: "strength", label: t("common.sports.strength") },
  { value: "mixed", label: t("common.sports.mixed") },
  { value: "skate", label: t("common.sports.skate") },
  { value: "other", label: t("common.sports.other") },
];



export const WEEK_OPTIONS = (t: any) => [
  { value: "2", label: `2 ${t("common.weeksSelect.count2to4")}` },
  { value: "4", label: `4 ${t("common.weeksSelect.count2to4")}` },
  { value: "8", label: `8 ${t("common.weeksSelect.count5plus")}` },
  { value: "12", label: `12 ${t("common.weeksSelect.count5plus")}` },
];