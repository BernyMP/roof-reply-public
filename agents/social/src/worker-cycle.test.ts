import { test } from "node:test";
import assert from "node:assert/strict";
import { workerCycle, type ClaimReceipt, type WorkerCycle } from "./worker-cycle.ts";
import type { WorkerJournal } from "./local-worker.ts";

function fixture() {
  let journal: WorkerJournal | null = null;
  let receipt: ClaimReceipt | null = null;
  const calls = { claims: 0, dispatches: 0, binds: 0 };
  const io: WorkerCycle = {
    workerId: "mac", token: () => "claim-token", now: () => 100,
    read: async () => structuredClone(journal),
    save: async value => { journal = structuredClone(value); },
    clear: async () => { journal = null; },
    heartbeat: async () => ({ state: "ready" }),
    receipt: async () => receipt,
    claim: async () => { calls.claims++; receipt = { runId: "run", status: "running", deadline: 1000 }; return receipt; },
    context: async () => ({ run: { version: 0 }, drafts: [] }),
    dispatch: async () => { calls.dispatches++; assert.equal(journal?.phase, "dispatching"); return "session"; },
    bind: async (_run, sessionId) => { calls.binds++; receipt = { ...receipt!, sessionId }; },
  };
  return { io, calls, journal: () => journal, setReceipt: (value: ClaimReceipt) => { receipt = value; } };
}

test("lost claim response recovers the same receipt across a worker restart", async () => {
  const f = fixture();
  const claim = f.io.claim;
  f.io.claim = async token => { await claim(token); throw new Error("response lost"); };
  await assert.rejects(workerCycle(f.io), /response lost/);
  assert.equal(f.journal()?.phase, "claiming");
  await workerCycle({ ...f.io });
  assert.deepEqual(f.calls, { claims: 1, dispatches: 1, binds: 1 });
  assert.equal(f.journal()?.sessionId, "session");
});

test("uncertain dispatch waits for its binding receipt and never creates another session", async () => {
  const f = fixture();
  f.io.dispatch = async () => { f.calls.dispatches++; throw new Error("dispatch response lost"); };
  await assert.rejects(workerCycle(f.io), /dispatch response lost/);
  await workerCycle({ ...f.io });
  assert.equal(f.calls.dispatches, 1);
  assert.equal(f.journal()?.phase, "dispatching");
  f.setReceipt({ runId: "run", sessionId: "persisted-eve-session", status: "running", deadline: 1000 });
  await workerCycle({ ...f.io });
  assert.equal(f.journal()?.sessionId, "persisted-eve-session");
  assert.equal(f.calls.dispatches, 1);
});

test("a persisted session retries only its failed cloud binding after restart", async () => {
  const f = fixture();
  const bind = f.io.bind;
  f.io.bind = async () => { throw new Error("offline"); };
  await assert.rejects(workerCycle(f.io), /offline/);
  assert.equal(f.journal()?.sessionId, "session");
  await workerCycle({ ...f.io, bind });
  assert.equal(f.calls.dispatches, 1);
  assert.equal(f.calls.binds, 1);
});

test("offline and blocked workers leave queued work unclaimed", async () => {
  const f = fixture();
  await assert.rejects(workerCycle({ ...f.io, heartbeat: async () => { throw new Error("offline"); } }), /offline/);
  await workerCycle({ ...f.io, heartbeat: async () => ({ state: "blocked" }) });
  assert.equal(f.journal(), null);
  assert.equal(f.calls.claims, 0);
});

test("expired, cancelled and finished claims are cleared without redispatch", async () => {
  for (const terminal of [{ status: "cancelled" }, { deadline: 99 }, { finished: true }]) {
    const f = fixture();
    await f.io.save({ workerId: "mac", token: "claim-token", runId: "run", phase: "dispatching" });
    f.setReceipt({ runId: "run", status: "running", deadline: 1000, ...terminal });
    await workerCycle(f.io);
    assert.equal(f.journal(), null);
    assert.equal(f.calls.dispatches, 0);
  }
});
