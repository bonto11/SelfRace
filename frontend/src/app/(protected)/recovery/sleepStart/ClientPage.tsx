// aby Next našiel komponent nižšie:
import dynamic from "next/dynamic";
const SleepStartDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailSleepStart"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="p-4">
      <SleepStartDetailClient />
    </div>
  );
}
