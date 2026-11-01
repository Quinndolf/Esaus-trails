import { describe, expect, it } from "vitest";
import { buildBrief } from "../brief";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { offlineRead } from "../offline";
import { ESAU_PERSONA } from "../persona";
import { countSentences, splitAnswer } from "../answer";

describe("splitAnswer", () => {
  it("keeps four sentences and moves the rest to overflow", () => {
    const r = splitAnswer("One. Two. Three. Four. Five. Six.");
    expect(r.say).toBe("One. Two. Three. Four.");
    expect(r.overflow).toBe("Five. Six.");
  });
  it("leaves a short answer alone", () => {
    expect(splitAnswer("Bed on the bench. Wind's wrong.")).toEqual({ say: "Bed on the bench. Wind's wrong.", overflow: "" });
  });
  it("does not split on numbers or abbreviations", () => {
    const r = splitAnswer("He's 40 yd off at 9.5 mph. Mr. Buck beds at 6:40 a.m. Three. Four. Five.");
    expect(countSentences(r.say)).toBe(4);
    expect(r.say).toContain("9.5 mph");
  });
});

describe("persona", () => {
  it("leads with what the animal is doing now, keeps the short read short, and teaches only in `more`", () => {
    expect(ESAU_PERSONA).toMatch(/what the animal is doing right now/i);
    expect(ESAU_PERSONA).toMatch(/two to four (short )?sentences/i);
    expect(ESAU_PERSONA).toMatch(/\bmore\b.*teach|teach.*\bmore\b/is);
    expect(ESAU_PERSONA).not.toMatch(/scripture|bible|genesis/i);
  });
});

describe("offline read", () => {
  it("is 2 to 4 sentences with a `more` body", () => {
    const r = offlineRead(buildBrief(SAMPLE_SPOTS[1]!.query));
    expect(countSentences(r.say)).toBeGreaterThanOrEqual(2);
    expect(countSentences(r.say)).toBeLessThanOrEqual(4);
    expect(r.more.length).toBeGreaterThan(20);
  });
});
