// src/features/auth/components/DeleteAccountModal.tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";
import { API_URL } from "@/shared/config";

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setUserUid(data.user?.id ?? null);
      // ak máš user_id v profili, načítaj ho (alebo posielaj iba user_uid a BE si dohľadá user_id)
      // setUserId(...);
    })();
  }, []);

  async function submit() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/account/request-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, user_uid: userUid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) throw new Error(j?.detail || `HTTP ${res.status}`);
      setMsg("Account scheduled for deletion. Login within 30 days to cancel.");
      // voliteľne odhlásiť:
      await supabase.auth.signOut();
      setTimeout(() => { onClose(); window.location.href = "/auth/signin"; }, 1200);
    } catch (e: any) {
      setMsg(e.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-[420px] rounded bg-gray-900 p-4 border border-gray-700">
        <div className="text-lg font-semibold mb-2">Delete account</div>
        <p className="opacity-80 text-sm mb-3">
          Your account ({email ?? "unknown"}) will be put on hold and permanently removed
          after 30 days if you don’t log in again. This action is reversible within the 30-day window.
        </p>
        {msg && <div className="opacity-80 text-sm mb-3">{msg}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-gray-700">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-3 py-1.5 rounded bg-red-600 disabled:opacity-50">
            {loading ? "Processing…" : "Schedule deletion"}
          </button>
        </div>
      </div>
    </div>
  );
}