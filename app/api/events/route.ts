import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

type BudgetSourceBucket = "events" | "production" | "marketing" | "other";
type ProductionBudgetLine = {
  id: string;
  amount: number;
  bucket?: BudgetSourceBucket;
  description: string;
};
type EventEntry = {
  id: string;
  dbId?: string;
  date: string;
  time?: string;
  name: string;
  nameUrl: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
  locationId?: string;
  posterUrl?: string;
  budgetLines?: ProductionBudgetLine[];
};
type LocationAddressBookEntry = {
  id: string;
  dbId?: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
  contactName: string;
  contactPhone: string;
  contactNotes: string;
};
type EventsSnapshotPayload = {
  intent?: "clear-events";
  entries?: EventEntry[];
  locations?: LocationAddressBookEntry[];
};
type EventLocationRow = {
  id: string;
  stable_key: string;
  location_name: string;
  location_url: string;
  address: string;
  address_url: string;
  contact_name: string;
  contact_phone: string;
  contact_notes: string;
};
type EventRow = {
  id: string;
  stable_key: string;
  event_date: string;
  event_time?: string | null;
  event_name: string;
  event_url: string;
  poster_url?: string | null;
  location_id: string | null;
  location_name: string;
  location_url: string;
  address: string;
  address_url: string;
};
type EventBudgetLineRow = {
  id: string;
  event_id: string;
  description: string;
  amount: number | string;
  budget_bucket: BudgetSourceBucket | null;
  position: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!isAuthorizedEventsRequest(request, false)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const snapshot = await loadEventsSnapshot(workspaceId);

    return NextResponse.json({
      ...snapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Events load failed.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedEventsRequest(request, true)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as EventsSnapshotPayload;
  const entries = payload.entries ?? [];
  const locations = payload.locations ?? [];

  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const savedSnapshot = await saveEventsSnapshot({
      allowEmptyEvents: payload.intent === "clear-events",
      entries,
      locations,
      workspaceId
    });

    return NextResponse.json({
      ...savedSnapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Events save failed.") },
      { status: 500 }
    );
  }
}

async function loadEventsSnapshot(workspaceId: string) {
  const supabase = createServiceSupabaseClient();
  const [locationsResult, eventsResult, budgetLinesResult] = await Promise.all([
    supabase
      .from("event_locations")
      .select(
        "id, stable_key, location_name, location_url, address, address_url, contact_name, contact_phone, contact_notes"
      )
      .eq("workspace_id", workspaceId)
      .order("location_name", { ascending: true }),
    supabase
      .from("events")
      .select(
        "id, stable_key, event_date, event_time, event_name, event_url, poster_url, location_id, location_name, location_url, address, address_url"
      )
      .eq("workspace_id", workspaceId)
      .order("event_date", { ascending: false }),
    supabase
      .from("event_budget_lines")
      .select("id, event_id, description, amount, budget_bucket, position")
      .order("position", { ascending: true })
  ]);

  if (locationsResult.error) throw locationsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (budgetLinesResult.error) throw budgetLinesResult.error;

  return mapEventsSnapshotRows({
    budgetLines: (budgetLinesResult.data ?? []) as EventBudgetLineRow[],
    entries: (eventsResult.data ?? []) as EventRow[],
    locations: (locationsResult.data ?? []) as EventLocationRow[]
  });
}

async function saveEventsSnapshot({
  allowEmptyEvents,
  entries,
  locations,
  workspaceId
}: {
  allowEmptyEvents: boolean;
  entries: EventEntry[];
  locations: LocationAddressBookEntry[];
  workspaceId: string;
}) {
  const supabase = createServiceSupabaseClient();
  await assertSnapshotCanReplace({
    allowEmptyEvents,
    entries,
    locations,
    supabase,
    workspaceId
  });
  const normalizedLocations = locations.map(normalizeLocationForSave);
  const locationRows = normalizedLocations.map(({ location, stableKey }) => ({
    stable_key: stableKey,
    location_name: location.locationName,
    location_url: location.locationUrl,
    address: location.address,
    address_url: location.addressUrl,
    contact_name: location.contactName,
    contact_phone: location.contactPhone,
    contact_notes: location.contactNotes,
    source: "app",
    workspace_id: workspaceId
  }));

  if (locationRows.length > 0) {
    const { error: locationError } = await supabase
      .from("event_locations")
      .upsert(locationRows, { onConflict: "workspace_id,stable_key" });

    if (locationError) throw locationError;
  }

  await deleteMissingRows({
    keepStableKeys: normalizedLocations.map((item) => item.stableKey),
    supabase,
    table: "event_locations",
    workspaceId
  });

  const { data: savedLocations, error: savedLocationError } = await supabase
    .from("event_locations")
    .select("id, stable_key")
    .eq("workspace_id", workspaceId);

  if (savedLocationError) throw savedLocationError;

  const locationIdByStableKey = new Map(
    (savedLocations ?? []).map((location) => [location.stable_key, location.id])
  );
  const normalizedEntries = entries.map((entry) =>
    normalizeEventForSave(entry, normalizedLocations, locationIdByStableKey)
  );
  const eventRows = normalizedEntries.map(({ entry, locationId, stableKey }) => {
    const eventDate = formatInputDateForDatabase(entry.date);

    if (!eventDate) {
      throw new Error(`Invalid event date for ${entry.name}.`);
    }

    return {
      stable_key: stableKey,
      event_date: eventDate,
      event_time: entry.time,
      event_name: entry.name,
      event_url: entry.nameUrl,
      poster_url: entry.posterUrl ?? "",
      location_id: locationId,
      location_name: entry.locationName,
      location_url: entry.locationUrl,
      address: entry.address,
      address_url: entry.addressUrl,
      source: "app",
      workspace_id: workspaceId
    };
  });

  if (eventRows.length > 0) {
    const { error: eventError } = await supabase
      .from("events")
      .upsert(eventRows, { onConflict: "workspace_id,stable_key" });

    if (eventError) throw eventError;
  }

  await deleteMissingRows({
    keepStableKeys: normalizedEntries.map((item) => item.stableKey),
    supabase,
    table: "events",
    workspaceId
  });

  const { data: savedEvents, error: savedEventError } = await supabase
    .from("events")
    .select("id, stable_key")
    .eq("workspace_id", workspaceId);

  if (savedEventError) throw savedEventError;

  const eventIdByStableKey = new Map(
    (savedEvents ?? []).map((event) => [event.stable_key, event.id])
  );
  const budgetRows = normalizedEntries.flatMap(({ entry, stableKey }) => {
    const eventId = eventIdByStableKey.get(stableKey);

    if (!eventId) {
      return [];
    }

    return normalizeBudgetLines(entry.budgetLines ?? []).map((line, index) => ({
      event_id: eventId,
      description: line.description,
      amount: line.amount,
      budget_bucket: normalizeEventBudgetSourceBucket(line.bucket),
      position: index + 1
    }));
  });

  const workspaceEventIds = (savedEvents ?? []).map((event) => event.id);
  const deleteBudgetResult = workspaceEventIds.length
    ? await supabase
        .from("event_budget_lines")
        .delete()
        .in("event_id", workspaceEventIds)
    : { error: null };
  const deleteBudgetError = deleteBudgetResult.error;

  if (deleteBudgetError) throw deleteBudgetError;

  if (budgetRows.length > 0) {
    const { error: budgetError } = await supabase
      .from("event_budget_lines")
      .insert(budgetRows);

    if (budgetError) throw budgetError;
  }

  return loadEventsSnapshot(workspaceId);
}

function normalizeLocationForSave(location: LocationAddressBookEntry) {
  const stableKey =
    createStableId(location.id) ||
    createStableId(`${location.locationName}-${location.address}`) ||
    `location-${Date.now()}`;

  return {
    location: {
      ...location,
      address: normalizeOptionalText(location.address),
      addressUrl: location.addressUrl.trim(),
      contactName: location.contactName.trim(),
      contactNotes: location.contactNotes.trim(),
      contactPhone: location.contactPhone.trim(),
      locationName: location.locationName.trim() || "Location name",
      locationUrl: location.locationUrl.trim()
    },
    stableKey
  };
}

function normalizeEventForSave(
  entry: EventEntry,
  normalizedLocations: ReturnType<typeof normalizeLocationForSave>[],
  locationIdByStableKey: Map<string, string>
) {
  const matchingLocation = entry.locationId
    ? normalizedLocations.find(({ location }) => location.id === entry.locationId)
    : normalizedLocations.find(
        ({ location }) =>
          getLocationAddressBookKey(location.locationName, location.address) ===
          getLocationAddressBookKey(entry.locationName, entry.address)
      );
  const stableKey =
    createStableId(entry.id) ||
    createStableId(`${entry.date}-${entry.name}-${entry.locationName}`) ||
    `event-${Date.now()}`;

  return {
    entry: {
      ...entry,
      address: normalizeOptionalText(entry.address),
      addressUrl: entry.addressUrl.trim(),
      date: entry.date.trim(),
      time: normalizeEventTime(entry.time),
      locationName: entry.locationName.trim() || "Location name",
      locationUrl: entry.locationUrl.trim(),
      name: entry.name.trim() || "Event",
      nameUrl: entry.nameUrl.trim(),
      posterUrl: entry.posterUrl?.trim() ?? ""
    },
    locationId: matchingLocation
      ? locationIdByStableKey.get(matchingLocation.stableKey) ?? null
      : null,
    stableKey
  };
}

async function assertSnapshotCanReplace({
  allowEmptyEvents,
  entries,
  locations,
  supabase,
  workspaceId
}: {
  allowEmptyEvents: boolean;
  entries: EventEntry[];
  locations: LocationAddressBookEntry[];
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  workspaceId: string;
}) {
  const [eventsResult, locationsResult] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase
      .from("event_locations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (locationsResult.error) throw locationsResult.error;

  if (entries.length === 0 && (eventsResult.count ?? 0) > 0 && !allowEmptyEvents) {
    throw new Error("Refusing to replace a non-empty Events archive with an empty snapshot.");
  }

  if (locations.length === 0 && (locationsResult.count ?? 0) > 0) {
    throw new Error("Refusing to replace non-empty Event locations with an empty snapshot.");
  }
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized === "Address" ? "" : normalized;
}

async function deleteMissingRows({
  keepStableKeys,
  supabase,
  table,
  workspaceId
}: {
  keepStableKeys: string[];
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  table: "event_locations" | "events";
  workspaceId: string;
}) {
  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id, stable_key")
    .eq("workspace_id", workspaceId);

  if (selectError) throw selectError;

  const keepStableKeySet = new Set(keepStableKeys);
  const idsToDelete = (existingRows ?? [])
    .filter((row) => !keepStableKeySet.has(row.stable_key))
    .map((row) => row.id);

  if (idsToDelete.length === 0) {
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .in("id", idsToDelete)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
}

function mapEventsSnapshotRows({
  budgetLines,
  entries,
  locations
}: {
  budgetLines: EventBudgetLineRow[];
  entries: EventRow[];
  locations: EventLocationRow[];
}) {
  const budgetLinesByEventId = new Map<string, EventBudgetLineRow[]>();

  budgetLines.forEach((line) => {
    budgetLinesByEventId.set(line.event_id, [
      ...(budgetLinesByEventId.get(line.event_id) ?? []),
      line
    ]);
  });

  return {
    entries: entries.map((entry) => ({
      address: entry.address,
      addressUrl: entry.address_url,
      budgetLines: mapBudgetLines(budgetLinesByEventId.get(entry.id) ?? []),
      date: formatDateKeyForInput(entry.event_date),
      time: formatEventTimeForInput(entry.event_time),
      dbId: entry.id,
      id: entry.stable_key,
      locationName: entry.location_name,
      locationId: locations.find((location) => location.id === entry.location_id)
        ?.stable_key,
      locationUrl: entry.location_url,
      name: entry.event_name,
      nameUrl: entry.event_url,
      posterUrl: entry.poster_url ?? ""
    })),
    locations: locations.map((location) => ({
      address: location.address,
      addressUrl: location.address_url,
      contactName: location.contact_name,
      contactNotes: location.contact_notes,
      contactPhone: location.contact_phone,
      dbId: location.id,
      id: location.stable_key,
      locationName: location.location_name,
      locationUrl: location.location_url
    }))
  };
}

function mapBudgetLines(rows: EventBudgetLineRow[]) {
  const mappedRows = rows
    .sort((firstLine, secondLine) => firstLine.position - secondLine.position)
    .map((line) => ({
      amount: Number(line.amount),
      bucket: normalizeEventBudgetSourceBucket(line.budget_bucket),
      description: line.description,
      id: line.id
    }));

  return mappedRows.length > 0
    ? mappedRows
    : [{ id: "event-budget-line-default", amount: 0, description: "" }];
}

function normalizeBudgetLines(budgetLines: ProductionBudgetLine[]) {
  const seenLineFingerprints = new Set<string>();

  return budgetLines
    .filter((line) => line.description.trim().length > 0 || line.amount !== 0)
    .map((line) => ({
      ...line,
      bucket: normalizeEventBudgetSourceBucket(line.bucket)
    }))
    .filter((line) => {
      const fingerprint = [
        line.description.trim().toLowerCase(),
        Number(line.amount).toFixed(2),
        line.bucket
      ].join("::");

      if (seenLineFingerprints.has(fingerprint)) {
        return false;
      }

      seenLineFingerprints.add(fingerprint);
      return true;
    });
}

function normalizeEventBudgetSourceBucket(value?: string | null): BudgetSourceBucket {
  if (value === "marketing" || value === "other") {
    return value;
  }

  return "events";
}

function isAuthorizedEventsRequest(request: NextRequest, requiresWrite: boolean) {
  if (!requiresWrite) {
    return true;
  }

  if (requiresWrite && request.headers.get("x-love-strings-events") !== "write") {
    return false;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!host) {
    return false;
  }

  if (fetchSite === "same-origin") {
    return true;
  }

  if (origin) {
    return new URL(origin).host === host;
  }

  if (referer) {
    return new URL(referer).host === host;
  }

  return false;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function createStableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getLocationAddressBookKey(locationName: string, address: string) {
  const normalizedLocationName = createStableId(locationName);
  const normalizedAddress = createStableId(address);

  if (!normalizedLocationName && !normalizedAddress) {
    return "";
  }

  return `${normalizedLocationName}-${normalizedAddress}`;
}

function formatInputDateForDatabase(value: string) {
  const date = parseInputDate(value);

  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatDateKeyForInput(dateKey: string) {
  const date = parseDatabaseDateKey(dateKey);

  if (!date) {
    return "";
  }

  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join("/");
}

function formatEventTimeForInput(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function normalizeEventTime(value?: string) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedValue)) {
    throw new Error("Invalid event time.");
  }

  return normalizedValue;
}

function parseInputDate(value: string) {
  const normalizedValue = value.trim();
  const match = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsedDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return parsedDate;
}

function parseDatabaseDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}
