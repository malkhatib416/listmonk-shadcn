// `file.go:123: message` log lines carry the useful part after the prefix.
const RE_LOG = /(.+?)\.go:\d+:(.+?)$/im;

// The message to toast for a server error event, or null if the event is not one.
export function errorEventMessage(data: string): string | null {
  let d: { type?: string; message?: string } | null;
  try {
    d = JSON.parse(data);
  } catch {
    return null;
  }
  if (!d || d.type !== 'error' || !d.message) return null;
  const m = RE_LOG.exec(d.message.trim());
  return m ? m[2]!.trim() : d.message;
}
