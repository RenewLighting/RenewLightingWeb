import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("Email tracking test failed: RESEND_API_KEY is not set");
    return NextResponse.json(
      { error: "Email sending is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Renew Lighting <onboarding@resend.dev>",
      to: [
        process.env.EMAIL_TRACKING_NOTIFICATION_EMAIL ||
          "projects@renewlighting.com",
      ],
      subject: "Email tracking notification test",
      html: "<p>This is a test notification from Renew's email-open tracker.</p>",
    });

    if (error) {
      console.error("Resend error sending email tracking test:", error);
      return NextResponse.json(
        { error: "Resend rejected the test email. Check the deployment logs." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Resend accepted the test email for delivery.",
    });
  } catch (error) {
    console.error("Failed to send email tracking test:", error);
    return NextResponse.json(
      { error: "Could not send the test email. Check the deployment logs." },
      { status: 500 },
    );
  }
}
