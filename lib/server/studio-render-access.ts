import type { User } from "@supabase/supabase-js";

// Proof-of-concept access is based only on the server-verified Auth user.
// Request payloads and user-editable metadata cannot grant render permission.
export function canManageStudioRenders(user: Pick<User, "email" | "email_confirmed_at">, role: string) {
  return role !== "viewer" && Boolean(user.email_confirmed_at) && user.email?.trim().toLowerCase() === "dimasounder@gmail.com";
}
