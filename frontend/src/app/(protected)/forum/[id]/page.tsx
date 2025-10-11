import { Suspense } from "react";
import ClientPage from "./ClientPage";

export const dynamic = "force-dynamic"; // žiadny prerender, vždy SSR

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <ClientPage id={params.id} />
    </Suspense>
  );
}
