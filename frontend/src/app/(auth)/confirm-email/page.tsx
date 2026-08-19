// src/app/confirm-email/page.tsx
"use client";
import { Suspense } from "react";
import ClientPage from "./ClientPage";
import {
  AUTH_LOADING,
  AUTH_SHELL,
  AUTH_LOADING_CARD,
  AUTH_LOADING_CARD_STYLE,
  AUTH_LOADING_TEXT,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export const dynamic = "force-dynamic";

export default function Page() {
  const t = useT();
  return (
    <Suspense
      fallback={
        <main className={AUTH_LOADING}>
          <div className={AUTH_SHELL}>
            <div className={AUTH_LOADING_CARD} style={AUTH_LOADING_CARD_STYLE}>
              <p className={AUTH_LOADING_TEXT}>{t("common.loading")}</p>
            </div>
          </div>
        </main>
      }
    >
      <ClientPage />
    </Suspense>
  );
}