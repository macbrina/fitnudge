/**
 * Supabase Client Configuration for Web
 *
 * Server-side Supabase client for API routes.
 * Uses service role key to bypass RLS when needed (e.g. blog posts with author join).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

// Client for browser-side operations (limited by RLS)
export function createBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Client for server-side operations (API routes).
// Prefers service role key to bypass RLS (required for blog posts + author join).
// Falls back to anon key if service key not set.
export function createServerClient() {
  if (!supabaseUrl) {
    return null;
  }

  const key = supabaseServiceKey || supabasePublishableKey;
  if (!key) {
    return null;
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Export a singleton for API routes
let serverClient: ReturnType<typeof createServerClient> = null;

export function getServerClient() {
  if (!serverClient) {
    serverClient = createServerClient();
  }
  return serverClient;
}
