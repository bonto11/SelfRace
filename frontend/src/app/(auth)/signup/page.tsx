// src/app/(auth)/signup/page.tsx
import { Suspense } from "react";
import SignUpForm from "@/app/features/auth/components/SignUpForm";
import { MUTED_TEXT } from "@/app/shared/theme/uiTokens";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className={`p-6 ${MUTED_TEXT}`}>Načítavam…</div>}>
      <SignUpForm />
    </Suspense>
  );
}