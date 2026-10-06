// src/app/shared/ui/pwaStartupImages.ts
// iOS štartovacie obrázky PWA (public/pwa/splash-*.png) = prvý snímok AppSplash.
// PREČO: iOS ukazuje pri štarte len PNG presnej veľkosti displeja; bez neho
// je čierna obrazovka až do prvého vykreslenia stránky. Obrázky sa generujú
// skriptom (Playwright) - pri zmene splashu ich treba pregenerovať.
export const PWA_STARTUP_IMAGES: { url: string; media: string }[] = [
  {
    "url": "/pwa/splash-1320x2868.png",
    "media": "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1290x2796.png",
    "media": "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1260x2736.png",
    "media": "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1206x2622.png",
    "media": "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1179x2556.png",
    "media": "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1284x2778.png",
    "media": "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1170x2532.png",
    "media": "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1125x2436.png",
    "media": "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1242x2688.png",
    "media": "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-828x1792.png",
    "media": "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-1242x2208.png",
    "media": "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-750x1334.png",
    "media": "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
  },
  {
    "url": "/pwa/splash-640x1136.png",
    "media": "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
  }
];
