import { ImageResponse } from "next/og";

export const alt = "Renew Lighting Services — Commercial Electrical & Lighting Contractor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b3600 0%, #1e6d00 55%, #4ba92b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 32 }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 28,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
              color: "#1e6d00",
            }}
          >
            R
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }}>
            Renew Lighting
          </div>
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.88)", maxWidth: 840, textAlign: "center" }}>
          Commercial &amp; Industrial Electrical and Lighting Services Since 1994
        </div>
      </div>
    ),
    { ...size },
  );
}
