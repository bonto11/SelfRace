// src/app/(auth)/signin/page.tsx
import { Suspense } from "react";
import SignInForm from "@/app/features/auth/components/SignInForm";

export const dynamic = "force-dynamic"; // bezpečne vypne prerender

export default function ClientPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading</div>}>
      <SignInForm />
    </Suspense>
  );
}
