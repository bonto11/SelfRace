// src/app/(auth)/signin/page.tsx
"use client";

import { Suspense } from "react";
import SignInForm from "@/app/features/auth/components/SignInForm";

import {
  AUTH_PAGE,
  AUTH_PAGE_PAD,
  AUTH_SHELL,
  AUTH_CARD,
  AUTH_CARD_STYLE,
  AUTH_TEXT,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

export const dynamic = "force-dynamic";

function AuthFallback({ text }: { text: string }) {
  return (
    <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
      <div className={AUTH_SHELL}>
        <div className={AUTH_CARD} style={AUTH_CARD_STYLE}>
          <p className={AUTH_TEXT}>{text}</p>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  const t = useT();
  return (
    <Suspense fallback={<AuthFallback text={t("common.loading")} />}>
      <SignInForm />
    </Suspense>
  );
}
