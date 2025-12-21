"use client";

import { useRouter } from "next/navigation";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import WidgetRHR from "@/app/shared/components/widgets/WidgetRHR";
import WidgetHRV from "@/app/shared/components/widgets/WidgetHRV";
import WidgetSleepDuration from "@/app/shared/components/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/app/shared/components/widgets/WidgetSleepStart";
import InputsCard from "@/app/features/recovery/components/InputsCard";
import Button from "@/app/shared/components/ui/Button";
import IconRefresh from "@/app/shared/svg/Refresh";

function RefreshIconBtn() {
  const { refresh, loading } = useRecoveryData();
  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label="Refresh data"
      title="Refresh data"
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function RecoveryPage() {
  const router = useRouter();

  return (
    <>
      {/* Sticky header – konzistentný look */}
      <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="max-w-screen-lg mx-auto flex items-center gap-3">
          <h1 className="text-lg font-semibold truncate">Recovery</h1>
          <div className="ml-auto">
            <RefreshIconBtn />
          </div>
        </div>
      </div>

      {/* obsah */}
      <div className="max-w-screen-lg mx-auto px-3">
        <div className="mt-3">
          <InputsCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
          <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
          <WidgetSleepDuration
            onOpenDetail={() => router.push("/recovery/sleepDuration")}
          />
          <WidgetSleepStart
            onOpenDetail={() => router.push("/recovery/sleepStart")}
          />
        </div>
      </div>
    </>
  );
}
