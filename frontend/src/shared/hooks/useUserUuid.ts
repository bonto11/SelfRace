// src/shared/hooks/useUserUuid.ts
"use client";

export function useUserUuid() {
  const match = document.cookie.match(/(?:^|;\s*)sr_uuid=([^;]+)/);
  const uuid = match ? decodeURIComponent(match[1]) : null;
  return { uuid };
}
