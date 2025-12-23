// src/features/auth/components/DeleteAccountModal.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/shared/hooks/supabaseClient";
import { API_URL } from "@/app/shared/config";
import Button from "@/app/shared/components/ui/Button";
import { CARD, SIDEBAR_OVERLAY } from "@/app/shared/ui/classes";
import { toast } from "@/app/shared/components/ui/Toast";

export default function DeleteAccountModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null); // ak nepoužívaš, pokojne nechaj null
  const [userUid, setUserUid] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setUserUid(data.user?.id ?? null);
      // userId môžeš doplniť, ak ho držíš niekde v profile
    })();
  }, []);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/account/request-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, user_uid: userUid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success)
        throw new Error(j?.detail || `HTTP ${res.status}`);
      toast.info(
        "Account scheduled for deletion. Login within 30 days to cancel."
      );
      await supabase.auth.signOut();
      setTimeout(() => {
        onClose();
        window.location.href = "/auth/signin";
      }, 1200);
    } catch (e: any) {
      toast.error(e.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`${SIDEBAR_OVERLAY} grid place-items-center p-4`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`${CARD} w-full max-w-lg p-4`}>
        <div className="text-base md:text-lg font-semibold mb-2">
          Delete account
        </div>
        <p className="opacity-80 text-sm mb-3">
          Your account ({email ?? "unknown"}) will be put on hold and
          permanently removed after 30 days if you don’t log in again. This
          action is reversible within the 30-day window.
        </p>
        {msg && <div className="opacity-80 text-sm mb-3">{msg}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={loading}>
            {loading ? "Processing…" : "Schedule deletion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
