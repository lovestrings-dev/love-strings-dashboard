import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

type BudgetSourceBucket = "events" | "production" | "marketing" | "other";
type BudgetLine = { id: string; amount: number; bucket?: BudgetSourceBucket; description: string };
type EventEntry = { id: string; dbId?: string; date: string; time?: string; name: string; nameUrl: string; locationName: string; locationUrl: string; address: string; addressUrl: string; locationId?: string; posterUrl?: string; budgetLines?: BudgetLine[] };
type Location = { id: string; dbId?: string; locationName: string; locationUrl: string; address: string; addressUrl: string; contactName: string; contactPhone: string; contactNotes: string };
type EventRow = { id: string; stable_key: string; event_date: string; event_time: string | null; event_name: string; event_url: string; poster_url: string | null; location_id: string | null; location_name: string; location_url: string; address: string; address_url: string };
type LocationRow = { id: string; stable_key: string; location_name: string; location_url: string; address: string; address_url: string; contact_name: string; contact_phone: string; contact_notes: string };
type BudgetRow = { id: string; event_id: string; description: string; amount: number | string; budget_bucket: BudgetSourceBucket | null; position: number };
type Mutation =
  | { operation: "upsert-event"; entry: EventEntry }
  | { operation: "delete-event"; id: string }
  | { operation: "upsert-location"; location: Location }
  | { operation: "delete-location"; id: string }
  | { operation: "clear-events"; intent: "clear-events" };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    return noStore({ ...(await loadEventsSnapshot(workspaceId)), status: "ok" });
  } catch (error) {
    return noStore({ error: getErrorMessage(error, "Events load failed.") }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedWrite(request)) return noStore({ error: "Unauthorized." }, 401);
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const mutation = (await request.json()) as Mutation;
    const result = await applyMutation(workspaceId, mutation);
    return noStore({ ...result, status: "ok" });
  } catch (error) {
    return noStore({ error: getErrorMessage(error, "Events mutation failed.") }, 500);
  }
}

async function applyMutation(workspaceId: string, mutation: Mutation) {
  const supabase = createServiceSupabaseClient();
  switch (mutation.operation) {
    case "upsert-location": {
      const location = normalizeLocation(mutation.location);
      const { data, error } = await supabase.from("event_locations").upsert({
        ...location.row, workspace_id: workspaceId
      }, { onConflict: "workspace_id,stable_key" }).select("id, stable_key, location_name, location_url, address, address_url, contact_name, contact_phone, contact_notes").single();
      if (error) throw error;
      return { location: mapLocation(data as LocationRow) };
    }
    case "delete-location": {
      const { error } = await supabase.from("event_locations").delete().eq("workspace_id", workspaceId).eq("stable_key", stableKey(mutation.id));
      if (error) throw error;
      return { deletedLocationId: mutation.id };
    }
    case "delete-event": {
      const { error } = await supabase.from("events").delete().eq("workspace_id", workspaceId).eq("stable_key", stableKey(mutation.id));
      if (error) throw error;
      return { deletedEventId: mutation.id };
    }
    case "clear-events": {
      if (mutation.intent !== "clear-events") throw new Error("Explicit clear intent is required.");
      const { error } = await supabase.from("events").delete().eq("workspace_id", workspaceId);
      if (error) throw error;
      return { cleared: true };
    }
    case "upsert-event": {
      const normalized = normalizeEvent(mutation.entry);
      let locationId: string | null = null;
      if (normalized.locationStableKey) {
        const { data, error } = await supabase.from("event_locations").select("id").eq("workspace_id", workspaceId).eq("stable_key", normalized.locationStableKey).maybeSingle();
        if (error) throw error;
        locationId = data?.id ?? null;
      }
      const { data: savedEvent, error: eventError } = await supabase.from("events").upsert({
        ...normalized.row, location_id: locationId, workspace_id: workspaceId
      }, { onConflict: "workspace_id,stable_key" }).select("id, stable_key, event_date, event_time, event_name, event_url, poster_url, location_id, location_name, location_url, address, address_url").single();
      if (eventError) throw eventError;
      const event = savedEvent as EventRow;
      // A budget edit replaces only this event's lines; unrelated events are untouched.
      const { error: deleteLinesError } = await supabase.from("event_budget_lines").delete().eq("event_id", event.id);
      if (deleteLinesError) throw deleteLinesError;
      const lines = normalizeBudgetLines(normalized.entry.budgetLines ?? []);
      if (lines.length) {
        const { error } = await supabase.from("event_budget_lines").insert(lines.map((line, index) => ({ event_id: event.id, description: line.description, amount: line.amount, budget_bucket: line.bucket, position: index + 1 })));
        if (error) throw error;
      }
      const [{ data: location, error: locationError }, { data: budgetLines, error: budgetError }] = await Promise.all([
        event.location_id ? supabase.from("event_locations").select("id, stable_key, location_name, location_url, address, address_url, contact_name, contact_phone, contact_notes").eq("id", event.location_id).single() : Promise.resolve({ data: null, error: null }),
        supabase.from("event_budget_lines").select("id, event_id, description, amount, budget_bucket, position").eq("event_id", event.id).order("position")
      ]);
      if (locationError) throw locationError;
      if (budgetError) throw budgetError;
      return { event: mapEvent(event, location as LocationRow | null, (budgetLines ?? []) as BudgetRow[]) };
    }
  }
}

async function loadEventsSnapshot(workspaceId: string) {
  const supabase = createServiceSupabaseClient();
  const [locationsResult, eventsResult, budgetLinesResult] = await Promise.all([
    supabase.from("event_locations").select("id, stable_key, location_name, location_url, address, address_url, contact_name, contact_phone, contact_notes").eq("workspace_id", workspaceId).order("location_name"),
    supabase.from("events").select("id, stable_key, event_date, event_time, event_name, event_url, poster_url, location_id, location_name, location_url, address, address_url").eq("workspace_id", workspaceId).order("event_date", { ascending: false }),
    supabase.from("event_budget_lines").select("id, event_id, description, amount, budget_bucket, position").order("position")
  ]);
  if (locationsResult.error) throw locationsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (budgetLinesResult.error) throw budgetLinesResult.error;
  const locations = (locationsResult.data ?? []) as LocationRow[];
  const budgetByEvent = new Map<string, BudgetRow[]>();
  ((budgetLinesResult.data ?? []) as BudgetRow[]).forEach((line) => budgetByEvent.set(line.event_id, [...(budgetByEvent.get(line.event_id) ?? []), line]));
  return { entries: ((eventsResult.data ?? []) as EventRow[]).map((event) => mapEvent(event, locations.find((location) => location.id === event.location_id) ?? null, budgetByEvent.get(event.id) ?? [])), locations: locations.map(mapLocation) };
}

function normalizeLocation(location: Location) {
  const key = stableKey(location.id) || `location-${Date.now()}`;
  return { row: { stable_key: key, location_name: location.locationName.trim() || "Location name", location_url: location.locationUrl.trim(), address: optionalText(location.address), address_url: location.addressUrl.trim(), contact_name: location.contactName.trim(), contact_phone: location.contactPhone.trim(), contact_notes: location.contactNotes.trim(), source: "app" } };
}

function normalizeEvent(entry: EventEntry) {
  const date = inputDateToDatabase(entry.date);
  if (!date) throw new Error(`Invalid event date for ${entry.name}.`);
  return { entry, locationStableKey: entry.locationId ? stableKey(entry.locationId) : null, row: { stable_key: stableKey(entry.id) || `event-${Date.now()}`, event_date: date, event_time: normalizeTime(entry.time), event_name: entry.name.trim() || "Event", event_url: entry.nameUrl.trim(), poster_url: entry.posterUrl?.trim() ?? "", location_name: entry.locationName.trim() || "Location name", location_url: entry.locationUrl.trim(), address: optionalText(entry.address), address_url: entry.addressUrl.trim(), source: "app" } };
}

function mapEvent(event: EventRow, location: LocationRow | null, lines: BudgetRow[]): EventEntry {
  return { id: event.stable_key, dbId: event.id, date: databaseDateToInput(event.event_date), time: event.event_time?.slice(0, 5) ?? "", name: event.event_name, nameUrl: event.event_url, locationName: event.location_name, locationUrl: event.location_url, address: event.address, addressUrl: event.address_url, locationId: location?.stable_key, posterUrl: event.poster_url ?? "", budgetLines: lines.length ? lines.sort((a, b) => a.position - b.position).map((line) => ({ id: line.id, amount: Number(line.amount), bucket: normalizeBucket(line.budget_bucket), description: line.description })) : [{ id: "event-budget-line-default", amount: 0, description: "" }] };
}

function mapLocation(location: LocationRow): Location { return { id: location.stable_key, dbId: location.id, locationName: location.location_name, locationUrl: location.location_url, address: location.address, addressUrl: location.address_url, contactName: location.contact_name, contactPhone: location.contact_phone, contactNotes: location.contact_notes }; }
function normalizeBudgetLines(lines: BudgetLine[]) { return lines.filter((line) => line.description.trim() || line.amount !== 0).map((line) => ({ description: line.description, amount: Number(line.amount) || 0, bucket: normalizeBucket(line.bucket) })); }
function normalizeBucket(value?: string | null): BudgetSourceBucket { return value === "marketing" || value === "other" ? value : "events"; }
function stableKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function optionalText(value?: string) { const text = value?.trim() ?? ""; return text === "Address" ? "" : text; }
function normalizeTime(value?: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "") ? value : null; }
function inputDateToDatabase(value: string) { const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!match) return null; const [, day, month, year] = match; const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))); return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? `${year}-${month}-${day}` : null; }
function databaseDateToInput(value: string) { const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}/${match[2]}/${match[1]}` : ""; }
function noStore(body: object, status = 200) { const response = NextResponse.json(body, { status }); response.headers.set("Cache-Control", "private, no-store, max-age=0"); return response; }
function isAuthorizedWrite(request: NextRequest) { if (request.headers.get("x-love-strings-events") !== "write") return false; const origin = request.headers.get("origin"); const host = request.headers.get("host"); const referer = request.headers.get("referer"); const fetchSite = request.headers.get("sec-fetch-site"); if (!host) return false; if (fetchSite === "same-origin") return true; if (origin) return new URL(origin).host === host; return referer ? new URL(referer).host === host : false; }
function createServiceSupabaseClient() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."); return createClient(supabaseUrl, supabaseServiceRoleKey); }
function getErrorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
