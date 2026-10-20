/**
 * Backend API service layer.
 *
 * All backend communication goes through this module so components never call
 * fetch directly. When no backend is configured or it is unreachable, callers
 * fall back to the local simulation services behind the same interface.
 *
 * Configure with:  VITE_API_BASE_URL=http://localhost:5000/api
 */

import type { EvidenceItem } from "@/types/evidence";
import type { ConversationMessage } from "@/types/message";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type BackendStatus = "unconfigured" | "checking" | "online" | "offline";

// ---- Typed wire models -----------------------------------------------------

export interface ApiSessionRequest {
  title: string;
  category: string;
  source: string;
  detectionMode: string;
}

export interface ApiSession {
  id: string;
  status: string;
  createdAt: string;
}

export interface ApiMessageRequest {
  sessionId: string;
  author: "scammer" | "decoy";
  text: string;
}

export interface ApiVerifyRequest {
  evidenceId: string;
  content: string;
}

export interface ApiVerifyResponse {
  evidenceId: string;
  match: boolean;
  hash: string;
}

export interface ApiReportResponse {
  id: string;
  payload: unknown;
}

// ---- Core fetch with timeout + retry ---------------------------------------

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { timeout = 4000, retries = 1 }: { timeout?: number; retries?: number } = {},
): Promise<T> {
  if (!API_BASE) throw new ApiError("VITE_API_BASE_URL not configured");

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && err.status && err.status < 500) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError("Request failed");
}

export const isConfigured = () => API_BASE.length > 0;

/** Probe the backend once at startup to power the connection indicator. */
export async function probeBackend(): Promise<BackendStatus> {
  if (!API_BASE) return "unconfigured";
  try {
    await request<unknown>("/health", {}, { timeout: 2500, retries: 0 });
    return "online";
  } catch {
    return "offline";
  }
}

// ---- Endpoints (each returns null when unavailable) ------------------------

export const api = {
  createSession(body: ApiSessionRequest) {
    return request<ApiSession>("/session", { method: "POST", body: JSON.stringify(body) });
  },
  sendMessage(body: ApiMessageRequest) {
    return request<ConversationMessage>("/message", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  getSession(id: string) {
    return request<ApiSession>(`/session/${encodeURIComponent(id)}`);
  },
  getSessionEvidence(id: string) {
    return request<EvidenceItem[]>(`/session/${encodeURIComponent(id)}/evidence`);
  },
  verifyEvidence(sessionId: string, body: ApiVerifyRequest) {
    return request<ApiVerifyResponse>(
      `/session/${encodeURIComponent(sessionId)}/verify`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },
  getReport(id: string) {
    return request<ApiReportResponse>(`/report/${encodeURIComponent(id)}`);
  },
};

/** Best-effort call: returns null instead of throwing when the backend is down. */
export async function tryApi<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}
