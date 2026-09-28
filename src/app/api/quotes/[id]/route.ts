import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getEmployeeEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  return email?.endsWith("@renewlighting.com") ? email : null;
}

async function getQuoteId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getEmployeeEmail();
  const id = await getQuoteId(params);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });

  try {
    await ensureQuoteTable();
    const { rows } = await db.query(
      `SELECT id, project_name, status, quote_data, created_at, updated_at
       FROM quotes WHERE id = $1 AND owner_email = $2`,
      [id, email],
    );
    if (!rows.length) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote storage is unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getEmployeeEmail();
  const id = await getQuoteId(params);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body?.quote || !Array.isArray(body.quote.lines)) {
    return NextResponse.json({ error: "A valid quote is required" }, { status: 400 });
  }

  try {
    await ensureQuoteTable();
    const projectName = String(body.quote.projectName || "").trim();
    const status = body.status === "review" ? "review" : "draft";
    const { rows } = await db.query(
      `UPDATE quotes SET project_name = $1, status = $2, quote_data = $3::jsonb, updated_at = now()
       WHERE id = $4 AND owner_email = $5
       RETURNING id, project_name, status, created_at, updated_at`,
      [projectName, status, JSON.stringify(body.quote), id, email],
    );
    if (!rows.length) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote could not be saved" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getEmployeeEmail();
  const id = await getQuoteId(params);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });

  try {
    await ensureQuoteTable();
    const result = await db.query("DELETE FROM quotes WHERE id = $1 AND owner_email = $2", [id, email]);
    if (!result.rowCount) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote could not be deleted" }, { status: 503 });
  }
}