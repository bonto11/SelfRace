// src/app/update-password/page.tsx
import { Suspense } from "react";
import ClientPage from "./ClientPage";
import {
  AUTH_LOADING,
  AUTH_SHELL,
  AUTH_LOADING_CARD,
  AUTH_LOADING_CARD_STYLE,
  AUTH_LOADING_TEXT,
} from "@/app/shared/ui/tokens";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className={AUTH_LOADING}>
          <div className={AUTH_SHELL}>
            <div className={AUTH_LOADING_CARD} style={AUTH_LOADING_CARD_STYLE}>
              <p className={AUTH_LOADING_TEXT}>Načítavam…</p>
            </div>
          </div>
        </main>
      }
    >
      <ClientPage />
    </Suspense>
  );
}