import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  return email?.endsWith("@renewlighting.com") ? email : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
  }

  try {
    await ensureQuoteTable();
    const { rows } = await db.query(
      "SELECT content_type, image_data FROM quote_line_photos WHERE id = $1 AND owner_email = $2",
      [id, email],
    );
    if (!rows.length) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(rows[0].image_data), {
      headers: {
        "Content-Type": rows[0].content_type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Quote line photo retrieval failed:", error);
    return NextResponse.json({ error: "Photo could not be loaded" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
  }

  try {
    await ensureQuoteTable();
    const result = await db.query(
      "DELETE FROM quote_line_photos WHERE id = $1 AND owner_email = $2",
      [id, email],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Quote line photo deletion failed:", error);
    return NextResponse.json({ error: "Photo could not be deleted" }, { status: 503 });
  }
}
