// src/shared/hooks/useUserUuid.ts
"use client";
import { useUserId } from "./useUserId";

export function useUserUuid() {
  const { uuid } = useUserId();
  return { uuid };
}