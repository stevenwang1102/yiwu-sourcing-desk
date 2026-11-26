import { ATP_SESSION_KEY } from "./constants";
import type { AtpKeywordRow, AtpOutcome, AtpSearchResponse } from "./types";

export interface AtpSession {
  v: 1;
  savedAt: string;
  parentSearchId: string;
  keyword: string;
  language: string;
  region: string;
  requestedLanguage: string;
  requestedRegion: string;
  provider: string | null;
  status: string;
  reused: boolean;
  message: string;
  searches: { id: string; provider: string; status: string }[];
  report: {
    rows: AtpKeywordRow[];
    withheldCount: number;
    truncated: boolean;
    outcomes: AtpOutcome[];
    shapeKeys: string[];
    page: number;
    grouped: boolean;
    readAt: string;
  } | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

let cachedRaw: string | null = null;
let cachedSession: AtpSession | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function parseSession(raw: string | null): AtpSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record || record.v !== 1 || typeof record.parentSearchId !== "string" || typeof record.keyword !== "string") return null;
    return parsed as AtpSession;
  } catch {
    return null;
  }
}

export function subscribeAtpSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAtpSession() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ATP_SESSION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

export function getServerAtpSession(): AtpSession | null {
  return null;
}

export function writeAtpSession(session: AtpSession) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  cachedRaw = raw;
  cachedSession = session;
  sessionStorage.setItem(ATP_SESSION_KEY, raw);
  emit();
}

export function clearAtpSession() {
  if (typeof window === "undefined") return;
  cachedRaw = null;
  cachedSession = null;
  sessionStorage.removeItem(ATP_SESSION_KEY);
  emit();
}

export function sessionFromCreate(
  created: AtpSearchResponse,
  request: { language: string; region: string; provider: string | null },
): AtpSession {
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    parentSearchId: created.parentSearchId,
    keyword: created.keyword,
    language: created.language,
    region: created.region,
    requestedLanguage: request.language,
    requestedRegion: request.region,
    provider: request.provider,
    status: created.status,
    reused: created.reused,
    message: created.message,
    searches: created.searches,
    report: null,
  };
}
