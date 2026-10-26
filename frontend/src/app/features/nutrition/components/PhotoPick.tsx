"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { toast } from "@/app/shared/ui/components/Toast";
import { resizeImage } from "@/app/features/nutrition/utils/image";

/**
 * Fotka z fotoaparátu alebo z galérie. Fotka sa hneď zmenší
 * (max 1024 px, JPEG) – ďalej ide len zmenšená.
 * PREČO dva vstupy: `capture` na telefóne otvorí rovno fotoaparát
 * a galériu neponúkne – bez neho iOS/Android ponúknu aj výber z fotiek.
 */
export default function PhotoPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Blob | null;
  onChange: (b: Blob | null) => void;
}) {
  const t = useT();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await resizeImage(file));
    } catch {
      toast.error(t("nutrition.errors.invalid_image"));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs" style={{ color: appColors.textMuted }}>
        {label}
      </div>
      {preview ? (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image ho nepotrebuje */}
          <img src={preview} alt="" className="w-full max-h-48 object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full"
            style={{ background: appColors.panelBg, color: appColors.textPrimary }}
            aria-label={t("nutrition.photo.remove")}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { ref: cameraRef, icon: Camera, text: t("nutrition.photo.camera") },
              { ref: galleryRef, icon: ImageIcon, text: t("nutrition.photo.gallery") },
            ] as const
          ).map(({ ref, icon: Icon, text }) => (
            <button
              key={text}
              type="button"
              onClick={() => ref.current?.click()}
              className="h-24 rounded-xl flex flex-col items-center justify-center gap-1 text-sm"
              style={{
                border: `1px dashed ${appColors.editableBorder}`,
                background: appColors.editableBg,
                color: appColors.textSecondary,
              }}
            >
              <Icon size={20} />
              {text}
            </button>
          ))}
        </div>
      )}
      {[cameraRef, galleryRef].map((ref, i) => (
        <input
          key={i}
          ref={ref}
          type="file"
          accept="image/*"
          capture={ref === cameraRef ? "environment" : undefined}
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      ))}
    </div>
  );
}
