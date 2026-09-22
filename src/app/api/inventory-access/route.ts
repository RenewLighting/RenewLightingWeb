import { createHmac } from "crypto";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const cookieName = "renew_inventory_access";
const sessionDurationSeconds = 60 * 60 * 8;

function signInventoryAccess(email: string, expiresAt: number, secret: string) {
  const payload = `${email}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  const origin = process.env.INVENTORY_ORIGIN;
  const secret = process.env.WAREHOUSE_PROXY_SECRET;

  if (!email?.endsWith("@renewlighting.com")) {
    const signInUrl = new URL("/api/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", "/api/inventory-access");
    return NextResponse.redirect(signInUrl);
  }

  if (!origin || !secret) {
    return NextResponse.json(
      { error: "Inventory integration is not configured" },
      { status: 503 },
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  const response = NextResponse.redirect(new URL("/", origin));
  response.cookies.set(cookieName, signInventoryAccess(email, expiresAt, secret), {
    domain: ".renewlighting.com",
    expires: new Date(expiresAt * 1000),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return response;
}