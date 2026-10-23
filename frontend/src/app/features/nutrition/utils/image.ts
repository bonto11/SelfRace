// src/app/features/nutrition/utils/image.ts

/**
 * Zmenší fotku na najviac `maxSide` px (dlhšia strana) a uloží ako JPEG.
 *
 * PREČO na klientovi: fotka z telefónu má 3–8 MB, AI stačí ~1024 px
 * (stovky kB) – rýchlejší upload na mobilných dátach a menej tokenov.
 * Cez <img> + canvas: prehliadače pri vykreslení otočia fotku podľa EXIF
 * a iOS pri výbere z galérie HEIC prevedie na JPEG.
 */
export async function resizeImage(file: Blob, maxSide = 1024, quality = 0.7): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_load_failed"));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("image_load_failed");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image_load_failed"))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
