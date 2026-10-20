/**
 * Local demo session.
 *
 * Used when the backend authentication endpoint is unavailable so the JAAL
 * console can still be demonstrated. It is clearly labelled everywhere in the
 * UI as a SIMULATION session — it is not real authentication security.
 */

const KEY = "jaal.demoSession.v1";

export interface DemoSession {
  name: string;
  email: string;
  mode: "simulation";
  createdAt: number;
}

export function getDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (parsed?.mode !== "simulation") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setDemoSession(
  name: string,
  email: string,
): DemoSession {
  const session: DemoSession = {
    name,
    email,
    mode: "simulation",
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage may be unavailable; session still works in-memory via store */
  }
  return session;
}

export function clearDemoSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
