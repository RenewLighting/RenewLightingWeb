import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxPhotoSize = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "A valid image upload is required" }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.type !== "image/jpeg" || file.size === 0 || file.size > maxPhotoSize) {
    return NextResponse.json({ error: "Upload a JPEG photo smaller than 2 MB" }, { status: 400 });
  }

  const image = Buffer.from(await file.arrayBuffer());
  if (image.length < 3 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
    return NextResponse.json({ error: "The uploaded file is not a valid JPEG image" }, { status: 400 });
  }

  const id = randomUUID();
  try {
    await ensureQuoteTable();
    await db.query(
      "INSERT INTO quote_line_photos (id, owner_email, content_type, image_data) VALUES ($1, $2, 'image/jpeg', $3)",
      [id, email, image],
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Quote line photo upload failed:", error);
    return NextResponse.json({ error: "Photo could not be saved" }, { status: 503 });
  }
}
