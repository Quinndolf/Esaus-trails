import * as z from "zod/v4";

/** The JSON Esau answers in. Mirrors EsauReply in src/esau/types.ts, minus `meta`. */
export const EsauAnswer = z.object({
  say: z.string(),
  headline: z.string(),
  confidence: z.enum(["low", "fair", "good"]),
  spotRole: z.enum(["bedding", "feeding", "travel", "staging", "security cover", "open ground", "unlikely"]),
  marks: z.array(
    z.object({
      kind: z.enum(["bedding", "feeding", "travel", "stand", "approach", "avoid"]),
      lat: z.number(),
      lng: z.number(),
      label: z.string(),
    }),
  ),
  wouldChangeMyMind: z.array(z.string()),
});

export type EsauAnswer = z.infer<typeof EsauAnswer>;
