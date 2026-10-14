import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 40,
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
