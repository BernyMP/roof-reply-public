import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt =
  "RoofReply — Managed missed-call recovery for residential roofers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#1c2a30",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 700,
          marginBottom: 48,
        }}
      >
        RoofReply
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: "-2px",
        }}
      >
        Missed roofing calls.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: "-2px",
          color: "#ffb782",
        }}
      >
        Recover the opportunity.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          lineHeight: 1.5,
          marginTop: 28,
          maxWidth: 900,
          color: "#c9d2d3",
        }}
      >
        Managed follow-up, roofing qualification and inspection handoff.
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 48,
          fontSize: 22,
          color: "#ffb782",
        }}
      >
        Book a 20-Minute Missed-Call Audit · roofreply.com
      </div>
    </div>,
    size,
  );
}
