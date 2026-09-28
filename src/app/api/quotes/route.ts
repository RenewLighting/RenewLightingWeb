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

export async function GET() {
  const email = await getEmployeeEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureQuoteTable();
    const { rows } = await db.query(
      `SELECT id, project_name, status, created_at, updated_at
       FROM quotes WHERE owner_email = $1 ORDER BY updated_at DESC LIMIT 100`,
      [email],
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote storage is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const email = await getEmployeeEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.quote || !Array.isArray(body.quote.lines)) {
    return NextResponse.json({ error: "A valid quote is required" }, { status: 400 });
  }

  try {
    await ensureQuoteTable();
    const projectName = String(body.quote.projectName || "").trim();
    const status = body.status === "review" ? "review" : "draft";
    const { rows } = await db.query(
      `INSERT INTO quotes (owner_email, project_name, status, quote_data)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, project_name, status, created_at, updated_at`,
      [email, projectName, status, JSON.stringify(body.quote)],
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Quote could not be saved" }, { status: 503 });
  }
}