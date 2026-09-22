import { NextResponse } from "next/server";

const cookieName = "renew_inventory_access";

function clearInventoryAccess(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    domain: ".renewlighting.com",
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return response;
}

async function revokeWarehouseToken(request: Request) {
  const origin = process.env.INVENTORY_ORIGIN;
  const cookie = request.headers.get("cookie");
  if (!origin || !cookie) return;

  try {
    await fetch(`${origin}/api/auth/revoke`, {
      method: "POST",
      headers: { cookie },
      cache: "no-store",
    });
  } catch {
    // Clearing the local cookie still prevents reuse in this browser.
  }
}

export async function GET(request: Request) {
  await revokeWarehouseToken(request);
  return clearInventoryAccess(
    NextResponse.redirect(new URL("/api/auth/signout", request.url)),
  );
}

export async function POST(request: Request) {
  await revokeWarehouseToken(request);
  return clearInventoryAccess(NextResponse.json({ ok: true }));
}