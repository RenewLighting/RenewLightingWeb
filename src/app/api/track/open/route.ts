import { NextResponse, after } from "next/server";
import { Resend } from "resend";

import { verifyTrackingToken } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

function pixelResponse() {
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const payload = token ? verifyTrackingToken(token) : null;

  // Always return the pixel so the image never appears broken
  if (!payload) return pixelResponse();

  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const openedAt = new Date();

  after(async () => {
    // Gmail's image proxy identifies itself via GoogleImageProxy
    const viaProxy = /GoogleImageProxy/i.test(userAgent)
      ? "Yes (Gmail image proxy)"
      : "No";

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Renew Lighting <onboarding@resend.dev>",
        to: [process.env.CONTACT_EMAIL || "operations@renewlighting.com"],
        subject: `Email opened: ${payload.subject} (${payload.recipient})`,
        html: `
          <h2>Tracked email was opened</h2>
          <table style="border-collapse:collapse;width:100%;max-width:600px;">
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Recipient</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(payload.recipient)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Subject</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(payload.subject)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Sent</td><td style="padding:8px;border-bottom:1px solid #eee;">${new Date(payload.sentAt).toUTCString()}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Opened</td><td style="padding:8px;border-bottom:1px solid #eee;">${openedAt.toUTCString()}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Via Gmail proxy</td><td style="padding:8px;border-bottom:1px solid #eee;">${viaProxy}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">IP</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(ip)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">User agent</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(userAgent)}</td></tr>
          </table>
        `,
      });
    } catch (error) {
      console.error("Failed to send open notification:", error);
    }
  });

  return pixelResponse();
}
