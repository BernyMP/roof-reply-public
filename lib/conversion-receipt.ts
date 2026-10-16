type ReceiptStorage = Pick<Storage, "getItem" | "setItem">;
// Only opaque receipt IDs are stored; never contact details or assessment answers.
export function emitLeadOnce(eventId: string, emit: () => boolean, seen: Set<string>, storage?: ReceiptStorage) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(eventId) || seen.has(eventId)) return false;
  const key = `roofreply-lead-event:${eventId}`;
  try {
    if (storage?.getItem(key)) { seen.add(eventId); return false; }
  } catch { /* In-memory and Meta event-ID deduplication still apply. */ }
  if (!emit()) return false;
  seen.add(eventId);
  try { storage?.setItem(key, "1"); } catch { /* Storage may be unavailable. */ }
  return true;
}
