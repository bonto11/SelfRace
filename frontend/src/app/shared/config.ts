export const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.selfrace.com";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZ3Bwc2NoZ3pzaHF3Zm1rbmd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk2OTIyMiwiZXhwIjoyMDg1NTQ1MjIyfQ.B8eNa8rFyr9mKfbx1UfyIUK14V9jwprnB27_e41qg0w
export const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.selfrace.com";
export const CRON_SECRET = process.env.CRON_SECRET;
export const MAINTENANCE_API_KEY = process.env.MAINTENANCE_API_KEY;

// Tiers max limits for AI Review versioning
export const MAX_VERSIONS_FREE = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_FREE || 1);
export const MAX_VERSIONS_CLASSIC = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_CLASSIC || 2);
export const MAX_VERSIONS_PRO = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_PRO || 3);
export const MAX_VERSIONS_FAMILY = Number(process.env.NEXT_PUBLIC_MAX_VERSIONS_FAMILY || 10);
export const MAX_COMMENT_CHARS = Number(process.env.NEXT_PUBLIC_MAX_COMMENT_CHARS || 900);