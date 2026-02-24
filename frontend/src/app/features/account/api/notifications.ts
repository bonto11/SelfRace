// src/features/prefs/api/prefs.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export async function apiSavePushSubscription(userId: number, subscription: any) {
  
  return callBackend(`/notifications/${userId}/push-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
}