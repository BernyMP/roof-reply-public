import type { SocialGraphic } from "./social-content.ts";

// Shared by the hosted renderer and the local, offline sample command.
export function SocialGraphicImage({ graphic: g }: { graphic: SocialGraphic }) {
  const dark = g.template !== "checklist";
  const ink = dark ? "#fffaf4" : "#1c2a30";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "76px",
        background: dark ? "#1c2a30" : "#f5f0e8",
        color: ink,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        <span>
          RoofReply<span style={{ color: "#f09d62" }}>.</span>
        </span>
        <span
          style={{
            fontSize: 18,
            letterSpacing: 3,
            color: dark ? "#ffb782" : "#8a421b",
          }}
        >
          FOR ROOFING OWNERS
        </span>
      </div>
      <div
        style={{
          display: "flex",
          width: 64,
          height: 7,
          background: "#f09d62",
          marginTop: 64,
          marginBottom: 36,
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: g.template === "headline" ? 86 : 62,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: -2,
          whiteSpace: "pre-wrap",
        }}
      >
        {g.headline}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 32,
          fontSize: 30,
          lineHeight: 1.45,
          color: dark ? "#d4dedd" : "#43565c",
        }}
      >
        {g.body}
      </div>
      {g.template === "headline" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginTop: 64,
            padding: "32px 36px",
            border: "2px solid #526267",
            borderRadius: 22,
          }}
        >
          <span style={{ fontSize: 22, color: "#ffb782", letterSpacing: 2 }}>
            A CLEAR NEXT STEP
          </span>
          <span style={{ fontSize: 34 }}>Missed call → Text follow-up</span>
          <span style={{ fontSize: 34 }}>Roofing details → Team handoff</span>
        </div>
      )}
      {g.template === "checklist" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginTop: 44,
          }}
        >
          {g.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "26px 28px",
                background: "#fffdf9",
                border: "2px solid #d8d0c4",
                borderRadius: 18,
                gap: 22,
              }}
            >
              <span style={{ display: "flex", color: "#984c23", fontSize: 34 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 30, lineHeight: 1.3 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
      {g.template === "conversation" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 32,
          }}
        >
          <span style={{ color: "#ffb782", fontSize: 19, letterSpacing: 2 }}>
            ILLUSTRATIVE EXAMPLE · FICTIONAL MESSAGES
          </span>
          {g.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignSelf: i === 1 ? "flex-end" : "flex-start",
                width: "90%",
                padding: "22px 28px",
                borderRadius: 20,
                background: i === 1 ? "#ffb782" : "#35474e",
                color: i === 1 ? "#1c2a30" : "#fffaf4",
              }}
            >
              <span style={{ fontSize: 17, marginBottom: 10, fontWeight: 700 }}>
                {i === 1 ? "AUTOMATED ASSISTANT" : "HOMEOWNER"}
              </span>
              <span style={{ fontSize: 28, lineHeight: 1.3 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          paddingTop: 34,
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            background: dark ? "#ffb782" : "#1c2a30",
            color: dark ? "#1c2a30" : "#fffaf4",
            padding: "24px 28px",
            borderRadius: 12,
            fontSize: 27,
            fontWeight: 700,
          }}
        >
          Book a 20-minute missed-call audit
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 19,
            color: dark ? "#c9d2d3" : "#43565c",
          }}
        >
          <span>Managed follow-up. Human handoff.</span>
          <span>roofreply.com</span>
        </div>
      </div>
    </div>
  );
}
