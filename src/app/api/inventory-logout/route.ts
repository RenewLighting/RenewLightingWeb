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

export function GET(request: Request) {
  return clearInventoryAccess(
    NextResponse.redirect(new URL("/api/auth/signout", request.url)),
  );
}

export function POST() {
  return clearInventoryAccess(NextResponse.json({ ok: true }));
}