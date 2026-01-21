// src/app/(auth)/signin/page.tsx
import { Suspense } from "react";
import SignInForm from "@/app/features/auth/components/SignInForm";
import { MUTED_TEXT } from "@/app/shared/theme/uiTokens";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className={`p-6 ${MUTED_TEXT}`}>Načítavam…</div>}>
      <SignInForm />
    </Suspense>
  );
}