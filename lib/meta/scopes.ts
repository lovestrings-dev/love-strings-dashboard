export const metaAppKinds = ["creator_social", "fstats_login"] as const;
export type MetaAppKind = (typeof metaAppKinds)[number];

export const metaConnectionKinds = [
  "fstats_login_facebook_page",
  "creator_social_instagram",
  "creator_social_threads"
] as const;
export type MetaConnectionKind = (typeof metaConnectionKinds)[number];

const metaAppKindByConnectionKind: Record<MetaConnectionKind, MetaAppKind> = {
  fstats_login_facebook_page: "fstats_login",
  creator_social_instagram: "creator_social",
  creator_social_threads: "creator_social"
};

export const requiredMetaScopes: Record<MetaConnectionKind, readonly string[]> = {
  creator_social_instagram: [
    "instagram_business_basic",
    "instagram_business_manage_insights"
  ],
  creator_social_threads: ["threads_basic", "threads_manage_insights"],
  fstats_login_facebook_page: [
    "business_management",
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
    "instagram_basic",
    "instagram_manage_insights"
  ]
};

export function isMetaAppKind(value: string): value is MetaAppKind {
  return (metaAppKinds as readonly string[]).includes(value);
}

export function isMetaConnectionKind(value: string): value is MetaConnectionKind {
  return (metaConnectionKinds as readonly string[]).includes(value);
}

export function metaAppKindForConnectionKind(connectionKind: MetaConnectionKind) {
  return metaAppKindByConnectionKind[connectionKind];
}

export function missingMetaScopes(connectionKind: MetaConnectionKind, grantedScopes: readonly string[]) {
  const granted = new Set(grantedScopes);
  return requiredMetaScopes[connectionKind].filter((scope) => !granted.has(scope));
}

export function hasRequiredMetaScopes(connectionKind: MetaConnectionKind, grantedScopes: readonly string[]) {
  return missingMetaScopes(connectionKind, grantedScopes).length === 0;
}
