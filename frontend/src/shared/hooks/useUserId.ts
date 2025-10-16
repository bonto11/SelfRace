// src/shared/hooks/useUserId.ts
"use client";
import { useAuth } from "@/features/auth/components/AuthProvider";

export function useUserId() {
  const { user } = useAuth();
  return { userId: user?.id ?? null, user };
}
