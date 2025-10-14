// aby Next našiel komponent nižšie:
import dynamic from "next/dynamic";
const HRVDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailHRV"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="p-4">
      <HRVDetailClient />
    </div>
  );
}

