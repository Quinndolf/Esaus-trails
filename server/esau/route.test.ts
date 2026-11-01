import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { SAMPLE_SPOTS } from "../../src/esau/fixtures/spots";
import { handleEsau } from "./route";

function call(body: unknown) {
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    url: "/api/esau",
    method: "POST",
    headers: {},
    socket: { remoteAddress: "test" },
  });
  let status = 0;
  let out = "";
  const res = { writeHead: (s: number) => void (status = s), end: (b: string) => void (out = b) };
  return handleEsau(req as never, res as never, { client: {} as never }).then(() => ({ status, body: JSON.parse(out) }));
}

describe("POST /api/esau privacy", () => {
  it("refuses a request that carries a photo", async () => {
    const r = await call({ ...SAMPLE_SPOTS[0]!.query, photo: { image: null, name: "x" } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("never sent");
  });
  it("refuses a request that carries the hunter's marks", async () => {
    const r = await call({ ...SAMPLE_SPOTS[0]!.query, pins: [{ id: "a" }] });
    expect(r.status).toBe(400);
  });
});
