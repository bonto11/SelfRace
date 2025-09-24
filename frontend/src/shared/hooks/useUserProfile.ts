"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "./useUserId";

interface UserProfile {
  id: number;
  user_id: number;
  time_format: string; // "24h" | "12h"
}

export function useUserProfile() {
  const { userId, loading: userLoading } = useUserId();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
    if (userId) load();
  }, [userId]);

  return { profile, loading: userLoading || loading };
}
