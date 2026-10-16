import { generationMessage, type WorkerJournal } from "./local-worker.ts";

export type ClaimReceipt = { runId: string; sessionId?: string; status: string; deadline: number; finished?: boolean };
export type WorkerCycle = {
  workerId: string;
  token(): string;
  now(): number;
  read(): Promise<WorkerJournal | null>;
  save(journal: WorkerJournal): Promise<void>;
  clear(): Promise<void>;
  heartbeat(): Promise<{ state: string }>;
  receipt(token: string): Promise<ClaimReceipt | null>;
  claim(token: string): Promise<ClaimReceipt | null>;
  context(runId: string): Promise<{ run: { version: number }; drafts: { version: number; review?: unknown }[] }>;
  dispatch(runId: string, message: string): Promise<string>;
  bind(runId: string, sessionId: string): Promise<void>;
};

// All uncertain operations retain their durable request identity. A restart
// enters this same cycle; it never retries a session-creation request blindly.
export async function workerCycle(io: WorkerCycle) {
  const state = await io.heartbeat();
  let journal = await io.read();
  if (!journal) {
    if (state.state === "blocked") return;
    journal = { workerId: io.workerId, token: io.token(), phase: "claiming" };
    await io.save(journal);
  }
  let receipt = await io.receipt(journal.token);
  if (!receipt) {
    if (journal.phase !== "claiming") throw new Error("Missing persisted claim; operator inspection required.");
    if (state.state === "blocked") return;
    receipt = await io.claim(journal.token);
    if (!receipt) { await io.clear(); return; }
    journal = { ...journal, runId: receipt.runId, phase: "claimed" };
    await io.save(journal);
  } else if (journal.phase === "claiming") {
    journal = { ...journal, runId: receipt.runId, phase: "claimed" };
    await io.save(journal);
  }
  if (receipt.finished || ["failed", "cancelled"].includes(receipt.status) || receipt.deadline <= io.now()) {
    await io.clear(); return;
  }
  if (receipt.sessionId && journal.sessionId !== receipt.sessionId) {
    journal = { ...journal, sessionId: receipt.sessionId, phase: "running" };
    await io.save(journal);
  }
  if (journal.phase === "claimed") {
    const context = await io.context(receipt.runId);
    const draft = context.drafts.find(d => d.version === context.run.version);
    journal = { ...journal, phase: "dispatching" };
    await io.save(journal);
    const sessionId = await io.dispatch(receipt.runId, generationMessage(context.run.version, Boolean(draft && !draft.review)));
    journal = { ...journal, sessionId, phase: "running" };
    await io.save(journal);
    await io.bind(receipt.runId, sessionId);
  } else if (journal.sessionId && !receipt.sessionId) {
    // Recover a successful local dispatch whose cloud binding response was lost.
    await io.bind(receipt.runId, journal.sessionId);
  }
}
