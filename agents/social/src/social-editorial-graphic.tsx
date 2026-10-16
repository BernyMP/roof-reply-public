import type { CSSProperties, ReactNode } from "react";
import type { SocialGraphic } from "./social-content.ts";

const ink = "#142c32",
  paper = "#f4f0e6",
  orange = "#f7a66c",
  muted = "#607477";
const column: CSSProperties = { display: "flex", flexDirection: "column" };
function RoofMark({ color = ink }: { color?: string }) {
  return (
    <svg width="56" height="42" viewBox="0 0 56 42">
      <path
        d="M4 25L28 5L52 25M12 23V38H44V23"
        stroke={color}
        strokeWidth="5"
        fill="none"
      />
    </svg>
  );
}
function Header({
  dark = false,
  label = "THE ROOFING FIELD NOTES",
}: {
  dark?: boolean;
  label?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <RoofMark color={dark ? paper : ink} />
        <span style={{ fontSize: 31, fontWeight: 700 }}>RoofReply.</span>
      </div>
      <span style={{ fontSize: 17, letterSpacing: 3 }}>{label}</span>
    </div>
  );
}
function Footer({
  dark = false,
  photo = false,
}: {
  dark?: boolean;
  photo?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "auto",
        paddingTop: 28,
        borderTop: `1px solid ${dark ? "#496066" : "#bfc7bf"}`,
        color: dark ? "#bcc9c8" : ink,
        fontSize: 19,
      }}
    >
      <span>BETTER FOLLOW-UP STARTS WITH A CLEAR PROCESS.</span>
      <span>{photo ? "ILLUSTRATIVE ARTWORK" : "roofreply.com"}</span>
    </div>
  );
}
function Title({
  children,
  size = 88,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.02,
        letterSpacing: -4,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </div>
  );
}
function RoofDiagram() {
  return (
    <svg width="870" height="340" viewBox="0 0 870 340">
      <path
        d="M60 245L360 35L670 245M155 183V310H575V183M550 150V55H610V193"
        fill="none"
        stroke={ink}
        strokeWidth="9"
      />
      <path
        d="M360 35L810 90L670 245M670 245L810 90M155 310H575M224 310V213H316V310M408 213H500V273H408Z"
        fill="none"
        stroke={ink}
        strokeWidth="4"
      />
      <path
        d="M360 75L727 120M310 110L693 160M255 150L655 200"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        opacity=".5"
      />
    </svg>
  );
}

// Fixed geometry keeps text legible while the agent chooses the editorial form.
// Photo sources are bundled and owned; the model cannot inject arbitrary URLs.
export function EditorialGraphic({
  graphic: g,
  roofImage,
}: {
  graphic: SocialGraphic;
  roofImage: string;
}) {
  const layout = g.design ?? "cover";
  const dark = ["split", "flow"].includes(layout);
  const root: CSSProperties = {
    ...column,
    width: "100%",
    height: "100%",
    background: layout === "statement" ? orange : dark ? ink : paper,
    color: dark ? paper : ink,
    fontFamily: "Barlow",
    overflow: "hidden",
  };
  if (
    [
      "comparison",
      "script",
      "decision",
      "annotated",
      "story",
      "calculation",
    ].includes(layout)
  ) {
    const labels = g.labels ?? [];
    const accent = layout === "script" || layout === "story";
    return (
      <div
        style={{
          ...root,
          background: accent ? ink : paper,
          color: accent ? paper : ink,
          padding: "54px 64px 36px",
        }}
      >
        <Header
          dark={accent}
          label={g.evidenceLabel ?? "THE ROOFING FIELD NOTES"}
        />
        <div style={{ display: "flex", marginTop: 60 }}>
          <Title
            size={
              layout === "annotated" ? 64 : g.headline.length > 44 ? 72 : 86
            }
          >
            {g.headline}
          </Title>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 29,
            lineHeight: 1.35,
            marginTop: 25,
            marginBottom: 38,
            color: accent ? "#cfdbd7" : muted,
          }}
        >
          {g.body}
        </div>
        {layout === "comparison" ? (
          <div
            style={{
              display: "flex",
              gap: 24,
              flex: 1,
              alignItems: "flex-start",
            }}
          >
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  ...column,
                  flex: 1,
                  padding: "28px 28px 38px",
                  minHeight: 420,
                  background: i ? ink : "#e2e4da",
                  color: i ? paper : ink,
                  borderTop: `8px solid ${i ? orange : muted}`,
                }}
              >
                <span
                  style={{ fontSize: 23, fontWeight: 700, marginBottom: 30 }}
                >
                  {labels[i]}
                </span>
                <span style={{ fontSize: 36, lineHeight: 1.32 }}>{item}</span>
              </div>
            ))}
          </div>
        ) : layout === "script" ? (
          <div
            style={{
              ...column,
              flex: 1,
              justifyContent: "center",
              padding: "18px 10px 75px",
            }}
          >
            <span style={{ fontSize: 24, color: orange, letterSpacing: 2 }}>
              {labels[0]}
            </span>
            <span
              style={{
                fontSize: 100,
                lineHeight: 1,
                color: orange,
                marginTop: 20,
              }}
            >
              “
            </span>
            <span style={{ fontSize: 49, lineHeight: 1.32 }}>{g.items[0]}</span>
            <span
              style={{
                fontSize: 100,
                lineHeight: 1,
                color: orange,
                alignSelf: "flex-end",
              }}
            >
              ”
            </span>
          </div>
        ) : layout === "story" ? (
          <div style={{ ...column, gap: 22, flex: 1 }}>
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  ...column,
                  marginLeft: i === 1 ? 90 : 0,
                  marginRight: i === 1 ? 0 : 50,
                  padding: "24px 30px",
                  background: i === 2 ? orange : "#29464d",
                  color: i === 2 ? ink : paper,
                  borderRadius: 20,
                }}
              >
                <span
                  style={{ fontSize: 21, marginBottom: 12, fontWeight: 700 }}
                >
                  {labels[i]}
                </span>
                <span style={{ fontSize: 35, lineHeight: 1.25 }}>{item}</span>
              </div>
            ))}
          </div>
        ) : layout === "decision" ? (
          <div style={{ ...column, gap: 24, flex: 1 }}>
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderBottom: "1px solid #bfc7bf",
                  paddingBottom: 24,
                  gap: 25,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 210,
                    flexShrink: 0,
                    padding: 20,
                    background: i === 1 ? ink : orange,
                    color: i === 1 ? paper : ink,
                    fontSize: 29,
                    fontWeight: 700,
                  }}
                >
                  {labels[i]}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 35,
                    lineHeight: 1.25,
                    flex: 1,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        ) : layout === "calculation" ? (
          <div style={{ ...column, flex: 1, gap: 26 }}>
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  ...column,
                  padding: "22px 28px",
                  background: i === 1 ? orange : "#e3e6dd",
                }}
              >
                <span style={{ fontSize: 22, marginBottom: 10 }}>
                  {labels[i]}
                </span>
                <span
                  style={{
                    fontSize: i === 1 ? 58 : 36,
                    lineHeight: 1.25,
                    fontWeight: i === 1 ? 700 : 400,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...column, flex: 1 }}>
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 24,
                  padding: "12px 0",
                  borderTop: "1px solid #bfc7bf",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 42,
                    height: 42,
                    flexShrink: 0,
                    borderRadius: 50,
                    background: orange,
                    fontSize: 25,
                    fontWeight: 700,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <div style={{ ...column, width: 886, flexShrink: 1 }}>
                  <span style={{ fontSize: 20, color: muted, marginBottom: 6 }}>
                    {labels[i]}
                  </span>
                  <span style={{ fontSize: 30, lineHeight: 1.2 }}>{item}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Footer dark={accent} />
      </div>
    );
  }
  if (layout === "cover")
    return (
      <div style={root}>
        <div style={{ ...column, padding: "54px 64px 46px", height: 660 }}>
          <Header />
          <div
            style={{
              display: "flex",
              marginTop: 64,
              marginBottom: 24,
              fontSize: 20,
              letterSpacing: 3,
              color: muted,
            }}
          >
            A NOTE FOR ROOFING OWNERS
          </div>
          <Title size={g.headline.length > 42 ? 83 : 99}>{g.headline}</Title>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 29,
              lineHeight: 1.4,
              maxWidth: 845,
            }}
          >
            {g.body}
          </div>
        </div>
        <div style={{ display: "flex", height: 578, position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roofImage}
            width={1080}
            height={578}
            alt="Illustrative residential roof"
            style={{ objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 36,
              left: 64,
              display: "flex",
              background: orange,
              padding: "18px 25px",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            THE WORK DOESN’T STOP AT THE ROOF.
          </div>
        </div>
        <div style={{ ...column, padding: "0 64px 26px", flex: 1 }}>
          <Footer photo />
        </div>
      </div>
    );
  if (layout === "split")
    return (
      <div style={root}>
        <div style={{ ...column, padding: "54px 64px 0" }}>
          <Header dark />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            height: 410,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roofImage}
            width={1080}
            height={410}
            alt="Illustrative residential roof"
            style={{ objectFit: "cover", objectPosition: "center 65%" }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: -1,
              left: 64,
              padding: "16px 22px",
              background: orange,
              color: ink,
              fontSize: 20,
              letterSpacing: 2,
            }}
          >
            FROM THE FIELD TO THE OFFICE
          </div>
        </div>
        <div style={{ ...column, padding: "54px 64px 36px", flex: 1 }}>
          <Title size={g.headline.length > 42 ? 85 : 101}>{g.headline}</Title>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              color: "#cfdbd7",
              fontSize: 31,
              lineHeight: 1.45,
            }}
          >
            {g.body}
          </div>
          <Footer dark photo />
        </div>
      </div>
    );
  if (layout === "statement")
    return (
      <div style={{ ...root, padding: "54px 64px 36px" }}>
        <Header />
        <div
          style={{
            display: "flex",
            marginTop: 100,
            fontSize: 21,
            letterSpacing: 4,
          }}
        >
          A BETTER QUESTION TO ASK
        </div>
        <div style={{ display: "flex", marginTop: 38 }}>
          <Title size={g.headline.length > 42 ? 100 : 116}>{g.headline}</Title>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 32,
            lineHeight: 1.45,
            maxWidth: 840,
          }}
        >
          {g.body}
        </div>
        <div style={{ display: "flex", marginTop: 50, opacity: 0.8 }}>
          <RoofDiagram />
        </div>
        <Footer />
      </div>
    );
  if (layout === "dialogue")
    return (
      <div style={{ ...root, padding: "54px 64px 36px" }}>
        <Header label="AN INTAKE EXAMPLE" />
        <div style={{ display: "flex", marginTop: 65 }}>
          <Title size={81}>{g.headline}</Title>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 25,
            fontSize: 28,
            lineHeight: 1.4,
          }}
        >
          {g.body}
        </div>
        <div
          style={{
            ...column,
            marginTop: 42,
            padding: "32px 36px",
            background: "#e3e6dd",
            borderRadius: 28,
            gap: 23,
          }}
        >
          <span style={{ fontSize: 17, letterSpacing: 2, color: muted }}>
            ILLUSTRATIVE EXAMPLE · FICTIONAL MESSAGES
          </span>
          {g.items.map((item, i) => (
            <div
              key={i}
              style={{
                ...column,
                alignSelf: i === 1 ? "flex-end" : "flex-start",
                maxWidth: "89%",
                padding: "23px 28px",
                borderRadius:
                  i === 1 ? "23px 23px 5px 23px" : "23px 23px 23px 5px",
                background: i === 1 ? ink : "#fffdf8",
                color: i === 1 ? paper : ink,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  letterSpacing: 2,
                  marginBottom: 10,
                  opacity: 0.7,
                }}
              >
                {i === 1 ? "AUTOMATED ASSISTANT" : "HOMEOWNER"}
              </span>
              <span style={{ fontSize: 29, lineHeight: 1.35 }}>{item}</span>
            </div>
          ))}
        </div>
        <Footer />
      </div>
    );
  return (
    <div style={{ ...root, padding: "54px 64px 36px" }}>
      <Header
        dark={dark}
        label={dark ? "FOLLOW-UP, MAPPED" : "THE OWNER’S FIELD GUIDE"}
      />
      <div style={{ display: "flex", marginTop: 70 }}>
        <Title size={g.headline.length > 44 ? 80 : 92}>{g.headline}</Title>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 29,
          fontSize: 28,
          lineHeight: 1.45,
          color: dark ? "#cad7d4" : muted,
        }}
      >
        {g.body}
      </div>
      <div style={{ ...column, marginTop: 52, gap: dark ? 0 : 22 }}>
        {g.items.map((item, i) => (
          <div key={i} style={column}>
            {dark && i > 0 && (
              <div
                style={{
                  display: "flex",
                  height: 33,
                  width: 3,
                  background: orange,
                  marginLeft: 51,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "30px 30px",
                minHeight: 138,
                border: dark ? "1px solid #566b70" : "1px solid #c8cec3",
                background: dark ? "#203c43" : "#fffcf6",
                borderRadius: dark ? 18 : 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  background: orange,
                  color: ink,
                  borderRadius: dark ? 50 : 2,
                  fontSize: 25,
                  fontWeight: 700,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", fontSize: 33, lineHeight: 1.3 }}>
                {item}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Footer dark={dark} />
    </div>
  );
}
