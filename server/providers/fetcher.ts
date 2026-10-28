import { q } from '../db/index.ts';

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public status?: number) {
    super(message);
  }
}

export class NotConfiguredError extends Error {
  constructor(public provider: string, public setup: string) {
    super(`${provider} is not configured`);
  }
}

export function logApi(provider: string, operation: string, ok: boolean, latency: number, detail?: string) {
  try {
    q.run('INSERT INTO api_events (provider, operation, ok, latency_ms, detail) VALUES (?, ?, ?, ?, ?)',
      provider, operation, ok ? 1 : 0, latency, detail?.slice(0, 500) ?? null);
  } catch { /* logging must never break a request */ }
}

/** fetch with timeout + retry on network errors / 5xx / 429. */
export async function fetchJson<T = any>(
  provider: string,
  operation: string,
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 429) {
        throw new ProviderError(provider, `HTTP ${res.status}`, res.status);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logApi(provider, operation, false, Date.now() - started, `HTTP ${res.status} ${text.slice(0, 200)}`);
        throw Object.assign(new ProviderError(provider, `HTTP ${res.status}`, res.status), { final: true });
      }
      const data = (await res.json()) as T;
      logApi(provider, operation, true, Date.now() - started);
      return data;
    } catch (e: any) {
      clearTimeout(timer);
      lastErr = e;
      if (e?.final) throw e;
      logApi(provider, operation, false, Date.now() - started, String(e?.message || e));
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw lastErr instanceof ProviderError ? lastErr : new ProviderError(provider, String((lastErr as any)?.message || lastErr));
}
