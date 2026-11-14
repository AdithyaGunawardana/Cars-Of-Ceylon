import { ImageResponse } from "next/og";
import { getPublicVehicleSeo } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const alt = "Vehicle record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getPublicVehicleSeo(id);
  // Private, hidden and deleted vehicles get the generic card so nothing leaks through link previews.
  const title = vehicle ? `${vehicle.year} ${vehicle.manufacturer} ${vehicle.model}` : SITE_NAME;
  const subtitle = vehicle
    ? `${vehicle._count.events} timeline events - ${vehicle._count.photos} photos`
    : "Vehicle history archive";

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
        <div style={{ fontSize: 28, letterSpacing: 6, color: "#725a39", textTransform: "uppercase" }}>{SITE_NAME}</div>
        <div style={{ fontSize: 84, marginTop: 24, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#504442" }}>{subtitle}</div>
      </div>
    ),
    size,
  );
}
