// src/features/prefs/api/prefs.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export async function apiSavePushSubscription(userId: number, subscription: any) {
  
  return callBackend(`/notifications/${userId}/push-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
}

export async function apiDeletePushSubscription(userId: number, endpoint: string) {
  return callBackend(`/notifications/${userId}/push-subscription`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function apiTestPushNotification(userId: number) {
  return callBackend(`/notifications/${userId}/test-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
}
