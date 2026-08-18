import { NextResponse, type NextRequest } from "next/server";

import { databaseFailureState, type FstatsLoginState } from "@/lib/meta/fstats-login-state";
import { metaSelectionErrorHttpStatus } from "@/lib/meta/selection-error";
import { disconnectMetaFacebookPage, disconnectMetaLinkedInstagram, MetaPageSelectionError, selectMetaFacebookPage, selectMetaLinkedInstagram, skipMetaLinkedInstagram } from "@/lib/server/meta-connections";
import { runFacebookPageDiscovery, runLinkedInstagramDiscovery } from "@/lib/server/meta-fstats-discovery";
import { authoritativeStateHttpStatus, readAuthoritativeFstatsLoginState } from "@/lib/server/meta-fstats-state";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

type SelectionAction = "select_page" | "refresh_pages" | "connect_instagram" | "skip_instagram" | "retry_instagram_discovery" | "disconnect_instagram" | "disconnect_page";
type SelectionBody = { action?: unknown; expectedConnectionId?: unknown; pageExternalId?: unknown; instagramExternalId?: unknown };

function connectionIdFromState(state: FstatsLoginState) {
  return "connection" in state ? state.connection?.connectionId ?? null : null;
}
function pageIdFromState(state: FstatsLoginState) {
  return "page" in state ? state.page?.externalId ?? null : null;
}
function validateExpectedConnection(state: FstatsLoginState, expected: unknown) {
  const connectionId = connectionIdFromState(state);
  if (typeof expected !== "string" || !expected || !connectionId || expected !== connectionId) {
    throw new ActionError(409, "META_STATE_CHANGED", "Meta connection state changed. Refresh and try again.");
  }
  return connectionId;
}
class ActionError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const state = await readAuthoritativeFstatsLoginState(serviceClient, workspaceId);
    return NextResponse.json({ state }, { status: authoritativeStateHttpStatus(state) });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Meta connection status failed." : error instanceof Error ? error.message : "Access denied." }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SelectionBody;
    const action = body.action as SelectionAction;
    if (!["select_page", "refresh_pages", "connect_instagram", "skip_instagram", "retry_instagram_discovery", "disconnect_instagram", "disconnect_page"].includes(action)) {
      throw new ActionError(400, "INVALID_ACTION", "A supported Meta action is required.");
    }
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const before = await readAuthoritativeFstatsLoginState(serviceClient, workspaceId);
    if (authoritativeStateHttpStatus(before) !== 200) throw new ActionError(503, "META_STATE_UNAVAILABLE", "Meta connection state is temporarily unavailable.");
    const connectionId = validateExpectedConnection(before, body.expectedConnectionId);
    let operation: Record<string, unknown> = { action };

    if (action === "refresh_pages") {
      const preserveValidBindingOnFailure = before.stage === "connected"
        || before.stage === "instagram_decision_required"
        || before.stage === "page_selected_instagram_discovery"
        || (before.stage === "needs_attention" && Boolean(before.page) && before.attention.pageBindingPreserved);
      const discovery = await runFacebookPageDiscovery(serviceClient, {
        workspaceId,
        connectionId,
        preserveValidBindingOnFailure,
      });
      operation = { action, pageDiscovery: discovery.outcome, ...(discovery.outcome === "succeeded" ? { candidateCount: discovery.candidateCount } : { discoveryCode: discovery.code, retryable: discovery.retryable }) };
    } else if (action === "select_page") {
      if (typeof body.pageExternalId !== "string" || !body.pageExternalId) throw new ActionError(400, "PAGE_REQUIRED", "A stable Facebook Page ID is required.");
      const candidate = "pageCandidates" in before ? before.pageCandidates?.find((item) => item.page.externalId === body.pageExternalId) : null;
      if (!candidate?.selectable) throw new ActionError(409, "PAGE_UNAVAILABLE", "That Facebook Page is not selectable in the current state.");
      const selection = await selectMetaFacebookPage(serviceClient, { workspaceId, connectionId, externalId: body.pageExternalId });
      const discovery = await runLinkedInstagramDiscovery(serviceClient, { workspaceId, connectionId, pageExternalId: body.pageExternalId });
      operation = { action, pageBinding: "succeeded", pageChanged: selection.page_changed, instagramDiscovery: discovery.outcome, ...(discovery.outcome === "failed" ? { discoveryCode: discovery.code, retryable: discovery.retryable } : {}) };
    } else {
      const pageExternalId = pageIdFromState(before);
      if (!pageExternalId || (typeof body.pageExternalId === "string" && body.pageExternalId !== pageExternalId)) throw new ActionError(409, "PAGE_STATE_CHANGED", "Selected Facebook Page changed. Refresh and try again.");
      if (action === "disconnect_page") {
        await disconnectMetaFacebookPage(serviceClient, { workspaceId, connectionId, pageExternalId });
        operation = { action, pageBinding: "disconnected", instagramBinding: "disconnected" };
      } else if (action === "retry_instagram_discovery") {
        if (before.stage !== "needs_attention" || before.userAction.kind !== "retry_instagram_discovery") throw new ActionError(409, "RETRY_NOT_AVAILABLE", "Instagram discovery is not retryable in the current state.");
        const discovery = await runLinkedInstagramDiscovery(serviceClient, { workspaceId, connectionId, pageExternalId });
        operation = { action, instagramDiscovery: discovery.outcome, ...(discovery.outcome === "failed" ? { discoveryCode: discovery.code, retryable: discovery.retryable } : {}) };
      } else {
        const instagramIdentity = "instagram" in before && before.instagram
          ? "candidate" in before.instagram ? before.instagram.candidate : "account" in before.instagram ? before.instagram.account : null
          : null;
        if (!instagramIdentity || typeof body.instagramExternalId !== "string" || body.instagramExternalId !== instagramIdentity.externalId) throw new ActionError(409, "INSTAGRAM_STATE_CHANGED", "Linked Instagram candidate changed. Refresh and try again.");
        if (action === "connect_instagram") {
          await selectMetaLinkedInstagram(serviceClient, { workspaceId, connectionId, pageExternalId, instagramExternalId: instagramIdentity.externalId });
          operation = { action, instagramBinding: "succeeded" };
        } else if (action === "disconnect_instagram") {
          if (before.stage !== "connected" || before.instagram.status !== "connected") throw new ActionError(409, "INSTAGRAM_NOT_CONNECTED", "Instagram is not connected in the current state.");
          await disconnectMetaLinkedInstagram(serviceClient, { workspaceId, connectionId, pageExternalId, instagramExternalId: instagramIdentity.externalId });
          operation = { action, instagramBinding: "disconnected" };
        } else {
          if (before.stage !== "instagram_decision_required") throw new ActionError(409, "SKIP_NOT_AVAILABLE", "Instagram has already been decided in the current state.");
          await skipMetaLinkedInstagram(serviceClient, { workspaceId, connectionId, pageExternalId, instagramExternalId: instagramIdentity.externalId });
          operation = { action, instagramDecision: "skipped" };
        }
      }
    }
    const discoveryPersistenceFailed = operation.instagramDiscovery === "failed" && operation.discoveryCode === "database_persistence_failed";
    const state = discoveryPersistenceFailed ? databaseFailureState() : await readAuthoritativeFstatsLoginState(serviceClient, workspaceId);
    return NextResponse.json({ operation, state }, { status: action === "select_page" || discoveryPersistenceFailed ? 200 : authoritativeStateHttpStatus(state) });
  } catch (error) {
    const actionError = error instanceof ActionError ? error : null;
    const selectionError = error instanceof MetaPageSelectionError ? error : null;
    const status = error instanceof WorkspaceAccessError ? error.status : actionError?.status ?? (selectionError ? metaSelectionErrorHttpStatus(selectionError) : 500);
    return NextResponse.json({
      error: actionError?.message ?? (status === 500 ? "Meta action failed safely. Refresh before retrying." : error instanceof Error ? error.message : "Meta action failed."),
      ...(actionError?.code ? { code: actionError.code } : selectionError?.code ? { code: selectionError.code } : {}),
    }, { status });
  }
}
