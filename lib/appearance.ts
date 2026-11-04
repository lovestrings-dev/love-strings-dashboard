export type Theme = "dark" | "light";
export const defaultTheme: Theme = "dark";
export const themeCookieName = "artistdeck-theme";

export function resolveTheme(value: unknown): Theme {
  return value === "light" ? "light" : defaultTheme;
}

export function appearanceFromMetadata(metadata: Record<string, unknown> = {}) {
  return {
    theme: resolveTheme(metadata.artistdeck_theme),
    featureAcknowledged: metadata.artistdeck_dark_mode_v1_acknowledged === true
  };
}
