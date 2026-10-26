import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";
import { searchWarehouseQuoteSuggestions } from "@/lib/warehouse-quote-suggestions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HistoryRow = {
  proposed_description: string;
  proposed_watts: string;
  product_cost: string | null;
  updated_at: string | null;
};

function buildHistorySuggestions(rows: HistoryRow[]) {
  const grouped = new Map<string, {
    description: string;
    watts: string;
    priorUseCount: number;
    latestCost: number | null;
    latestUpdatedAt: string;
  }>();

  for (const row of rows) {
    const description = String(row.proposed_description || "").trim();
    if (!description) continue;
    const key = description.toLocaleLowerCase();
    const suggestion = grouped.get(key);
    if (suggestion) {
      suggestion.priorUseCount += 1;
      continue;
    }

    const cost = row.product_cost === null ? null : Number(row.product_cost);
    grouped.set(key, {
      description,
      watts: String(row.proposed_watts || "").trim(),
      priorUseCount: 1,
      latestCost: cost !== null && Number.isFinite(cost) && cost >= 0 ? cost : null,
      latestUpdatedAt: row.updated_at || "",
    });
  }

  return [...grouped.values()]
    .sort((first, second) => second.priorUseCount - first.priorUseCount
      || new Date(second.latestUpdatedAt).getTime() - new Date(first.latestUpdatedAt).getTime())
    .slice(0, 8);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ error: "Enter at least 3 characters to search suggestions" }, { status: 400 });
  }
  const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escapedQuery}%`;
  const ignoredTerms = new Set(["existing", "fixture", "fixtures", "light", "lighting", "the", "with", "from", "for", "and", "that", "this"]);
  const terms = (query.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((term) => term.length > 1 && !ignoredTerms.has(term))
    .slice(0, 8);
  const searchTerms = terms.length ? terms : [query.toLowerCase()];
  const minimumMatches = Math.max(1, Math.ceil(searchTerms.length * 0.6));

  try {
    await ensureQuoteTable();
    const { rows } = await db.query<HistoryRow>(
      `WITH history AS (
       SELECT line->>'existingDescription' AS existing_description,
         line->>'proposedDescription' AS proposed_description,
         line->>'proposedWatts' AS proposed_watts,
         line->>'productCost' AS product_cost,
         q.updated_at
       FROM quotes q
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(q.quote_data->'lines') = 'array' THEN q.quote_data->'lines' ELSE '[]'::jsonb END
       ) AS item(line)
       WHERE q.owner_email LIKE '%@renewlighting.com'
         AND q.status NOT IN ('rejected', 'archived')
       UNION ALL
       SELECT existing_description, proposed_description, proposed_watts, product_cost::text, source_date AS updated_at
       FROM quote_suggestion_history
       WHERE owner_email LIKE '%@renewlighting.com'
       )
       SELECT history.proposed_description, history.proposed_watts, history.product_cost, history.updated_at
       FROM history
       CROSS JOIN LATERAL (
       SELECT count(*)::int AS match_count
       FROM unnest($2::text[]) AS term(value)
       WHERE regexp_replace(lower(COALESCE(history.existing_description, '')), '[^a-z0-9]+', ' ', 'g')
         LIKE '%' || term.value || '%'
       ) matches
       WHERE length(trim(COALESCE(history.existing_description, ''))) > 0
       AND (history.existing_description ILIKE $1 OR matches.match_count >= $3)
       AND length(trim(COALESCE(history.proposed_description, ''))) > 0
       ORDER BY matches.match_count DESC, history.updated_at DESC NULLS LAST
       LIMIT 200`,
      [pattern, searchTerms, minimumMatches],
    );

    let warehouse: Awaited<ReturnType<typeof searchWarehouseQuoteSuggestions>> = [];
    let warehouseAvailable = true;
    try {
      warehouse = await searchWarehouseQuoteSuggestions(query, email);
    } catch (error) {
      warehouseAvailable = false;
      console.error("Warehouse quote suggestions unavailable:", error);
    }

    return NextResponse.json({
      history: buildHistorySuggestions(rows),
      warehouse,
      warehouseAvailable,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote suggestions are temporarily unavailable" }, { status: 503 });
  }
}
