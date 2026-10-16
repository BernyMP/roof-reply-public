/**
 * PDF Design Tokens
 *
 * Print-friendly tokens based on RoofReply's lead-magnet style.
 */

// Base unit for spacing (matches Tailwind's spacing scale: 1 unit = 4px = ~1mm)
export const spacing = {
  1: 1,      // 4px
  2: 2,      // 8px
  3: 3,      // 12px
  4: 4,      // 16px
  5: 5,      // 20px
  6: 6,      // 24px - p-6 equivalent
  8: 8,      // 32px - p-8 equivalent
  10: 10,    // 40px
  12: 12,    // 48px
} as const;

export const layout = {
  // Page dimensions (US Letter: 215.9mm x 279.4mm) — matches the design's
  // `@page { size: letter }`.
  pageWidth: 215.9,
  pageHeight: 279.4,

  // Margins tuned for a single-page report (design uses 0.7in side padding).
  margin: 17,

  // Content area
  get contentWidth() {
    return this.pageWidth - (this.margin * 2);
  },

  // Card properties
  cardRadius: 3.5,
  cardPadding: 6, // p-6 = 24px = ~6mm
  cardGap: 4,     // gap-4 = 16px = ~4mm
} as const;

// Mapped 1:1 to the design.html hex values.
export const colors = {
  bg: { r: 233, g: 227, b: 215 },          // #E9E3D7 page background
  surface: { r: 251, g: 246, b: 236 },     // #FBF6EC light text on dark cards
  surfaceStrong: { r: 252, g: 250, b: 244 }, // #FCFAF4 card / tile fills
  line: { r: 226, g: 216, b: 197 },        // #E2D8C5 card + tile borders
  lineStrong: { r: 210, g: 199, b: 180 },  // #D2C7B4 dividers
  ink: { r: 26, g: 23, b: 20 },            // #1A1714
  muted: { r: 116, g: 105, b: 92 },        // #74695C body subtext
  muted2: { r: 138, g: 126, b: 108 },      // #8A7E6C kicker / sublabels
  faint: { r: 160, g: 147, b: 127 },       // #A0937F funnel detail
  softMuted: { r: 156, g: 143, b: 124 },   // #9C8F7C footer
  accent: { r: 238, g: 90, b: 23 },        // #EE5A17
  accentDark: { r: 200, g: 67, b: 12 },    // #C8430C
  accentSoft: { r: 251, g: 230, b: 216 },  // #FBE6D8 badge fill
  badgeBorder: { r: 243, g: 201, b: 174 }, // #F3C9AE
  badgeText: { r: 184, g: 67, b: 14 },     // #B8430E
  blue: { r: 29, g: 66, b: 102 },          // #1D4266 logo house
  dark: { r: 22, g: 19, b: 15 },           // #16130F dark cards
  dark2: { r: 42, g: 36, b: 29 },          // subtle dark-card border
  darkMuted: { r: 182, g: 171, b: 151 },   // #B6AB97 dark-card subtext
  darkLabel: { r: 169, g: 156, b: 134 },   // #A99C86 dark-card eyebrow
  miniAccentLabel: { r: 232, g: 150, b: 95 }, // #E8965F
  ctaCopy: { r: 188, g: 177, b: 157 },     // #BCB19D
  white: { r: 255, g: 255, b: 255 },
} as const;

// Typography (matching Tailwind text sizes)
// Tailwind: text-sm = 14px, text-lg = 18px, text-xl = 20px, text-2xl = 24px, text-3xl = 30px
// In PDF pts: 14px ≈ 10.5pt, 18px ≈ 13.5pt, etc. (1px ≈ 0.75pt)
export const typography = {
  // Font sizes in points (matching frontend)
  textXs: 8,       // text-xs (12px)
  textSm: 10,      // text-sm (14px) - labels, subtext
  textBase: 11,    // text-base (16px)
  textLg: 13,      // text-lg (18px) - h2 font-semibold
  textXl: 15,      // text-xl (20px) - h2 font-semibold
  text2xl: 18,     // text-2xl (24px) - metric values
  text3xl: 22,     // text-3xl (30px) - large metrics
  text4xl: 28,     // text-4xl/5xl - hero headline
  display: 24,     // hero headline (design 34px Archivo)
} as const;

export type RGB = { r: number; g: number; b: number };
