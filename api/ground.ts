import type { IncomingMessage, ServerResponse } from "node:http";
import { handleGround } from "../server/ground/route";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!(await handleGround(req, res))) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}
