import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNws } from "../server/nws";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!(await handleNws(req, res))) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}
