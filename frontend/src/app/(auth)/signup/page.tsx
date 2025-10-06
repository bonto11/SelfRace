// src/app/signup/page.tsx
import { Suspense } from "react";
import ClientPage from "./ClientPage";

export const dynamic = "force-dynamic"; // vypne prerender tejto stránky

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <ClientPage />
    </Suspense>
  );
}
