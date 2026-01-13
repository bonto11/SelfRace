// src/app/features/strava/utils/links.ts

export function getStravaActivityUrl(
  activityId: number | string,
): string {
  return `https://www.strava.com/activities/${encodeURIComponent(
    String(activityId),
  )}`;
}