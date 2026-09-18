import { createHmac, timingSafeEqual } from "crypto";

function getSecret() {
  const secret = process.env.EMAIL_TRACKING_SECRET;
  if (!secret) {
    throw new Error("EMAIL_TRACKING_SECRET is not set");
  }
  return secret;
}

export interface TrackingPayload {
  /** Recipient email or label */
  recipient: string;
  /** Subject or campaign label */
  subject: string;
  /** When the tracked email was created (ms epoch) */
  sentAt: number;
}

export function signTrackingToken(payload: TrackingPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyTrackingToken(token: string): TrackingPayload | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = createHmac("sha256", getSecret()).update(data).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (
      typeof payload?.recipient !== "string" ||
      typeof payload?.subject !== "string" ||
      typeof payload?.sentAt !== "number"
    ) {
      return null;
    }
    return payload as TrackingPayload;
  } catch {
    return null;
  }
}
