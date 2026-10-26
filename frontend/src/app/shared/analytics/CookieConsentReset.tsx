// src/app/shared/analytics/CookieConsentReset.tsx
"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { pixelEnabled, setConsent } from "./metaPixel";

/**
 * Odvolanie / zmena súhlasu s cookies (Ochrana súkromia). Zmaže voľbu, lišta sa
 * ukáže znova; reload, aby sa už načítaný Pixel z pamäte stránky zahodil.
 * Text ide z dokumentu v danom jazyku (ako zvyšok zásad).
 */
export default function CookieConsentReset({ label }: { label: string }) {
  if (!pixelEnabled()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setConsent(null);
        window.location.reload();
      }}
      className="underline font-semibold"
      style={{ color: appColors.brandPrimary }}
    >
      {label}
    </button>
  );
}
