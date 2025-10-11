import { Suspense } from "react";
import ClientPage from "./ClientPage";

export const dynamic = "force-dynamic"; // vždy SSR, bez prerenderu

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <ClientPage />
    </Suspense>
  );
}
