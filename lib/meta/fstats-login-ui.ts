import type { FstatsLoginState, FstatsLoginStateStage } from "./fstats-login-state";

export type FstatsLoginUiModel = {
  panel: FstatsLoginStateStage;
  summary: string;
};

function instagramHandle(displayName: string) {
  return displayName.startsWith("@") ? displayName : `@${displayName}`;
}

export function deriveFstatsLoginUiModel(state: FstatsLoginState): FstatsLoginUiModel {
  if (state.stage === "not_authorized") return { panel: state.stage, summary: "Meta access not connected · Facebook Page not connected" };
  if (state.stage === "page_selection_required") return { panel: state.stage, summary: "Meta access active · Facebook Page not connected" };
  if (state.stage === "needs_attention") {
    if (!state.page) return { panel: state.stage, summary: "Meta connection needs attention" };
    const instagram = state.instagram && ("account" in state.instagram ? state.instagram.account : state.instagram.candidate);
    return {
      panel: state.stage,
      summary: instagram
        ? `Facebook: ${state.page.displayName} · Instagram: ${instagramHandle(instagram.displayName)} needs attention`
        : `Facebook: ${state.page.displayName} · ${state.attention.category === "authorization" ? "Facebook access" : "Instagram"} needs attention`,
    };
  }
  if (state.stage === "page_selected_instagram_discovery") return { panel: state.stage, summary: `Facebook: ${state.page.displayName} · Instagram: checking` };
  if (state.stage === "instagram_decision_required") return { panel: state.stage, summary: `Facebook: ${state.page.displayName} · Instagram: ${instagramHandle(state.instagram.candidate.displayName)} not connected` };
  return {
    panel: state.stage,
    summary: state.instagram.status === "connected"
      ? `Facebook: ${state.page.displayName} · Instagram: ${instagramHandle(state.instagram.account.displayName)}`
      : `Facebook: ${state.page.displayName} · Instagram not connected`,
  };
}
