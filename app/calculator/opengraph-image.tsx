import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "RoofReply — What could your missed calls be worth?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#132b40",
        color: "white",
        padding: "64px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderBottom: "1px solid #536c80",
          paddingBottom: "24px",
          fontSize: 23,
        }}
      >
        <span>RoofReply</span>
        <span style={{ fontSize: 17, color: "#b9d1df" }}>
          FOR ROOFING BUSINESS OWNERS
        </span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "55px",
          color: "#94c8df",
          fontSize: 19,
        }}
      >
        REVENUE RECOVERY ASSESSMENT
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 70,
          lineHeight: 1.08,
          letterSpacing: "-2px",
          marginTop: "22px",
          maxWidth: 1000,
        }}
      >
        What could your missed calls be worth?
      </div>
      <div
        style={{
          display: "flex",
          gap: "35px",
          color: "#d5e2eb",
          marginTop: "42px",
          fontSize: 22,
        }}
      >
        <span>Monthly and annual potential.</span>
        <span>Your assumptions.</span>
        <span>A clear next step.</span>
      </div>
      <div
        style={{
          display: "flex",
          color: "#94c8df",
          marginTop: "36px",
          fontSize: 17,
        }}
      >
        YOUR PERSONALIZED TWO-PAGE ASSESSMENT / FREE
      </div>
    </div>,
    size,
  );
}
