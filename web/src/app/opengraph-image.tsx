import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#fbfaee",
          color: "#271310",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, color: "#725a39", textTransform: "uppercase" }}>
          Vehicle history archive
        </div>
        <div style={{ fontSize: 96, marginTop: 24, fontWeight: 700 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#504442" }}>{SITE_DESCRIPTION}</div>
      </div>
    ),
    size,
  );
}
