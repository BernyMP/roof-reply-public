import Link from "next/link";
import Image from "next/image";
import { JourneyLink } from "@/components/journey-link";
import { RescueKitDownloads } from "@/components/rescue-kit-downloads";
import { KIT_PROMISE, KIT_SECTIONS, KIT_TITLE, TRACKING_COLUMNS, type KitBlock } from "@/lib/rescue-kit";
import { AUDIT_CTA_URL } from "@/lib/pricing-copy";
import { pageMetadata } from "@/lib/seo";
import "./rescue-kit.css";

export const metadata = pageMetadata("/rescue-kit", "Free Roofing Missed-Call Rescue Kit", KIT_PROMISE);

// The content module contains only approved inline emphasis and one service link.
// React escapes every text segment; no raw Markdown HTML is executed.
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*.*?\*\*|\[[^\]]+\]\(https:\/\/[^)]+\))/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}><Inline text={part.slice(2, -2)} /></strong>;
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if (link && link[2] === AUDIT_CTA_URL) return <JourneyLink key={i} className="rk-audit" href={AUDIT_CTA_URL}>{link[1]} <span aria-hidden="true">↗</span></JourneyLink>;
    return part;
  });
}

function Block({ block }: { block: KitBlock }) {
  if (block.type === "heading") return <h3>{block.text}</h3>;
  if (block.type === "quote") return <blockquote><Inline text={block.text} /></blockquote>;
  if (block.type === "paragraph") return <p><Inline text={block.text} /></p>;
  if (block.type === "columns") return <div className="rk-scroll" tabIndex={0} role="region" aria-label="Copyable tab-separated spreadsheet headings"><pre>{TRACKING_COLUMNS.join("\t")}</pre></div>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return <List>{block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}</List>;
  }
  if (block.type === "table") return (
    <div className="rk-scroll" tabIndex={0} role="region" aria-label={`${block.headers[0]} table`}>
      <table className={block.headers.length > 3 ? "rk-wide-table" : undefined}>
        <thead><tr>{block.headers.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0
          ? <th scope="row" key={j} data-label={block.headers[j]}><Inline text={cell} /></th>
          : <td key={j} data-label={block.headers[j]}><Inline text={cell} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function RescueKitPage() {
  return (
    <div className="rk-page">
      <a className="rk-skip" href="#kit-content">Skip to kit</a>
      <header className="rk-header rk-wrap">
        <Link href="/" className="rk-brand"><Image src="/icon-svg.svg" alt="" width={28} height={28} />RoofReply</Link>
        <span>THE OFFICE FIELD GUIDE / 01</span>
        <a href="#office-plan">Start with your plan <span aria-hidden="true">↓</span></a>
      </header>
      <main id="kit-content" className="rk-wrap">
        <section className="rk-hero" aria-labelledby="kit-title">
          <p className="rk-eyebrow">Free tools for residential roofing teams</p>
          <h1 id="kit-title">The Roofing<br />Missed-Call <em>Rescue Kit.</em></h1>
          <p className="rk-promise">{KIT_PROMISE}</p>
          <RescueKitDownloads />
          <p className="rk-access">No email. No account. No booking required. Read the whole kit below.</p>
          <div className="rk-contents-summary" aria-label="Inside the kit">
            <span><b>01</b> An office plan</span><span><b>02</b> Words to use</span>
            <span><b>03</b> A shared log</span><span><b>04</b> A weekly review</span>
          </div>
        </section>
        <div className="rk-layout">
          <nav className="rk-toc" aria-label="Kit sections">
            <p className="rk-eyebrow">In this kit</p>
            {KIT_SECTIONS.filter((s) => s.id !== "introduction").map((s) => <a key={s.id} href={`#${s.id}`}>{s.title.replace(/^\d\. /, "")}</a>)}
            <p>Use your existing phone, call log, and spreadsheet.</p>
          </nav>
          <article className="rk-article" aria-label={KIT_TITLE}>
            {KIT_SECTIONS.map((section) => <section id={section.id} key={section.id} className={section.id === "managed-follow-up" ? "rk-section rk-service" : "rk-section"}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, i) => <Block key={i} block={block} />)}
            </section>)}
            <aside className="rk-optional">
              <p>Want to explore the numbers? The <JourneyLink href="/calculator">optional missed-call assessment</JourneyLink> uses your inputs and clearly labeled assumptions.</p>
            </aside>
          </article>
        </div>
      </main>
      <footer className="rk-footer rk-wrap"><Link href="/">RoofReply</Link><p>A clear owner. A next action. A way to check.</p><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
    </div>
  );
}
