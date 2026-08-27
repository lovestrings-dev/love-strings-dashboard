import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createUntypedBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

let browserSupabaseClient: ReturnType<typeof createUntypedBrowserSupabaseClient> | null =
  null;
let callbackBrowserSupabaseClient: ReturnType<typeof createUntypedBrowserSupabaseClient> | null =
  null;

export function createBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  browserSupabaseClient ??= createUntypedBrowserSupabaseClient();

  return browserSupabaseClient;
}

// Auth callback pages establish the session explicitly after validating the
// callback payload. Leaving automatic URL detection enabled there can consume
// an implicit recovery hash before the page has classified it as recovery.
export function createBrowserSupabaseCallbackClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  callbackBrowserSupabaseClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: { detectSessionInUrl: false },
  });

  return callbackBrowserSupabaseClient;
}
