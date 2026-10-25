import type { IncomingMessage, ServerResponse } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { EsauInputError } from "../../src/esau/brief";
import type { SpotQuery } from "../../src/esau/types";
import { askClaude, type AskConfig } from "./ask";

const MAX_BODY = 12 * 1024 * 1024; // photos ride along as base64

// Every call spends Claude credit, so keep strangers and runaway loops off the endpoint.
const PER_MINUTE = Number(process.env.ESAU_RATE_PER_MIN || 20);
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > PER_MINUTE;
}

function originAllowed(req: IncomingMessage): boolean {
  const allowed = (process.env.ESAU_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  // Same-origin requests from the app (and curl) send no Origin header.
  return !origin || !allowed.length || allowed.includes(origin);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new EsauInputError("request too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new EsauInputError("body is not JSON");
  }
}

function validate(body: unknown): SpotQuery {
  const q = body as Partial<SpotQuery> | null;
  if (!q || typeof q !== "object") throw new EsauInputError("body must be an object");
  if (typeof q.species !== "string") throw new EsauInputError("species is required");
  if (!q.spot || typeof q.spot.lat !== "number" || typeof q.spot.lng !== "number") throw new EsauInputError("spot {lat,lng} is required");
  if (!q.grid || typeof q.grid !== "object") throw new EsauInputError("grid is required");
  if (q.question && q.question.length > 2000) throw new EsauInputError("question is too long");
  return q as SpotQuery;
}

/** POST /api/esau. Returns true when it handled the request. */
export async function handleEsau(req: IncomingMessage, res: ServerResponse, cfg: AskConfig = {}): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/esau") return false;
  if (req.method !== "POST") {
    send(res, 405, { error: "POST only" });
    return true;
  }
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket.remoteAddress || "?";
  if (!originAllowed(req)) {
    send(res, 403, { error: "origin not allowed" });
    return true;
  }
  if (rateLimited(ip)) {
    send(res, 429, { error: "Slow down a little. Esau needs a minute." });
    return true;
  }
  try {
    const q = validate(await readJson(req));
    if (!cfg.client && !process.env.ANTHROPIC_API_KEY) {
      send(res, 503, { error: "Esau isn't set up on this server yet (no ANTHROPIC_API_KEY)" });
      return true;
    }
    send(res, 200, await askClaude(q, cfg));
  } catch (err) {
    if (err instanceof EsauInputError) send(res, 400, { error: err.message });
    else if (err instanceof Anthropic.AuthenticationError) send(res, 503, { error: "Esau's API key is missing or wrong on the server" });
    else if (err instanceof Anthropic.RateLimitError) send(res, 429, { error: "Esau's busy. Try again in a minute." });
    else if (err instanceof Anthropic.APIConnectionError) send(res, 502, { error: "The server couldn't reach Claude" });
    else if (err instanceof Anthropic.APIError) send(res, 502, { error: `Claude API error ${err.status}` });
    else {
      console.error("esau:", err);
      send(res, 500, { error: "Esau hit a snag" });
    }
  }
  return true;
}
