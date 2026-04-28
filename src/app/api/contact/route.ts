import { NextResponse } from "next/server";
import { Resend } from "resend";

// Ensure this route is never statically prerendered
export const dynamic = "force-dynamic";

function getResend() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not set");
    }
    return new Resend(process.env.RESEND_API_KEY);
}

interface ContactBody {
    name: string;
    company: string;
    email: string;
    phone: string;
    address: string;
    propertyType: string;
    services: string[];
    details: string;
}

export async function POST(request: Request) {
    try {
        const body: ContactBody = await request.json();

        // Basic validation
        if (!body.name || !body.email) {
            return NextResponse.json(
                { error: "Name and email are required" },
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
            return NextResponse.json(
                { error: "Invalid email address" },
                { status: 400 }
            );
        }

        const resend = getResend();
        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "Renew Lighting <onboarding@resend.dev>",
            to: [process.env.CONTACT_EMAIL || "operations@renewlighting.com"],
            subject: `New Consultation Request from ${body.name}`,
            html: `
        <h2>New Consultation Request</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.name)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.company || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.email)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.phone || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Property Address</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.address || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Property Type</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.propertyType || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Services Needed</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.services?.length ? body.services.map(escapeHtml).join(", ") : "N/A"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Project Details</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(body.details || "N/A")}</td></tr>
        </table>
      `,
        });

        if (error) {
            console.error("Resend error:", error);
            return NextResponse.json(
                { error: "Failed to send email" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
