
// src/app/recovery/page.tsx (alebo kde máš klientsku stránku)
"use client";
import { useRouter } from "next/navigation";
import WidgetRHR from "@/features/widgets/WidgetRHR";
import WidgetHRV from "@/features/widgets/WidgetHRV";
import WidgetSleepDuration from "@/features/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/features/widgets/WidgetSleepStart";
import RecoveryForm  from "@/features/recovery/components/Form";
export default function RecoveryPage() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
      <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
      <WidgetSleepDuration onOpenDetail={() => router.push("/recovery/sleepDuration")} />
      <WidgetSleepStart onOpenDetail={() => router.push("/recovery/sleepStart")} />
      <RecoveryForm />  
    </div>
  );
}
