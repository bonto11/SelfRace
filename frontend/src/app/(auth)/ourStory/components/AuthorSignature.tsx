"use client";

import Image from "next/image";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function AuthorSignature() {
  const authorPhotoSrc = "/other/meSpartan.jpeg"; 

  return (
    <div className="mt-12 pt-8 border-t flex items-center gap-6" style={{ borderColor: appColors.divider }}>
      {/* Fotka autora */}
      <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-sm flex-shrink-0" style={{ borderColor: appColors.textPrimary}}>
         {/* Používame Next.js Image. Ak ešte nemáš fotku, tento placeholder sa možno nezobrazí správne, 
           ale akonáhle tam dáš reálnu cestu k obrázku v /public, bude to fungovať.
         */}
         <Image 
           src={authorPhotoSrc} 
           alt="Patrik - SelfRace founder"
           fill
           className="object-cover"
           // Zatiaľ použijeme šedé pozadie, kým tam nebude fotka
           style={{ backgroundColor: appColors.backgroundAlt }}
         />
      </div>

      {/* Podpis a meno */}
      <div>
        <p className="text-lg font-bold" style={{ color: appColors.textPrimary }}>
          Patrik
        </p>
        <p className="text-sm" style={{ color: appColors.textMuted }}>
          Zakladateľ SelfRace
        </p>
      </div>
    </div>
  );
}