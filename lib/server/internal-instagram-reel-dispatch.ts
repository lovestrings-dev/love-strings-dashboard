import { timingSafeEqual } from "node:crypto";

export async function runInternalInstagramReelDispatch(input: {
  receivedSecret: string | null;
  expectedSecret: string | undefined;
  publishingEnabled: boolean;
  automaticEnabled: boolean;
  dispatch: () => Promise<unknown>;
}) {
  if (!input.expectedSecret || !safeEqual(input.receivedSecret ?? "", input.expectedSecret)) return { status: 401, body: { error: "Unauthorized dispatcher." } };
  if (!input.publishingEnabled || !input.automaticEnabled) return { status: 503, body: { error: "Automatic publishing dispatch is disabled." } };
  try { return { status: 200, body: await input.dispatch() }; }
  catch (error) { return { status: 500, body: { error: error instanceof Error ? error.message : "Dispatch failed." } }; }
}

function safeEqual(actual: string, expected: string) {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
