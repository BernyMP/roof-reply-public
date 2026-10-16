import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateRescueKit } from "../lib/pdf/generate-rescue-kit";
import { trackingCsv } from "../lib/rescue-kit";

async function main() {
const directory = resolve("public/downloads");
await mkdir(directory, { recursive: true });
const pdf = generateRescueKit();
await writeFile(resolve(directory, "roofreply-missed-call-rescue-kit.pdf"), Buffer.from(pdf.output("arraybuffer")));
await writeFile(resolve(directory, "roofreply-missed-call-tracking-sheet.csv"), trackingCsv());
console.log(`Rescue Kit assets generated: ${pdf.getNumberOfPages()} PDF pages and a header-only CSV.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
