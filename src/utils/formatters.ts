/** Small formatting helpers shared across the JAAL UI. */

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function truncate(text: string, size = 80): string {
  if (text.length <= size) return text;
  return `${text.slice(0, size - 1)}…`;
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Mask a sensitive-looking indicator for display.
 *
 * Keeps the trailing characters so an investigator can still tell two leads
 * apart at a glance, without the full value being readable over a shoulder.
 * The bullet run is capped so the mask does not leak the exact length.
 *
 * This is a display/privacy control, NOT access control: the full value stays
 * in the case record and copying still returns it. Reveal is always an
 * explicit, per-item user action.
 */
export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "•".repeat(4);
  const visible = trimmed.slice(-4);
  const hidden = "•".repeat(Math.min(trimmed.length - 4, 16));
  return `${hidden}${visible}`;
}
