import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { signTrackingToken } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const recipient = url.searchParams.get("recipient")?.trim();
  const subject = url.searchParams.get("subject")?.trim();

  if (!recipient || !subject) {
    return NextResponse.json(
      { error: "recipient and subject query parameters are required" },
      { status: 400 },
    );
  }

  const token = signTrackingToken({ recipient, subject, sentAt: Date.now() });
  const pixelUrl = `${url.origin}/api/track/open?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    pixelUrl,
    html: `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;">`,
  });
}
