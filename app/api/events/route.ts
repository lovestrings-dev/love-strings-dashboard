import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ProductionBudgetLine = {
  id: string;
  amount: number;
  description: string;
};
type EventEntry = {
  id: string;
  dbId?: string;
  date: string;
  name: string;
  nameUrl: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
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
  event_name: string;
  event_url: string;
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
  position: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!isAuthorizedEventsRequest(request, false)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const snapshot = await loadEventsSnapshot();

    return NextResponse.json({
      ...snapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Events load failed." },
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
    const savedSnapshot = await saveEventsSnapshot({ entries, locations });

    return NextResponse.json({
      ...savedSnapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Events save failed." },
      { status: 500 }
    );
  }
}

async function loadEventsSnapshot() {
  const supabase = createServiceSupabaseClient();
  const [locationsResult, eventsResult, budgetLinesResult] = await Promise.all([
    supabase
      .from("event_locations")
      .select(
        "id, stable_key, location_name, location_url, address, address_url, contact_name, contact_phone, contact_notes"
      )
      .order("location_name", { ascending: true }),
    supabase
      .from("events")
      .select(
        "id, stable_key, event_date, event_name, event_url, location_id, location_name, location_url, address, address_url"
      )
      .order("event_date", { ascending: false }),
    supabase
      .from("event_budget_lines")
      .select("id, event_id, description, amount, position")
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
  entries,
  locations
}: {
  entries: EventEntry[];
  locations: LocationAddressBookEntry[];
}) {
  const supabase = createServiceSupabaseClient();
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
    ...(location.dbId ? { id: location.dbId } : {})
  }));

  if (locationRows.length > 0) {
    const { error: locationError } = await supabase
      .from("event_locations")
      .upsert(locationRows, { onConflict: "stable_key" });

    if (locationError) throw locationError;
  }

  await deleteMissingRows({
    keepStableKeys: normalizedLocations.map((item) => item.stableKey),
    supabase,
    table: "event_locations"
  });

  const { data: savedLocations, error: savedLocationError } = await supabase
    .from("event_locations")
    .select("id, stable_key");

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
      event_name: entry.name,
      event_url: entry.nameUrl,
      location_id: locationId,
      location_name: entry.locationName,
      location_url: entry.locationUrl,
      address: entry.address,
      address_url: entry.addressUrl,
      source: "app",
      ...(entry.dbId ? { id: entry.dbId } : {})
    };
  });

  if (eventRows.length > 0) {
    const { error: eventError } = await supabase
      .from("events")
      .upsert(eventRows, { onConflict: "stable_key" });

    if (eventError) throw eventError;
  }

  await deleteMissingRows({
    keepStableKeys: normalizedEntries.map((item) => item.stableKey),
    supabase,
    table: "events"
  });

  const { data: savedEvents, error: savedEventError } = await supabase
    .from("events")
    .select("id, stable_key");

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
      position: index + 1
    }));
  });

  const { error: deleteBudgetError } = await supabase
    .from("event_budget_lines")
    .delete()
    .not("event_id", "is", null);

  if (deleteBudgetError) throw deleteBudgetError;

  if (budgetRows.length > 0) {
    const { error: budgetError } = await supabase
      .from("event_budget_lines")
      .insert(budgetRows);

    if (budgetError) throw budgetError;
  }

  return loadEventsSnapshot();
}

function normalizeLocationForSave(location: LocationAddressBookEntry) {
  const stableKey =
    createStableId(location.id) ||
    createStableId(`${location.locationName}-${location.address}`) ||
    `location-${Date.now()}`;

  return {
    location: {
      ...location,
      address: location.address.trim() || "Address",
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
  const matchingLocation = normalizedLocations.find(
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
      address: entry.address.trim() || "Address",
      addressUrl: entry.addressUrl.trim(),
      date: entry.date.trim(),
      locationName: entry.locationName.trim() || "Location name",
      locationUrl: entry.locationUrl.trim(),
      name: entry.name.trim() || "Event",
      nameUrl: entry.nameUrl.trim()
    },
    locationId: matchingLocation
      ? locationIdByStableKey.get(matchingLocation.stableKey) ?? null
      : null,
    stableKey
  };
}

async function deleteMissingRows({
  keepStableKeys,
  supabase,
  table
}: {
  keepStableKeys: string[];
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  table: "event_locations" | "events";
}) {
  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id, stable_key");

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
    .in("id", idsToDelete);

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
      dbId: entry.id,
      id: entry.stable_key,
      locationName: entry.location_name,
      locationUrl: entry.location_url,
      name: entry.event_name,
      nameUrl: entry.event_url
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
      description: line.description,
      id: line.id
    }));

  return mappedRows.length > 0
    ? mappedRows
    : [{ id: "event-budget-line-default", amount: 0, description: "" }];
}

function normalizeBudgetLines(budgetLines: ProductionBudgetLine[]) {
  return budgetLines.filter(
    (line) => line.description.trim().length > 0 || line.amount !== 0
  );
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
