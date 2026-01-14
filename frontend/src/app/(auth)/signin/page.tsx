// src/app/(auth)/signin/page.tsx
"use client";

import SignInForm from "@/app/features/auth/components/SignInForm";

export const dynamic = "force-dynamic";

export default function SigninPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </main>
  );
}