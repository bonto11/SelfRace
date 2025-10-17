// src/shared/hooks/useUserId.ts
"use client";

export function useUserId() {
  const match = document.cookie.match(/(?:^|;\s*)sr_id=([^;]+)/);
  const userId = match ? Number(decodeURIComponent(match[1])) : null;
  return { userId };
}