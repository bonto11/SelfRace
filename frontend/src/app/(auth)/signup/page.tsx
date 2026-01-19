// src/app/(auth)/signup/page.tsx
import { Suspense } from "react";
import SignUpForm from "@/app/features/auth/components/SignUpForm";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <SignUpForm />
    </Suspense>
  );
}