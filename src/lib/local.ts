// Local value generators for new nodes and timestamps.

/** A fresh UUID for a new node. */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Current time as an ISO local date-time without zone or milliseconds
 * (e.g. "2026-06-10T12:00:00") so the NamDesktop Jackson `LocalDateTime`
 * deserializer can parse it. (Value is UTC wall-clock; acceptable for the MVP.)
 */
export function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}
