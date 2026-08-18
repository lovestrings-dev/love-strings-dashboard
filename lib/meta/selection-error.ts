export class MetaPageSelectionError extends Error {
  code: string | null;

  constructor(code: string | null, message: string) {
    super(code ? `Meta Page selection failed [${code}]: ${message}` : `Meta Page selection failed: ${message}`);
    this.name = "MetaPageSelectionError";
    this.code = code;
  }
}

export function normalizeMetaPageSelectionError(error: unknown) {
  if (error instanceof Error) return error;
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const code = typeof record?.code === "string" && /^[A-Z0-9]{5}$/i.test(record.code)
    ? record.code.toUpperCase()
    : null;
  const rawMessage = typeof record?.message === "string" ? record.message : "Database rejected the Page selection.";
  const message = sanitizeMetaPageSelectionMessage(rawMessage);
  return new MetaPageSelectionError(code, message);
}

export function metaSelectionErrorHttpStatus(error: MetaPageSelectionError) {
  return error.code === "P2001" || error.code === "P2002" ? 409 : 500;
}

function sanitizeMetaPageSelectionMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 220);
  if (!normalized || /access[ _-]?token|oauth|secret|password|authorization|bearer|cookie|encryption|api[ _-]?key/i.test(normalized)) {
    return "Database rejected the Page selection.";
  }
  return normalized.replace(/\b\d{12,}\b/g, "[redacted-id]");
}
