import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Used when the site is added to a home screen / in some share-preview surfaces.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e6d00, #4ba92b)",
        }}
      >
        <span style={{ fontSize: 108, fontWeight: 800, color: "#ffffff", fontFamily: "sans-serif" }}>
          R
        </span>
      </div>
    ),
    { ...size },
  );
}
