// src/shared/hooks/useUserId.ts
"use client";
import { useAppUser } from "@/features/auth/components/UserIdProvider";

export function useUserId() {
  const { appUserId, loading, error } = useAppUser();
  return { userId: appUserId, loading, error };
}