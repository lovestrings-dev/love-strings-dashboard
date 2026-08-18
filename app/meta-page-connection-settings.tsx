"use client";

import { Link as LinkIcon, Pencil, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cleanConsumedFstatsLoginContinuation, hasFstatsLoginContinuation } from "@/lib/meta/fstats-login-continuation";
import type { FstatsLoginState, InstagramIdentity } from "@/lib/meta/fstats-login-state";
import { deriveFstatsLoginUiModel } from "@/lib/meta/fstats-login-ui";

type RequestState = "idle" | "loading" | "error";
type MetaAction = "select_page" | "refresh_pages" | "connect_instagram" | "skip_instagram" | "retry_instagram_discovery" | "disconnect_instagram" | "disconnect_page";

const manageFacebookAccessUrl = "https://www.facebook.com/settings?tab=business_tools";

function instagramIdentity(state: FstatsLoginState): InstagramIdentity | null {
  if (!("instagram" in state) || !state.instagram) return null;
  if ("candidate" in state.instagram) return state.instagram.candidate;
  if ("account" in state.instagram) return state.instagram.account;
  return null;
}

function instagramHandle(identity: InstagramIdentity) {
  return identity.displayName.startsWith("@") ? identity.displayName : `@${identity.displayName}`;
}

export function MetaPageConnectionSettings() {
  const [data, setData] = useState<FstatsLoginState | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [armedAction, setArmedAction] = useState<"disconnect_instagram" | "disconnect_page" | null>(null);
  const [hasMetaContinuation, setHasMetaContinuation] = useState(
    () => typeof window !== "undefined" && hasFstatsLoginContinuation(window.location.href),
  );
  const sectionRef = useRef<HTMLElement>(null);
  const metaContinuationConsumed = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setRequestState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/integrations/meta/fstats-login/selection", { cache: "no-store" });
      const body = await response.json();
      if (!body.state) throw new Error(body.error ?? "Meta connection status failed.");
      if (version === requestVersion.current) {
        setData(body.state);
        setRequestState("idle");
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setMessage(error instanceof Error ? error.message : "Meta connection status failed.");
        setRequestState("error");
      }
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => {
    if (!hasMetaContinuation) return;
    queueMicrotask(() => setIsOpen(true));
  }, [hasMetaContinuation]);
  useEffect(() => {
    if (!hasMetaContinuation || metaContinuationConsumed.current || !data || !isOpen || requestState === "loading") return;
    const frame = window.requestAnimationFrame(() => {
      const section = sectionRef.current;
      if (!section || metaContinuationConsumed.current) return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: "smooth", block: "center" });
      metaContinuationConsumed.current = true;
      window.history.replaceState(
        window.history.state,
        "",
        cleanConsumedFstatsLoginContinuation(window.location.href),
      );
      setHasMetaContinuation(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data, hasMetaContinuation, isOpen, requestState]);

  async function performAction(action: MetaAction, details: Record<string, string> = {}) {
    if (!data || !("connection" in data) || !data.connection) return;
    setRequestState("loading");
    setMessage("");
    setArmedAction(null);
    try {
      const response = await fetch("/api/integrations/meta/fstats-login/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, expectedConnectionId: data.connection.connectionId, ...details }),
      });
      const body = await response.json();
      if (!response.ok || !body.state) throw new Error(body.error ?? "Meta action failed.");
      setData(body.state);
      setRequestState("idle");
      setMessage(action === "disconnect_instagram" ? "Instagram disconnected. Facebook remains connected."
        : action === "disconnect_page" ? "Facebook Page disconnected. Meta authorization was preserved."
          : action === "connect_instagram" ? "Instagram connected."
            : action === "skip_instagram" ? "Instagram skipped. You can connect it later."
              : action === "refresh_pages" ? body.operation?.pageDiscovery === "failed" ? "Available Pages could not be refreshed." : "Available Facebook Pages refreshed."
                : action === "select_page" ? body.operation?.instagramDiscovery === "failed" ? "Facebook Page connected. Retry the Instagram check." : "Facebook Page connected."
                  : body.operation?.instagramDiscovery === "failed" ? "Instagram check needs another retry." : "Instagram check completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Meta action failed.");
      setRequestState("error");
    }
  }

  function authorizeFacebook() {
    window.location.assign("/api/integrations/meta/fstats-login/connect?return=/?settings=general");
  }

  function confirmDisconnect(action: "disconnect_instagram" | "disconnect_page", details: Record<string, string>) {
    if (armedAction !== action) {
      setArmedAction(action);
      return;
    }
    void performAction(action, details);
  }

  const summary = data ? deriveFstatsLoginUiModel(data).summary : "Checking Meta connection…";
  const busy = requestState === "loading";
  const currentInstagram = data ? instagramIdentity(data) : null;
  return (
    <article className="general-settings-card settings-provider-card meta-settings-card" ref={sectionRef} tabIndex={-1}>
      <div className="settings-disclosure">
        <div><h3>Meta</h3><p>{summary}</p></div>
        <button aria-expanded={isOpen} aria-label="Edit Meta connection" className="settings-icon-button" onClick={() => setIsOpen((value) => !value)} type="button"><Pencil aria-hidden size={16} /></button>
      </div>
      {!isOpen ? null : <div className="meta-onboarding-panel">
        {!data ? <div className="meta-loading-state" role="status">Checking Meta connection…</div> : null}

        {data?.stage === "not_authorized" || (data && "connection" in data && data.connection) ? <MetaAuthorizationRow
          busy={busy}
          connected={data.stage !== "not_authorized" && data.connection?.authorization === "valid"}
          onReconnect={authorizeFacebook}
        /> : null}

        {data?.stage === "not_authorized" ? <div className="google-service-row">
          <div><strong>Facebook Page</strong><span>Not connected</span><small>Reconnect Facebook access before choosing a Page for this workspace.</small></div>
        </div> : null}

        {data?.stage === "page_selection_required" ? <>
          <div className="meta-info-state"><strong>Meta authorization is still active.</strong><span>Choose a Facebook Page for this workspace.</span></div>
          <div className="meta-page-choices"><h4>Facebook Pages</h4>{data.pageCandidates.length ? data.pageCandidates.map((candidate) => <div className="google-service-row" key={candidate.page.externalId}>
            <div><strong>{candidate.page.displayName}</strong><span>{candidate.availability === "bound_elsewhere" ? "Already connected to another workspace" : "Available to this workspace"}</span><small className="meta-diagnostic-id">Meta Page ID {candidate.page.externalId}</small></div>
            <button disabled={busy || !candidate.selectable} onClick={() => void performAction("select_page", { pageExternalId: candidate.page.externalId })} type="button">Connect this Page</button>
          </div>) : <p className="settings-description">No Facebook Pages are currently available to this authorization.</p>}</div>
        </> : null}

        {data?.stage === "page_selected_instagram_discovery" ? <>
          <FacebookConnectedRow busy={busy} armed={armedAction === "disconnect_page"} name={data.page.displayName} onDisconnect={() => confirmDisconnect("disconnect_page", { pageExternalId: data.page.externalId })} />
          <div className="google-service-row"><div><strong>Instagram</strong><span>Checking for a linked Instagram account…</span></div><RefreshCw aria-hidden className="meta-loading-icon" size={18} /></div>
        </> : null}

        {data?.stage === "instagram_decision_required" ? <>
          <FacebookConnectedRow busy={busy} armed={armedAction === "disconnect_page"} name={data.page.displayName} onDisconnect={() => confirmDisconnect("disconnect_page", { pageExternalId: data.page.externalId })} />
          <div className="google-service-row"><div><strong>Instagram</strong><span className="meta-account-identity">{instagramHandle(data.instagram.candidate)}</span><span>Not connected</span><small>Skip means not now. You can connect this account later.</small></div><div className="meta-row-actions"><button disabled={busy} onClick={() => void performAction("connect_instagram", { pageExternalId: data.page.externalId, instagramExternalId: data.instagram.candidate.externalId })} type="button">Connect Instagram</button><button className="meta-secondary-button" disabled={busy} onClick={() => void performAction("skip_instagram", { pageExternalId: data.page.externalId, instagramExternalId: data.instagram.candidate.externalId })} type="button">Skip</button></div></div>
        </> : null}

        {data?.stage === "connected" ? <>
          <FacebookConnectedRow busy={busy} armed={armedAction === "disconnect_page"} name={data.page.displayName} onDisconnect={() => confirmDisconnect("disconnect_page", { pageExternalId: data.page.externalId })} />
          {data.instagram.status === "connected" && currentInstagram ? <div className="google-service-row"><div><strong>Instagram</strong><span className="meta-account-identity">{instagramHandle(currentInstagram)}</span><span>Connected</span><small>Disconnects Instagram from this workspace only. Facebook stays connected.</small></div><button className={`settings-destructive-button${armedAction === "disconnect_instagram" ? " is-armed" : ""}`} disabled={busy} onClick={() => confirmDisconnect("disconnect_instagram", { pageExternalId: data.page.externalId, instagramExternalId: currentInstagram.externalId })} type="button">{armedAction === "disconnect_instagram" ? "Confirm disconnect" : "Disconnect Instagram"}</button></div>
            : data.instagram.status === "skipped" && currentInstagram ? <div className="google-service-row"><div><strong>Instagram</strong><span className="meta-account-identity">{instagramHandle(currentInstagram)}</span><span>Not connected</span><small>Previously skipped. You can connect this account whenever you are ready.</small></div><button disabled={busy} onClick={() => void performAction("connect_instagram", { pageExternalId: data.page.externalId, instagramExternalId: currentInstagram.externalId })} type="button">Connect Instagram</button></div>
              : <div className="google-service-row"><div><strong>Instagram</strong><span>No linked professional account found</span></div></div>}
        </> : null}

        {data?.stage === "needs_attention" ? <>
          {data.page ? <FacebookConnectedRow busy={busy} armed={armedAction === "disconnect_page"} name={data.page.displayName} onDisconnect={() => confirmDisconnect("disconnect_page", { pageExternalId: data.page!.externalId })} /> : null}
          <div className="meta-attention-state" role="alert"><strong>Meta connection needs attention</strong><span>{data.attention.message}</span></div>
          <div className="meta-attention-actions">
            {data.userAction.kind === "retry_instagram_discovery" && data.connection && data.page ? <button disabled={busy} onClick={() => void performAction("retry_instagram_discovery", { pageExternalId: data.page!.externalId })} type="button">Retry Instagram check</button> : null}
          </div>
        </> : null}

        {data && "connection" in data && data.connection ? <MetaPageAccessActions
          busy={busy}
          onRefresh={data.connection.authorization === "valid" ? () => void performAction("refresh_pages") : undefined}
        /> : null}

        {message ? <p className={requestState === "error" ? "settings-error" : "settings-status"} role={requestState === "error" ? "alert" : "status"}>{message}</p> : null}
      </div>}
    </article>
  );
}

function FacebookConnectedRow({ armed, busy, name, onDisconnect }: { armed: boolean; busy: boolean; name: string; onDisconnect: () => void }) {
  return <div className="google-service-row"><div><strong>Facebook</strong><span className="meta-account-identity">{name}</span><span>Connected</span><small>Disconnects this Page and its Instagram selection from this workspace. Meta authorization stays active.</small></div><button className={`settings-destructive-button${armed ? " is-armed" : ""}`} disabled={busy} onClick={onDisconnect} type="button">{armed ? "Confirm disconnect" : "Disconnect Facebook Page"}</button></div>;
}

function MetaAuthorizationRow({ busy, connected, onReconnect }: { busy: boolean; connected: boolean; onReconnect: () => void }) {
  return <div className="google-service-row meta-authorization-row"><div><strong>Meta authorization</strong><span>{connected ? "Facebook access is active for Love Strings Dashboard." : "Facebook access is missing or needs to be restored."}</span></div><button disabled={busy} onClick={onReconnect} type="button"><LinkIcon aria-hidden size={16} />Reconnect Facebook access</button></div>;
}

function MetaPageAccessActions({ busy, onRefresh }: { busy: boolean; onRefresh?: () => void }) {
  return <div className="meta-access-helper">
    <h4>Need a different Page?</h4>
    <p><strong>Manage Facebook access</strong> opens Facebook Business Integrations so you can change which Pages Love Strings Dashboard may access. <strong>Refresh available Pages</strong> stays in Love Strings Dashboard and updates the candidate list from that authorized access.</p>
    <div className="meta-access-actions">
      <a href={manageFacebookAccessUrl} rel="noreferrer" target="_blank">Manage Facebook access</a>
      {onRefresh ? <button className="meta-secondary-button" disabled={busy} onClick={onRefresh} type="button"><RefreshCw aria-hidden size={15} />Refresh available Pages</button> : null}
    </div>
  </div>;
}
