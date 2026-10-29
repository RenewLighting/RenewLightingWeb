import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import type { Quote } from "@/lib/quote";
import { createQuoteProposalPdf } from "@/lib/quote-proposal-pdf";
import { createQuoteWorkbook } from "@/lib/quote-workbook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseQuote(value: string | null): Quote | null {
  if (!value) return null;
  try {
    const quote = JSON.parse(value) as Quote;
    if (!quote || !Array.isArray(quote.lines)) return null;
    return quote;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const ownerEmail = session?.user?.email?.toLowerCase();
  if (!ownerEmail?.endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const quote = parseQuote(url.searchParams.get("data"));
  if (!quote) return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
  const format = url.searchParams.get("format");

  if (format === "xlsx") {
    const buffer = createQuoteWorkbook(quote);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${(quote.projectName || "quote").replace(/[^a-z0-9]+/gi, "-")}.xlsx"` } });
  }

  if (format === "pdf") {
    try {
      const buffer = await createQuoteProposalPdf(quote, ownerEmail);
      return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${(quote.projectName || "proposal").replace(/[^a-z0-9]+/gi, "-")}.pdf"` } });
    } catch (error) {
      console.error("Quote proposal PDF generation failed:", error);
      return NextResponse.json({ error: "Proposal PDF could not be generated" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
}
