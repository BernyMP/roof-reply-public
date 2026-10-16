"use client";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

export function EventDemoStatus({ onSelect }: { onSelect: (phone: string) => void }) {
  const data = useQuery(api.eventDemo.inspect, {});
  const pause = useMutation(api.eventDemo.pause);
  const [error, setError] = useState("");
  if (!data) return null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Event demo usage">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Event demo · {data.enabled ? "Open" : "Paused"}</h2>
        <p className="mt-1 text-sm text-slate-600">{data.participants}/50 phone numbers · {data.attempts} attempts · ${(data.reservedCents / 100).toFixed(2)}/$10 reserved · {data.failures} delivery issues</p>
        <p className="mt-1 text-xs text-slate-500">{data.day} · Resets at midnight Pacific. Reservations are conservative and retained after failures.</p></div>
      <button className="rounded-md border px-3 py-2 text-sm" disabled={!data.enabled} onClick={async () => { try { await pause({}); } catch { setError("Could not pause. Try operator settings."); } }}>Pause demo now</button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {data.sessions.length > 0 && <details className="mt-3 text-sm"><summary>Today's conversations</summary><ul className="mt-2 space-y-1">{data.sessions.map((s) => <li key={s.id}><button className="text-left underline" onClick={() => onSelect(s.phone)}>{s.phone}</button> · {s.state} · {s.messages}/20 messages{s.reason ? ` · ${s.reason}` : ""}</li>)}</ul></details>}
  </section>;
}
