import type { SupabaseClient } from "@supabase/supabase-js";

export const configurablePlatformSlugs = [
  "spotify", "apple-music", "instagram", "amazon-music", "deezer", "google-analytics"
] as const;

const qrLabels: Record<string, string> = {
  "youtube": "YouTube Channel",
  "youtube-music": "YouTube Music",
  "google-analytics": "Website",
  "spotify": "Spotify",
  "apple-music": "Apple Music",
  "instagram": "Instagram",
  "amazon-music": "Amazon Music",
  "deezer": "Deezer"
};

type ReconcileInput = {
  workspaceId: string;
  platformSlug: string;
  accountName: string;
  externalId?: string | null;
  url?: string | null;
};

export async function reconcilePlatformAccount(client: SupabaseClient, input: ReconcileInput) {
  const { data: platform, error: platformError } = await client
    .from("platforms").select("id, name").eq("slug", input.platformSlug).maybeSingle();
  if (platformError) throw platformError;
  if (!platform) throw new Error(`Platform ${input.platformSlug} is not available.`);

  let existing: { id: string; url: string | null } | null = null;
  if (input.externalId) {
    const { data, error } = await client.from("platform_accounts").select("id, url")
      .eq("workspace_id", input.workspaceId).eq("platform_id", platform.id)
      .eq("external_id", input.externalId).limit(2);
    if (error) throw error;
    if ((data ?? []).length > 1) throw new Error(`Multiple ${platform.name} accounts have the same external identity.`);
    existing = data?.[0] ?? null;
  }
  if (!existing) {
    const { data, error } = await client.from("platform_accounts").select("id, url")
      .eq("workspace_id", input.workspaceId).eq("platform_id", platform.id)
      .eq("account_name", input.accountName).limit(2);
    if (error) throw error;
    if ((data ?? []).length > 1) throw new Error(`Multiple ${platform.name} accounts need Admin resolution.`);
    existing = data?.[0] ?? null;
  }

  const url = input.url === undefined ? existing?.url ?? null : input.url || null;
  if (existing) {
    const { error } = await client.from("platform_accounts").update({
      account_name: input.accountName, external_id: input.externalId ?? null, url
    }).eq("id", existing.id).eq("workspace_id", input.workspaceId);
    if (error) throw error;
  } else {
    const { error } = await client.from("platform_accounts").insert({
      workspace_id: input.workspaceId, platform_id: platform.id, account_name: input.accountName,
      external_id: input.externalId ?? null, url
    });
    if (error) throw error;
  }
  if (url) await seedPlatformQrLink(client, input.workspaceId, input.platformSlug, url);
}

export async function saveManualPlatformUrl(client: SupabaseClient, workspaceId: string, platformSlug: string, url: string) {
  const { data: platform, error } = await client.from("platforms").select("id, name")
    .eq("slug", platformSlug).maybeSingle();
  if (error) throw error;
  if (!platform) throw new Error(`Platform ${platformSlug} is not available.`);
  const { data: rows, error: rowsError } = await client.from("platform_accounts").select("id, account_name, external_id")
    .eq("workspace_id", workspaceId).eq("platform_id", platform.id).limit(2);
  if (rowsError) throw rowsError;
  if ((rows ?? []).length > 1) throw new Error(`Multiple ${platform.name} accounts need Admin resolution before a URL can be saved.`);
  const row = rows?.[0];
  await reconcilePlatformAccount(client, {
    workspaceId, platformSlug, accountName: row?.account_name ?? platform.name,
    externalId: row?.external_id ?? null, url
  });
}

export async function seedPlatformQrLink(client: SupabaseClient, workspaceId: string, platformSlug: string, targetUrl: string) {
  const label = qrLabels[platformSlug];
  if (!label || !targetUrl) return;
  const stableKey = `platform-${platformSlug}`;
  const { data: existing, error } = await client.from("qr_links").select("stable_key")
    .eq("workspace_id", workspaceId).eq("stable_key", stableKey).maybeSingle();
  if (error) throw error;
  if (existing) return;
  const { data: last, error: positionError } = await client.from("qr_links").select("position")
    .eq("workspace_id", workspaceId).order("position", { ascending: false }).limit(1);
  if (positionError) throw positionError;
  const { error: insertError } = await client.from("qr_links").insert({
    workspace_id: workspaceId, stable_key: stableKey, name: label, target_url: targetUrl,
    qr_image_url: "", position: (last?.[0]?.position ?? 0) + 1
  });
  if (insertError && !String(insertError.message).toLowerCase().includes("duplicate")) throw insertError;
}
