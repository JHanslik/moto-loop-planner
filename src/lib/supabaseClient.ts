import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present; gates all account/social features. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client, or `null` when not configured. Every consumer must
 * null-check so the app stays fully usable in "planner-only" mode.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
