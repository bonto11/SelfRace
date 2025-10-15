// aby Next našiel komponent nižšie:
import dynamic from "next/dynamic";
const SleepDurationDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailSleepDuration"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="p-4">
      <SleepDurationDetailClient />
    </div>
  );
}
