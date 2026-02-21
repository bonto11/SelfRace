"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/app/shared/config";
import { useUserId } from "./useUserId";

interface UserProfile {
  id: number;
  user_id: number;
  time_format: string; // "24h" | "12h"
}


export function useUserProfile() {
  const { userId } = useUserId();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      try {
        const res = await fetch(`${API_URL}/users/${userId}/profile`);
        const json = await res.json();
        if (json.success) setProfile(json.data);
      } catch (err) {
        console.error("❌ useUserProfile error:", err);
      }
    }
    if (userId) load();
  }, [userId]);

  return { profile };
}
