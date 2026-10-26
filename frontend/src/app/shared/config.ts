export const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.selfrace.com";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// vlastný Google OAuth klient (prihlásenie s návratom na selfrace.com) – bez neho ide Google cez Supabase
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
export const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.selfrace.com";
export const CRON_SECRET = process.env.CRON_SECRET;
export const MAINTENANCE_API_KEY = process.env.MAINTENANCE_API_KEY;
// oznam o výpadku AI a notifikácií (OutageBanner) - "true" zapne, inak vypnuté
export const OUTAGE_BANNER = process.env.NEXT_PUBLIC_OUTAGE_BANNER === "true";
// Meta Pixel (reklamy na Instagrame/Facebooku) – bez ID sa nič nenačíta ani nezobrazí.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// Tiers max limits for AI Review versioning
export const MAX_VERSIONS_FREE = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_FREE || 1);
export const MAX_VERSIONS_CLASSIC = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_CLASSIC || 2);
export const MAX_VERSIONS_PRO = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_PRO || 3);
export const MAX_VERSIONS_FAMILY = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_FAMILY || 10);
export const MAX_COMMENT_CHARS = Number(process.env.NEXT_PUBLIC_MAX_COMMENT_CHARS || 900);