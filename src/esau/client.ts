import { buildBrief } from "./brief";
import { offlineRead } from "./offline";
import type { EsauReply, SpotQuery } from "./types";

export interface AskOptions {
  /** Defaults to same-origin /api/esau (Vite proxies it in dev). */
  endpoint?: string;
  signal?: AbortSignal;
  /** Give up on the network and answer offline after this long. */
  timeoutMs?: number;
}

/** Say why Esau fell back, so "offline" never hides a server problem. */
function withWhy(reply: EsauReply, why: string): EsauReply {
  console.warn("Esau fell back to the offline read:", why);
  return { ...reply, meta: { ...reply.meta, offlineWhy: why } };
}

export class EsauApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Ask Esau about a spot. Falls back to the offline rules read when the phone has no service
 * or the server can't reach Claude,
 * and marks that reply with `meta.servedBy = "offline-rules"`.
 * Throws EsauApiError for problems the hunter can't fix by finding signal (bad input, server errors).
 */
export async function askEsau(q: SpotQuery, opts: AskOptions = {}): Promise<EsauReply> {
  const brief = buildBrief(q); // validates input up front, and gives the offline answer if needed
  if (typeof navigator !== "undefined" && navigator.onLine === false) return offlineRead(brief);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  opts.signal?.addEventListener("abort", () => ctrl.abort());
  let res: Response;
  try {
    res = await fetch(opts.endpoint ?? "/api/esau", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(q),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return withWhy(offlineRead(brief), `couldn't reach the server (${err instanceof Error ? err.message : "network error"})`);
  } finally {
    clearTimeout(timer);
  }
  // Server can't reach Claude right now: the short offline read beats an error in the timber.
  const body = await res.json().catch(() => ({}));
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return withWhy(offlineRead(brief), `${res.status}: ${body.detail ?? body.error ?? "server error"}`);
  }
  if (!res.ok) throw new EsauApiError(body.error ?? `Esau couldn't answer (${res.status})`, res.status);
  return body as EsauReply;
}
