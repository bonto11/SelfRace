// src/app/(auth)/layout.tsx
"use client";

import InfoMessageProvider from "@/shared/components/InfoMessageProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <InfoMessageProvider>
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </InfoMessageProvider>
  );
}