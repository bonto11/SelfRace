"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type Controls = { stop: () => void };

/**
 * Skener čiarového kódu cez kameru (@zxing/browser).
 * PREČO zxing: iOS Safari nemá BarcodeDetector. Knižnica sa načíta až pri
 * otvorení skenera (dynamic import) – nezaťažuje štart appky.
 * Kód sa dá zadať aj ručne (kamera zakázaná, poškodený kód).
 */
export default function BarcodeScanner({ onCode, busy }: { onCode: (code: string) => void; busy: boolean }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const doneRef = useRef(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let controls: Controls | null = null;
    let cancelled = false;
    doneRef.current = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no_camera");
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map();
        // len potravinové kódy – rýchlejšie a menej falošných čítaní
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result) => {
            if (!result || doneRef.current) return;
            doneRef.current = true;
            controls?.stop();
            onCodeRef.current(result.getText());
          },
        );
        if (cancelled) controls.stop();
      } catch (e: any) {
        if (cancelled) return;
        const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
        setCameraError(denied ? t("nutrition.scan.cameraDenied") : t("nutrition.scan.cameraError"));
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // t sa mení len so zmenou jazyka – skener sa kvôli tomu reštartovať nemusí
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitManual = () => {
    const code = manual.replace(/\D/g, "");
    if (code.length >= 6) onCode(code);
  };

  return (
    <div className="flex flex-col gap-3">
      {cameraError ? (
        <p className="text-sm rounded-xl px-3 py-2" style={{ color: appColors.statusWarning, background: appColors.accentYellowDim }}>
          {cameraError}
        </p>
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "4 / 3", background: appColors.backgroundAlt }}>
          {/* playsInline + muted: iOS inak video nespustí */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          <div
            className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[30%] rounded-lg pointer-events-none"
            style={{ border: `2px solid ${appColors.brandPrimary}` }}
          />
        </div>
      )}
      <div className="text-xs" style={{ color: appColors.textMuted }}>
        {busy ? t("nutrition.scan.searching") : t("nutrition.scan.hint")}
      </div>
      <div className="flex items-end gap-2">
        <TextField
          containerClassName="flex-1"
          label={t("nutrition.scan.manualLabel")}
          inputMode="numeric"
          value={manual}
          maxLength={14}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitManual();
          }}
        />
        <Button size="sm" leftIcon={<Search size={14} />} onClick={submitManual} disabled={busy || manual.replace(/\D/g, "").length < 6}>
          {t("nutrition.scan.find")}
        </Button>
      </div>
    </div>
  );
}
