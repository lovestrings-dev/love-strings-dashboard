import { missingMetaScopes } from "./scopes";

export const fstatsLoginStateStages = [
  "not_authorized",
  "page_selection_required",
  "page_selected_instagram_discovery",
  "instagram_decision_required",
  "connected",
  "needs_attention",
] as const;

export type FstatsLoginStateStage = (typeof fstatsLoginStateStages)[number];

export type FacebookPageIdentity = { externalId: string; displayName: string };
export type InstagramIdentity = FacebookPageIdentity & { parentPageExternalId: string };
export type FacebookPageCandidate = {
  page: FacebookPageIdentity;
  availability: "available" | "selected_here" | "bound_elsewhere";
  selectable: boolean;
};

export type FstatsLoginConnectionRef = {
  connectionId: string;
  kind: "fstats_login_facebook_page";
  authorization: "valid" | "reauthorization_required";
  updatedAt: string;
  tokenExpiresAt: string | null;
  missingScopes?: string[];
};

export type MetaAttentionCode =
  | "AMBIGUOUS_CONNECTION"
  | "MISSING_REQUIRED_SCOPES"
  | "TOKEN_EXPIRED"
  | "PAGE_DISCOVERY_FAILED"
  | "INSTAGRAM_DISCOVERY_FAILED"
  | "INSTAGRAM_DISCOVERY_STALLED"
  | "DATABASE_QUERY_FAILED"
  | "DUPLICATE_SELECTED_PAGE"
  | "DUPLICATE_INSTAGRAM_CANDIDATE"
  | "CORRUPT_PAGE_BINDING"
  | "CORRUPT_INSTAGRAM_BINDING"
  | "SELECTED_INSTAGRAM_PARENT_MISMATCH"
  | "SELECTED_PAGE_NO_LONGER_AVAILABLE"
  | "SELECTED_INSTAGRAM_NO_LONGER_LINKED";

export type MetaAttention = {
  code: MetaAttentionCode;
  category: "authorization" | "provider" | "database" | "integrity";
  message: string;
  retryable: boolean;
  pageBindingPreserved: boolean;
  instagramBindingPreserved: boolean;
};

type AuthorizedStateBase = {
  connection: FstatsLoginConnectionRef;
  pageCandidates: FacebookPageCandidate[];
};

export type FstatsLoginState =
  | { stage: "not_authorized"; userAction: { kind: "authorize" } }
  | (AuthorizedStateBase & { stage: "page_selection_required"; userAction: { kind: "select_page" } })
  | (AuthorizedStateBase & {
      stage: "page_selected_instagram_discovery";
      page: FacebookPageIdentity;
      instagram: { status: "discovery_pending"; startedAt: string };
      userAction: null;
    })
  | (AuthorizedStateBase & {
      stage: "instagram_decision_required";
      page: FacebookPageIdentity;
      instagram: { status: "available"; candidate: InstagramIdentity; discoveredAt: string };
      userAction: { kind: "choose_instagram" };
    })
  | (AuthorizedStateBase & {
      stage: "connected";
      page: FacebookPageIdentity;
      instagram:
        | { status: "not_linked"; checkedAt: string }
        | { status: "skipped"; candidate: InstagramIdentity; skippedAt: string }
        | { status: "connected"; account: InstagramIdentity };
      userAction: null;
    })
  | {
      stage: "needs_attention";
      attention: MetaAttention;
      userAction: { kind: "reauthorize" | "retry_page_discovery" | "retry_instagram_discovery" | "choose_different_page" | "contact_admin" };
      connection?: FstatsLoginConnectionRef;
      pageCandidates?: FacebookPageCandidate[];
      page?: FacebookPageIdentity;
      instagram?:
        | { status: "available" | "skipped"; candidate: InstagramIdentity }
        | { status: "connected"; account: InstagramIdentity };
    };

export type FstatsConnectionRow = {
  id: string;
  connection_kind: string;
  connection_state: string;
  granted_scopes: string[] | null;
  token_expires_at: string | null;
  last_error_code: string | null;
  last_error_summary: string | null;
  updated_at: string;
};

export type FstatsCandidateRow = {
  id: string;
  account_type: "facebook_page" | "instagram_professional";
  external_id: string;
  display_name: string;
  parent_external_id: string | null;
  asset_state: "available" | "missing" | "conflict" | "skipped";
  discovered_at: string;
  updated_at: string;
};

export type FstatsMappingRow = {
  id: string;
  account_type: "facebook_page" | "instagram_professional";
  platform_account_id: string;
  parent_platform_account_id: string | null;
  is_selected: boolean;
  asset_state: string;
  last_successful_sync_at: string | null;
  last_error_code: string | null;
  last_error_summary: string | null;
  updated_at: string;
};

export type FstatsAccountRow = { id: string; meta_external_id: string | null; account_name: string };
export type FstatsPageBindingRow = { external_id: string; workspace_id: string; connection_id: string; mapping_id: string };
export type FstatsInstagramBindingRow = FstatsPageBindingRow & { parent_page_external_id: string };

export type FstatsStateSnapshot = {
  now: string;
  workspaceId: string;
  connections: FstatsConnectionRow[];
  candidates: FstatsCandidateRow[];
  mappings: FstatsMappingRow[];
  accounts: FstatsAccountRow[];
  pageBindings: FstatsPageBindingRow[];
  instagramBindings: FstatsInstagramBindingRow[];
};

const attentionMessages: Record<MetaAttentionCode, string> = {
  AMBIGUOUS_CONNECTION: "More than one Facebook authorization exists for this workspace. Admin review is required.",
  MISSING_REQUIRED_SCOPES: "The Facebook authorization is missing required permissions.",
  TOKEN_EXPIRED: "The Facebook authorization has expired and must be renewed.",
  PAGE_DISCOVERY_FAILED: "Facebook Page discovery needs to be retried.",
  INSTAGRAM_DISCOVERY_FAILED: "The linked Instagram check failed. The Facebook Page remains selected.",
  INSTAGRAM_DISCOVERY_STALLED: "The linked Instagram check did not finish. The Facebook Page remains selected.",
  DATABASE_QUERY_FAILED: "Meta connection status is temporarily unavailable.",
  DUPLICATE_SELECTED_PAGE: "More than one selected Facebook Page mapping requires Admin review.",
  DUPLICATE_INSTAGRAM_CANDIDATE: "Multiple linked Instagram candidates require Admin review.",
  CORRUPT_PAGE_BINDING: "The selected Facebook Page binding requires Admin review.",
  CORRUPT_INSTAGRAM_BINDING: "The selected Instagram binding requires Admin review.",
  SELECTED_INSTAGRAM_PARENT_MISMATCH: "The selected Instagram account does not belong to the selected Facebook Page.",
  SELECTED_PAGE_NO_LONGER_AVAILABLE: "The selected Facebook Page is no longer available from this authorization.",
  SELECTED_INSTAGRAM_NO_LONGER_LINKED: "The previously selected Instagram account is no longer linked to this Facebook Page.",
};

export function createMetaAttention(
  code: MetaAttentionCode,
  overrides: Partial<Omit<MetaAttention, "code" | "message">> = {},
): MetaAttention {
  const authorization = code === "MISSING_REQUIRED_SCOPES" || code === "TOKEN_EXPIRED";
  const provider = code === "PAGE_DISCOVERY_FAILED" || code === "INSTAGRAM_DISCOVERY_FAILED" || code === "INSTAGRAM_DISCOVERY_STALLED";
  return {
    code,
    category: authorization ? "authorization" : provider ? "provider" : code === "DATABASE_QUERY_FAILED" ? "database" : "integrity",
    message: attentionMessages[code],
    retryable: provider || code === "DATABASE_QUERY_FAILED",
    pageBindingPreserved: false,
    instagramBindingPreserved: false,
    ...overrides,
  };
}

export function databaseFailureState(): FstatsLoginState {
  return {
    stage: "needs_attention",
    attention: createMetaAttention("DATABASE_QUERY_FAILED", { retryable: true }),
    userAction: { kind: "contact_admin" },
  };
}

export function deriveFstatsLoginState(snapshot: FstatsStateSnapshot): FstatsLoginState {
  if (!snapshot.connections.length) return { stage: "not_authorized", userAction: { kind: "authorize" } };
  if (snapshot.connections.length !== 1) {
    return { stage: "needs_attention", attention: createMetaAttention("AMBIGUOUS_CONNECTION"), userAction: { kind: "contact_admin" } };
  }

  const connectionRow = snapshot.connections[0];
  const missingScopes = missingMetaScopes("fstats_login_facebook_page", connectionRow.granted_scopes ?? []);
  const connection: FstatsLoginConnectionRef = {
    connectionId: connectionRow.id,
    kind: "fstats_login_facebook_page",
    authorization: missingScopes.length || connectionRow.connection_state === "reauthorization_required" ? "reauthorization_required" : "valid",
    updatedAt: connectionRow.updated_at,
    tokenExpiresAt: connectionRow.token_expires_at,
    ...(missingScopes.length ? { missingScopes } : {}),
  };
  if (connectionRow.connection_state === "reauthorization_required" && connectionRow.last_error_code === "meta_graph_token") {
    return { stage: "needs_attention", connection: { ...connection, authorization: "reauthorization_required" }, attention: createMetaAttention("TOKEN_EXPIRED"), userAction: { kind: "reauthorize" } };
  }
  if (missingScopes.length || connectionRow.connection_state === "reauthorization_required") {
    return { stage: "needs_attention", connection, attention: createMetaAttention("MISSING_REQUIRED_SCOPES"), userAction: { kind: "reauthorize" } };
  }
  if (connectionRow.token_expires_at && Date.parse(connectionRow.token_expires_at) <= Date.parse(snapshot.now)) {
    return { stage: "needs_attention", connection: { ...connection, authorization: "reauthorization_required" }, attention: createMetaAttention("TOKEN_EXPIRED"), userAction: { kind: "reauthorize" } };
  }

  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const pageRows = snapshot.candidates.filter((candidate) => candidate.account_type === "facebook_page");
  const duplicatePageCandidate = new Set(pageRows.map((candidate) => candidate.external_id)).size !== pageRows.length;
  if (duplicatePageCandidate) {
    return { stage: "needs_attention", connection, attention: createMetaAttention("CORRUPT_PAGE_BINDING"), userAction: { kind: "contact_admin" } };
  }
  const pageCandidates: FacebookPageCandidate[] = pageRows.map((candidate) => {
    const binding = snapshot.pageBindings.find((row) => row.external_id === candidate.external_id);
    const selectedHere = binding?.workspace_id === snapshot.workspaceId && binding.connection_id === connectionRow.id;
    const boundElsewhere = Boolean(binding && !selectedHere);
    return {
      page: { externalId: candidate.external_id, displayName: candidate.display_name },
      availability: selectedHere ? "selected_here" : boundElsewhere ? "bound_elsewhere" : "available",
      selectable: candidate.asset_state === "available" && !boundElsewhere,
    };
  });

  const selectedPages = snapshot.mappings.filter((mapping) => mapping.account_type === "facebook_page" && mapping.is_selected);
  if (selectedPages.length > 1) {
    return { stage: "needs_attention", connection, pageCandidates, attention: createMetaAttention("DUPLICATE_SELECTED_PAGE"), userAction: { kind: "contact_admin" } };
  }
  if (!selectedPages.length) {
    const orphanBinding = snapshot.pageBindings.some((binding) => binding.workspace_id === snapshot.workspaceId && binding.connection_id === connectionRow.id);
    if (orphanBinding) return { stage: "needs_attention", connection, pageCandidates, attention: createMetaAttention("CORRUPT_PAGE_BINDING"), userAction: { kind: "contact_admin" } };
    if (connectionRow.last_error_code) return { stage: "needs_attention", connection, pageCandidates, attention: createMetaAttention("PAGE_DISCOVERY_FAILED", { retryable: true }), userAction: { kind: "retry_page_discovery" } };
    return { stage: "page_selection_required", connection, pageCandidates, userAction: { kind: "select_page" } };
  }

  const selectedPageMapping = selectedPages[0];
  const selectedPageAccount = accounts.get(selectedPageMapping.platform_account_id);
  if (!selectedPageAccount?.meta_external_id) {
    return { stage: "needs_attention", connection, pageCandidates, attention: createMetaAttention("CORRUPT_PAGE_BINDING"), userAction: { kind: "contact_admin" } };
  }
  const page: FacebookPageIdentity = { externalId: selectedPageAccount.meta_external_id, displayName: selectedPageAccount.account_name };
  const pageBinding = snapshot.pageBindings.find((binding) => binding.external_id === page.externalId);
  if (!pageBinding || pageBinding.workspace_id !== snapshot.workspaceId || pageBinding.connection_id !== connectionRow.id || pageBinding.mapping_id !== selectedPageMapping.id) {
    return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("CORRUPT_PAGE_BINDING"), userAction: { kind: "contact_admin" } };
  }
  if (connectionRow.last_error_code === "selected_page_missing" || !pageRows.some((candidate) => candidate.external_id === page.externalId && candidate.asset_state !== "missing")) {
    return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("SELECTED_PAGE_NO_LONGER_AVAILABLE", { pageBindingPreserved: true }), userAction: { kind: "reauthorize" } };
  }
  if (selectedPageMapping.last_error_code) {
    if (selectedPageMapping.last_error_code === "meta_graph_token") {
      return { stage: "needs_attention", connection: { ...connection, authorization: "reauthorization_required" }, pageCandidates, page, attention: createMetaAttention("TOKEN_EXPIRED", { pageBindingPreserved: true }), userAction: { kind: "reauthorize" } };
    }
    if (selectedPageMapping.last_error_code === "meta_graph_permission") {
      return { stage: "needs_attention", connection: { ...connection, authorization: "reauthorization_required" }, pageCandidates, page, attention: createMetaAttention("MISSING_REQUIRED_SCOPES", { pageBindingPreserved: true }), userAction: { kind: "reauthorize" } };
    }
    const code = selectedPageMapping.last_error_code === "selected_linked_instagram_missing"
      ? "SELECTED_INSTAGRAM_NO_LONGER_LINKED"
      : "INSTAGRAM_DISCOVERY_FAILED";
    return {
      stage: "needs_attention",
      connection,
      pageCandidates,
      page,
      attention: createMetaAttention(code, { retryable: true, pageBindingPreserved: true }),
      userAction: { kind: "retry_instagram_discovery" },
    };
  }
  if (!selectedPageMapping.last_successful_sync_at) {
    const elapsed = Date.parse(snapshot.now) - Date.parse(selectedPageMapping.updated_at);
    if (Number.isFinite(elapsed) && elapsed > 120_000) {
      return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("INSTAGRAM_DISCOVERY_STALLED", { pageBindingPreserved: true }), userAction: { kind: "retry_instagram_discovery" } };
    }
    return {
      stage: "page_selected_instagram_discovery",
      connection,
      pageCandidates,
      page,
      instagram: { status: "discovery_pending", startedAt: selectedPageMapping.updated_at },
      userAction: null,
    };
  }

  const selectedInstagrams = snapshot.mappings.filter((mapping) => mapping.account_type === "instagram_professional" && mapping.is_selected);
  if (selectedInstagrams.length > 1) {
    return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("CORRUPT_INSTAGRAM_BINDING", { pageBindingPreserved: true }), userAction: { kind: "contact_admin" } };
  }
  const currentCandidates = snapshot.candidates.filter((candidate) =>
    candidate.account_type === "instagram_professional"
      && candidate.parent_external_id === page.externalId
      && (candidate.asset_state === "available" || candidate.asset_state === "skipped"),
  );
  if (currentCandidates.length > 1) {
    return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("DUPLICATE_INSTAGRAM_CANDIDATE", { pageBindingPreserved: true }), userAction: { kind: "contact_admin" } };
  }

  if (selectedInstagrams.length) {
    const mapping = selectedInstagrams[0];
    const account = accounts.get(mapping.platform_account_id);
    if (!account?.meta_external_id) return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("CORRUPT_INSTAGRAM_BINDING", { pageBindingPreserved: true }), userAction: { kind: "contact_admin" } };
    if (mapping.parent_platform_account_id !== selectedPageMapping.platform_account_id) {
      return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("SELECTED_INSTAGRAM_PARENT_MISMATCH", { pageBindingPreserved: true }), userAction: { kind: "contact_admin" } };
    }
    const binding = snapshot.instagramBindings.find((row) => row.external_id === account.meta_external_id);
    if (!binding || binding.workspace_id !== snapshot.workspaceId || binding.connection_id !== connectionRow.id || binding.mapping_id !== mapping.id || binding.parent_page_external_id !== page.externalId) {
      return { stage: "needs_attention", connection, pageCandidates, page, attention: createMetaAttention("CORRUPT_INSTAGRAM_BINDING", { pageBindingPreserved: true }), userAction: { kind: "contact_admin" } };
    }
    return {
      stage: "connected",
      connection,
      pageCandidates,
      page,
      instagram: { status: "connected", account: { externalId: account.meta_external_id, displayName: account.account_name, parentPageExternalId: page.externalId } },
      userAction: null,
    };
  }

  const candidate = currentCandidates[0];
  if (!candidate) {
    return { stage: "connected", connection, pageCandidates, page, instagram: { status: "not_linked", checkedAt: selectedPageMapping.last_successful_sync_at }, userAction: null };
  }
  const identity: InstagramIdentity = { externalId: candidate.external_id, displayName: candidate.display_name, parentPageExternalId: page.externalId };
  if (candidate.asset_state === "skipped") {
    return { stage: "connected", connection, pageCandidates, page, instagram: { status: "skipped", candidate: identity, skippedAt: candidate.updated_at }, userAction: null };
  }
  return {
    stage: "instagram_decision_required",
    connection,
    pageCandidates,
    page,
    instagram: { status: "available", candidate: identity, discoveredAt: candidate.discovered_at },
    userAction: { kind: "choose_instagram" },
  };
}
