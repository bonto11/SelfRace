// aby Next našiel komponent nižšie:
import dynamic from "next/dynamic";
const RHRDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailRHR"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="p-4">
      <RHRDetailClient />
    </div>
  );
}

