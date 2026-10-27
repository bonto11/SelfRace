// src/app/shared/components/session/AiPhotoAttach.tsx
"use client";

import { useRef, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { resizeImage } from "@/app/features/nutrition/utils/image";

/** Priložená fotka pripravená na odoslanie (base64 bez prefixu). */
export type AiPhoto = { data: string; media_type: string; preview: string };

export const MAX_AI_PHOTOS = 2;

/** Pre BE stačí base64 a typ – náhľad ostáva na FE. */
export function photosForApi(photos: AiPhoto[]): { data: string; media_type: string }[] {
  return photos.map(({ data, media_type }) => ({ data, media_type }));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(new Error("image_load_failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * „📷 Pridať fotku“ k otázke pre AI (graf z hodiniek, screenshot, fotka).
 * PREČO 1600 px a JPEG 0,8: na grafe musia byť čitateľné čísla a osi –
 * 1024 px ako pri jedle bolo na screenshot málo. Fotky sa na BE neukladajú.
 */
export default function AiPhotoAttach({
  value,
  onChange,
  disabled,
}: {
  value: AiPhoto[];
  onChange: (photos: AiPhoto[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(false);
    try {
      const next = [...value];
      for (const f of Array.from(files)) {
        if (next.length >= MAX_AI_PHOTOS) break;
        const blob = await resizeImage(f, 1600, 0.8);
        next.push({ data: await blobToBase64(blob), media_type: "image/jpeg", preview: URL.createObjectURL(blob) });
      }
      onChange(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(value[i].preview);
    onChange(value.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((p, i) => (
          <div key={p.preview} className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              aria-label={t("aiPhotos.remove")}
              className="absolute top-0 right-0 w-5 h-5 text-xs leading-none bg-black/70 text-white rounded-bl-md"
            >
              ×
            </button>
          </div>
        ))}
        {value.length < MAX_AI_PHOTOS ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors disabled:opacity-50"
            style={{ color: appColors.textPrimary }}
          >
            {busy ? "…" : `📷 ${t("aiPhotos.add")}`}
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void add(e.target.files)}
        />
      </div>
      <div className="text-[11px]" style={{ color: error ? appColors.statusError : appColors.textMuted }}>
        {error ? t("aiPhotos.error") : t("aiPhotos.hint")}
      </div>
    </div>
  );
}

/** „📎 2 fotky“ v bubline usera v histórii. */
export function AttachedPhotosNote({ count }: { count?: number | null }) {
  const t = useT();
  if (!count) return null;
  return (
    <div className="mt-1 text-[10px] text-emerald-300/70">
      📎 {count === 1 ? t("aiPhotos.attachedOne") : t("aiPhotos.attachedMany").replace("{{n}}", String(count))}
    </div>
  );
}
