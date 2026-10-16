import { jsPDF } from "jspdf";
import {
  PublicSansRegular,
  PublicSansSemiBold,
  SourceSerifRegular,
} from "./fonts/embedded";
import {
  BRIEF_TITLE,
  OPERATING_COPY,
  HANDOFF_STATUS,
  money,
  count,
  type CoverageGap,
} from "../recovery-brief";
import type {
  CalculatorInputs,
  CalculatorInputKey,
} from "../calculator-estimates";
import {
  buildAssessment,
  DEFAULT_ASSESSMENT,
  type AssessmentAnswers,
} from "../missed-call-assessment";
export interface LegacyReportData extends CalculatorInputs {
  name?: string;
  company?: string;
  coverageGap?: CoverageGap;
  contributionMargin?: number | null;
  providedInputs?: readonly CalculatorInputKey[];
}
export type ReportData =
  | LegacyReportData
  | { assessment: AssessmentAnswers; company?: string; name?: string };
export interface GenerateReportOptions {
  save?: boolean;
  filename?: string;
  sample?: boolean;
  date?: Date;
}
const INK = "#162f42",
  MUTED = "#526473",
  BLUE = "#245e79",
  LINE = "#d5dfe3",
  PAPER = "#fcfcf9",
  TINT = "#edf2f3",
  WHITE = "#ffffff";
const L = 18,
  W = 215.9,
  C = W - L * 2;
const clean = (value: string) =>
  value
    .normalize("NFC")
    .replace(/[\r\n\t\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const printable = (value: string) =>
  clean(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ");

export function generateReport(
  data: ReportData,
  options: GenerateReportOptions = {},
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
    putOnlyUsedFonts: true,
    compress: true,
  });
  doc.addFileToVFS("PublicSans-Regular.ttf", PublicSansRegular);
  doc.addFont("PublicSans-Regular.ttf", "PublicSans", "normal");
  doc.addFileToVFS("PublicSans-SemiBold.ttf", PublicSansSemiBold);
  doc.addFont("PublicSans-SemiBold.ttf", "PublicSans", "bold");
  doc.addFileToVFS("SourceSerif4-Regular.ttf", SourceSerifRegular);
  doc.addFont("SourceSerif4-Regular.ttf", "SourceSerif", "normal");
  const answers: AssessmentAnswers =
    "assessment" in data
      ? data.assessment
      : {
          ...DEFAULT_ASSESSMENT,
          ...data,
          existingRecoveryRate: data.existingRecoveryRate ?? null,
          grossMargin: data.contributionMargin ?? null,
          suppliedRates: (data.providedInputs ?? []).filter(
            (
              k,
            ): k is
              | "realLeadRate"
              | "engagementRate"
              | "qualificationRate"
              | "closeRate" =>
              [
                "realLeadRate",
                "engagementRate",
                "qualificationRate",
                "closeRate",
              ].includes(k),
          ),
        };
  const brief = buildAssessment(answers);
  const e = brief.estimate;
  const company = clean(data.company ?? "").slice(0, 100);
  doc.setProperties({
    title: BRIEF_TITLE,
    subject:
      "Personalized missed-call revenue potential and the process required to pursue it",
    author: "RoofReply",
  });
  const paint = (
    size = 10.5,
    color = INK,
    face = "PublicSans",
    weight = "normal",
  ) => {
    doc.setFont(face, weight);
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.setCharSpace(0);
  };
  const text = (
    s: string,
    x: number,
    y: number,
    size = 10.5,
    color = INK,
    face = "PublicSans",
    weight = "normal",
  ) => {
    paint(size, color, face, weight);
    doc.text(printable(s), x, y, { charSpace: 0 });
  };
  function para(
    s: string,
    x: number,
    y: number,
    width = C,
    size = 10.5,
    color = MUTED,
    face = "PublicSans",
    weight = "normal",
    leading = 1.3,
  ) {
    paint(size, color, face, weight);
    const lines = doc.splitTextToSize(printable(s), width) as string[];
    const lh = size * 0.352778 * leading;
    lines.forEach((line, i) => doc.text(line, x, y + i * lh, { charSpace: 0 }));
    return y + lines.length * lh;
  }
  const box = (
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => {
    doc.setFillColor(color);
    doc.rect(x, y, width, height, "F");
  };
  const line = (y: number, x = L, width = C) => {
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.25);
    doc.line(x, y, x + width, y);
  };
  const label = (s: string, x: number, y: number, color = BLUE) =>
    text(s, x, y, 9, color, "PublicSans", "bold");
  const right = (s: string, x: number, y: number, size = 9, color = MUTED) => {
    paint(size, color);
    doc.text(printable(s), x, y, { align: "right", charSpace: 0 });
  };
  const bound = (y: number, max: number, where: string) => {
    if (y > max)
      throw new Error(`Report layout overflow in ${where}: ${y} > ${max}`);
  };
  function header(page: number) {
    if (page > 1) doc.addPage();
    box(0, 0, W, 279.4, PAPER);
    text("RoofReply", L, 15, 13, INK, "PublicSans", "bold");
    right(
      options.sample ? "ILLUSTRATIVE SAMPLE" : "REVENUE RECOVERY ASSESSMENT",
      W - L,
      15,
    );
    line(21);
    right(`${page} / 2`, W - L, 274, 9);
  }
  function amount(
    s: string,
    x: number,
    y: number,
    width: number,
    start: number,
    color = INK,
  ) {
    let size = start;
    paint(size, color, "SourceSerif");
    while (doc.getTextWidth(s) > width && size > 18) {
      size -= 1;
      paint(size, color, "SourceSerif");
    }
    if (doc.getTextWidth(s) > width)
      throw new Error("Revenue amount exceeds its space");
    doc.text(s, x, y, { charSpace: 0 });
  }
  header(1);
  const nameEnd = para(
    company || "Prepared for your business",
    L,
    30,
    C - 38,
    10.5,
    INK,
  );
  right(
    (options.date ?? new Date()).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    W - L,
    30,
  );
  let y = para(
    "Your missed-call assessment",
    L,
    nameEnd + 6,
    C,
    24,
    INK,
    "SourceSerif",
    "normal",
    1.1,
  );
  y = para(brief.takeaway, L, y + 3, C, 13, INK, "PublicSans", "bold") + 3;
  box(L, y, C, 33, INK);
  label("ESTIMATED REVENUE POTENTIAL", L + 5, y + 7, "#c8dce6");
  if (e) {
    amount(money(e.monthlyRevenue), L + 5, y + 23, 100, 32, WHITE);
    text("per average month", L + 5, y + 29, 9, "#dce8ed");
    amount(money(e.yearlyRevenue), L + 117, y + 22, 57, 22, WHITE);
    text("per year", L + 117, y + 29, 9, "#dce8ed");
  } else {
    text(
      brief.funnel ? "Job value unknown" : "Not yet quantified",
      L + 5,
      y + 22,
      22,
      WHITE,
      "SourceSerif",
    );
  }
  y = para(brief.jobSummary, L, y + 40, C, 11, INK, "PublicSans", "bold");
  y = para(brief.resultExplanation, L, y + 3, C, 9, MUTED);
  if (brief.funnel) {
    const f = brief.funnel;
    y = para(
      `Average month: ${count(f.monthlyMissedCalls)} calls > ${count(f.monthlyLegitimateInquiries)} new inquiries > ${count(f.monthlyEligibleInquiries)} ${f.existingFollowUpKnown ? "unreached" : "before adjustment"} > ${count(f.monthlyConversations)} replies > ${count(f.monthlyQualifiedLeads)} qualified > ${count(f.monthlyClosedJobs)} potential jobs.`,
      L,
      y + 4,
      C,
      9,
    );
    y = para(
      `Annual jobs: ${count(f.yearlyClosedJobs)}. Annual figures use 52 weeks; average month = annual / 12.`,
      L,
      y + 1,
      C,
      9,
    );
  }
  y += 5;
  for (const finding of brief.findings) {
    y = para(finding.title, L, y, C, 10.5, INK, "PublicSans", "bold");
    y = para(finding.evidence, L, y + 1, C, 10.5) + 4;
  }
  y = para("WHAT STILL NEEDS CHECKING", L, y, C, 9, BLUE, "PublicSans", "bold");
  y = para(brief.uncertainty, L, y + 1, C, 10.5) + 4;
  label("INPUTS AND ASSUMPTIONS", L, y);
  y += 6;
  const rows = brief.rows;
  const leftRows = rows.slice(0, Math.ceil(rows.length / 2));
  const rightRows = rows.slice(Math.ceil(rows.length / 2));
  function column(input: typeof rows, x: number) {
    let ry = y;
    for (const row of input) {
      ry = para(row.label, x, ry, 85, 9, MUTED);
      ry = para(`${row.value}  |  ${row.source}`, x, ry, 85, 9, INK) + 2;
    }
    return ry;
  }
  y = Math.max(column(leftRows, L), column(rightRows, L + 95));
  y = para(
    "New inquiries exclude spam, vendors, duplicates and existing customers. Already reached is a share of those new inquiries. Qualified-to-sale is different from quote-to-sale.",
    L,
    y + 3,
    C,
    9,
  );
  bound(y, 267, "assessment page one");

  header(2);
  label("YOUR RECOMMENDED NEXT STEP", L, 31);
  y = para(brief.takeaway, L, 43, C, 23, INK, "SourceSerif", "normal", 1.1);
  y = para(brief.firstAction, L, y + 3, C, 10.5, INK);
  y = para(
    "A useful recovery process reconnects with callers, gathers the roofing details and gives your team a clear next action.",
    L,
    y + 3,
    C,
    10.5,
  );
  const workflowY = y + 8;
  box(L, workflowY, C, 13, TINT);
  [
    "Missed inquiry",
    "Text conversation",
    "Roofing details",
    "Clear handoff",
  ].forEach((s, i) => {
    text(s, L + 4 + i * 45, workflowY + 8, 9, INK, "PublicSans", "bold");
    if (i < 3) text(">", L + 41 + i * 45, workflowY + 8, 9, BLUE);
  });
  const exampleHeadingY = workflowY + 23;
  label("ILLUSTRATIVE CONVERSATION", L, exampleHeadingY);
  label("WHAT REACHES YOUR TEAM", L + 105, exampleHeadingY);
  y = exampleHeadingY + 8;
  brief.conversation.forEach((m, i) => {
    text(m.speaker, L, y, 9, i % 2 ? MUTED : BLUE, "PublicSans", "bold");
    y = para(m.text, L, y + 5, 94, 10.5, INK) + 3;
  });
  let hy = exampleHeadingY + 8;
  brief.handoff.forEach((row) => {
    text(row.label, L + 105, hy, 9, MUTED);
    hy = para(row.value, L + 105, hy + 5, 75, 10.5, INK) + 3;
  });
  hy = para(HANDOFF_STATUS, L + 105, hy, 75, 9);
  y = Math.max(y, hy) + 5;
  line(y);
  y = para(OPERATING_COPY.roofReplyTitle, L, y + 10, C, 19, INK, "SourceSerif");
  y = para(OPERATING_COPY.roofReplyBody, L, y + 2, C, 10.5);
  if (brief.costCopy) {
    y = para(
      brief.grossProfit
        ? `Modeled gross profit: ${money(brief.grossProfit.monthly)}/month; ${money(brief.grossProfit.yearly)}/year, before overhead and service fees. ${brief.costCopy}`
        : brief.costCopy,
      L,
      y + 3,
      C,
      9,
    );
  }
  y += 7;
  text(
    "See the free founding-client offer",
    L,
    y,
    11,
    BLUE,
    "PublicSans",
    "bold",
  );
  doc.link(L, y - 5, 114, 7, { url: "https://www.roofreply.com/specials/pilot?utm_source=report&utm_medium=pdf&utm_campaign=founding_clients" });
  y = para("Review the scope and book a 20-minute fit call if it suits your business.", L, y + 6, C, 9);
  const terms = "First five qualifying companies: free setup and up to 30 days or $100 usage, whichever comes first. Starts at verified activation. No automatic charges; paid continuation agreed separately. Full terms at roofreply.com/pricing.";
  doc.link(L, y + 1, C, 10, { url: "https://www.roofreply.com/pricing" });
  y = para(terms, L, y + 4, C, 9);
  bound(y, 267, "assessment page two");
  if (options.save !== false) {
    const filename = (company || "Your-Business")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
    doc.save(
      options.filename ??
        `RoofReply-Revenue-Recovery-Assessment-${filename}.pdf`,
    );
  }
  return doc;
}
