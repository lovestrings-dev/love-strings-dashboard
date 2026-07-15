import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type BudgetEntryType = "earned" | "spent" | "one-off" | "recurring";
type BudgetSourceBucket = "events" | "production" | "marketing" | "other";
type BudgetRecurringCadence = "monthly" | "yearly";
type BudgetEntry = {
  id: string;
  dbId?: string;
  date: string;
  description: string;
  amount: number;
  type: BudgetEntryType;
  bucket?: BudgetSourceBucket;
  recurringCadence?: BudgetRecurringCadence;
  paymentPlanEndDate?: string;
  generated?: boolean;
};
type BudgetSnapshotPayload = {
  deletedForecastIds?: string[];
  entries?: BudgetEntry[];
};
type BudgetEntryRow = {
  id: string;
  stable_key: string;
  entry_date: string;
  description: string;
  amount: number | string;
  budget_bucket: BudgetSourceBucket | null;
  entry_type: BudgetEntryType;
  recurring_cadence: BudgetRecurringCadence | null;
  payment_plan_end_date: string | null;
};
type HiddenGeneratedBudgetRow = {
  generated_entry_id: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!isAuthorizedBudgetRequest(request, false)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const snapshot = await loadBudgetSnapshot();

    return NextResponse.json({
      ...snapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Budget load failed.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedBudgetRequest(request, true)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as BudgetSnapshotPayload;

  try {
    const snapshot = await saveBudgetSnapshot({
      deletedForecastIds: payload.deletedForecastIds ?? [],
      entries: payload.entries ?? []
    });

    return NextResponse.json({
      ...snapshot,
      status: "ok"
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Budget save failed.") },
      { status: 500 }
    );
  }
}

async function loadBudgetSnapshot() {
  const supabase = createServiceSupabaseClient();
  const [entriesResult, hiddenEntriesResult] = await Promise.all([
    supabase
      .from("budget_entries")
      .select(
        "id, stable_key, entry_date, description, amount, budget_bucket, entry_type, recurring_cadence, payment_plan_end_date"
      )
      .order("entry_date", { ascending: false }),
    supabase
      .from("budget_hidden_generated_entries")
      .select("generated_entry_id")
      .order("created_at", { ascending: true })
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (hiddenEntriesResult.error) throw hiddenEntriesResult.error;

  return mapBudgetSnapshotRows({
    deletedForecastIds: (hiddenEntriesResult.data ?? []) as HiddenGeneratedBudgetRow[],
    entries: (entriesResult.data ?? []) as BudgetEntryRow[]
  });
}

async function saveBudgetSnapshot({
  deletedForecastIds,
  entries
}: {
  deletedForecastIds: string[];
  entries: BudgetEntry[];
}) {
  const supabase = createServiceSupabaseClient();
  const normalizedEntries = entries.filter((entry) => !entry.generated).map(normalizeBudgetEntryForSave);
  const budgetRows = normalizedEntries.map(({ entry, stableKey }) => {
    const entryDate = formatInputDateForDatabase(entry.date);
    const paymentPlanEndDate = entry.paymentPlanEndDate
      ? formatInputDateForDatabase(entry.paymentPlanEndDate)
      : null;

    if (!entryDate) {
      throw new Error(`Invalid budget date for ${entry.description}.`);
    }

    return {
      amount: Number(entry.amount) || 0,
      budget_bucket: normalizeBudgetSourceBucket(
        entry.bucket ?? inferBudgetSourceBucket(entry.description)
      ),
      description: entry.description,
      entry_date: entryDate,
      entry_type: normalizeBudgetEntryType(entry.type),
      payment_plan_end_date: paymentPlanEndDate,
      recurring_cadence:
        entry.type === "recurring" ? entry.recurringCadence ?? "monthly" : null,
      source: "app",
      stable_key: stableKey
    };
  });

  if (budgetRows.length > 0) {
    const { error } = await supabase
      .from("budget_entries")
      .upsert(budgetRows, { onConflict: "stable_key" });

    if (error) throw error;
  }

  await deleteMissingRows({
    keepStableKeys: normalizedEntries.map((item) => item.stableKey),
    supabase,
    table: "budget_entries"
  });

  const normalizedHiddenIds = Array.from(
    new Set(
      deletedForecastIds.filter(
        (forecastId): forecastId is string =>
          typeof forecastId === "string" && forecastId.trim().length > 0
      )
    )
  );

  if (normalizedHiddenIds.length > 0) {
    const { error } = await supabase.from("budget_hidden_generated_entries").upsert(
      normalizedHiddenIds.map((generatedEntryId) => ({
        generated_entry_id: generatedEntryId
      })),
      { onConflict: "generated_entry_id" }
    );

    if (error) throw error;
  }

  await deleteMissingRows({
    column: "generated_entry_id",
    keepStableKeys: normalizedHiddenIds,
    supabase,
    table: "budget_hidden_generated_entries"
  });

  return loadBudgetSnapshot();
}

function mapBudgetSnapshotRows({
  deletedForecastIds,
  entries
}: {
  deletedForecastIds: HiddenGeneratedBudgetRow[];
  entries: BudgetEntryRow[];
}) {
  return {
    deletedForecastIds: deletedForecastIds.map((entry) => entry.generated_entry_id),
    entries: entries.map((entry) => ({
      amount: Number(entry.amount) || 0,
      bucket: normalizeBudgetSourceBucket(
        entry.budget_bucket ?? inferBudgetSourceBucket(entry.description)
      ),
      date: formatDateForInput(parseCampaignDateKey(entry.entry_date) ?? new Date()),
      dbId: entry.id,
      description: entry.description,
      id: entry.stable_key,
      paymentPlanEndDate: entry.payment_plan_end_date
        ? formatDateForInput(parseCampaignDateKey(entry.payment_plan_end_date) ?? new Date())
        : undefined,
      recurringCadence: entry.recurring_cadence ?? undefined,
      type: normalizeBudgetEntryType(entry.entry_type)
    }))
  };
}

function normalizeBudgetEntryForSave(entry: BudgetEntry) {
  const stableKey = entry.id?.trim() || createStableId(entry.description) || `budget-${Date.now()}`;

  return {
    entry: {
      ...entry,
      amount: Number(entry.amount) || 0,
      bucket: normalizeBudgetSourceBucket(
        entry.bucket ?? inferBudgetSourceBucket(entry.description)
      ),
      description: entry.description?.trim() || "Budget line",
      id: stableKey,
      type: normalizeBudgetEntryType(entry.type)
    },
    stableKey
  };
}

function normalizeBudgetSourceBucket(value: string): BudgetSourceBucket {
  if (
    value === "events" ||
    value === "production" ||
    value === "marketing" ||
    value === "other"
  ) {
    return value;
  }

  return "production";
}

function inferBudgetSourceBucket(description: string): BudgetSourceBucket {
  const normalizedDescription = description.toLowerCase();

  if (
    normalizedDescription.includes("pickwick") ||
    normalizedDescription.includes("gig") ||
    normalizedDescription.includes("wedding") ||
    normalizedDescription.includes("lebenszeit") ||
    normalizedDescription.includes("event")
  ) {
    return "events";
  }

  if (
    normalizedDescription.includes("canva") ||
    normalizedDescription.includes("photo") ||
    normalizedDescription.includes("ads") ||
    normalizedDescription.includes("marketing") ||
    normalizedDescription.includes("promo")
  ) {
    return "marketing";
  }

  return "production";
}

function normalizeBudgetEntryType(value: string): BudgetEntryType {
  if (
    value === "earned" ||
    value === "spent" ||
    value === "one-off" ||
    value === "recurring"
  ) {
    return value;
  }

  return "one-off";
}

async function deleteMissingRows({
  column = "stable_key",
  keepStableKeys,
  supabase,
  table
}: {
  column?: string;
  keepStableKeys: string[];
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  table: string;
}) {
  const query = supabase.from(table).delete();
  const { error } =
    keepStableKeys.length > 0
      ? await query.not(column, "in", `(${keepStableKeys.map(escapePostgrestValue).join(",")})`)
      : await query.neq(column, "");

  if (error) throw error;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

function isAuthorizedBudgetRequest(request: NextRequest, requiresWrite: boolean) {
  if (!requiresWrite) {
    return true;
  }

  return request.headers.get("x-love-strings-budget") === "write";
}

function formatInputDateForDatabase(value: string) {
  const date = parseCampaignDate(value);

  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatDateForInput(date: Date) {
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join("/");
}

function parseCampaignDate(value: string) {
  const trimmedValue = value.trim();
  const dateMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const fullYear = year.length === 2 ? Number(`20${year}`) : Number(year);
    const date = new Date(Date.UTC(fullYear, Number(month) - 1, Number(day)));

    if (
      date.getUTCFullYear() === fullYear &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return date;
    }
  }

  return parseCampaignDateKey(trimmedValue);
}

function parseCampaignDateKey(dateKey: string) {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  ) {
    return date;
  }

  return null;
}

function createStableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapePostgrestValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
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
