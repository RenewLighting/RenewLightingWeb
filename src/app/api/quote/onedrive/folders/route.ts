import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { listQuoteFolders } from "@/lib/onedrive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email?.toLowerCase().endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parentId = new URL(request.url).searchParams.get("parentId") || undefined;
  try {
    const result = await listQuoteFolders(parentId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not browse the shared OneDrive folder";
    console.error("OneDrive folder listing failed:", error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
