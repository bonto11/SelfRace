// src/app/(auth)/signin/page.tsx
import { Suspense } from "react";
import SignInForm from "@/app/features/auth/components/SignInForm";

export const dynamic = "force-dynamic"; // nech sa neskúša staticky prerenderovať

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <SignInForm />
    </Suspense>
  );
}