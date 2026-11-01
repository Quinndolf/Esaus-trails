const MAX_SAY_SENTENCES = 4;

/** Split text into sentences without breaking on decimals ("9.5"), times ("6:40 a.m.") or titles ("Mr."). */
function sentences(text: string): string[] {
  const DOT = "\u0000";
  const guarded = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([ap])\.m\./gi, `$1${DOT}m${DOT}`)
    .replace(/\b(Mr|Mrs|Ms|Dr|St|vs|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\./g, `$1${DOT}`)
    .replace(/\bU\.S\./g, `U${DOT}S${DOT}`)
    .replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  const parts = guarded.match(/[^.!?]+[.!?]*\s*/g) ?? [];
  return parts.map((p) => p.replaceAll(DOT, ".").trim()).filter(Boolean);
}

export const countSentences = (text: string) => sentences(text).length;

/** Esau's short read is at most four sentences; the rest belongs behind "Teach me more". */
export function splitAnswer(text: string, max = MAX_SAY_SENTENCES): { say: string; overflow: string } {
  const s = sentences(text);
  if (s.length <= max) return { say: text.trim(), overflow: "" };
  return { say: s.slice(0, max).join(" "), overflow: s.slice(max).join(" ") };
}
