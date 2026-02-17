// src/lib/config.ts
export const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;

// Tiers max limits for AI Review versioning
export const MAX_VERSIONS_FREE = process.env.NEXT_PUBLIC_MAX_VERSIONS_FREE;
export const MAX_VERSIONS_CLASSIC = process.env.NEXT_PUBLIC_MAX_VERSIONS_CLASSIC;
export const MAX_VERSIONS_PRO = process.env.NEXT_PUBLIC_MAX_VERSIONS_PRO;
export const MAX_VERSIONS_FAMILY = process.env.NEXT_PUBLIC_MAX_VERSIONS_FAMILY;
export const MAX_COMMENT_CHARS = process.env.NEXT_PUBLIC_MAX_VERSIONS_FAMILY;