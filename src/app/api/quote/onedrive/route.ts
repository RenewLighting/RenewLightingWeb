import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { saveQuoteWorkbookToOneDrive } from "@/lib/onedrive";
import type { Quote } from "@/lib/quote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<Quote>;
  return Array.isArray(quote.lines) && quote.lines.length <= 500
    && quote.lines.every((line) => line && typeof line === "object");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email?.toLowerCase().endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isQuote(body?.quote) || typeof body?.folderId !== "string" || !body.folderId.trim()) {
    return NextResponse.json({ error: "A valid quote and destination folder are required" }, { status: 400 });
  }

  try {
    const projectName = String(body.quote.projectName || "Quote")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim()
      .slice(0, 100) || "Quote";
    const fileName = `${projectName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const result = await saveQuoteWorkbookToOneDrive(body.quote, body.folderId, fileName);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the quote to OneDrive";
    console.error("OneDrive quote upload failed:", error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
