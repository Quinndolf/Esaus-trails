// Runs Esau against the sample spots on the synthetic hollow and writes a transcript.
//   npm run esau:spots            calls Claude (needs ANTHROPIC_API_KEY)
//   npm run esau:spots -- --dry   writes only the field reports Esau would hear
import { writeFileSync } from "node:fs";
import { buildBrief } from "../../src/esau/brief";
import { SAMPLE_SPOTS } from "../../src/esau/fixtures/spots";
import { offlineRead } from "../../src/esau/offline";
import { askClaude } from "./ask";

const dry = process.argv.includes("--dry") || !process.env.ANTHROPIC_API_KEY;
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1]! : "esau-sample-spots.md";

const parts: string[] = [`# Esau sample spots${dry ? " (dry run: field reports only)" : ""}\n`];
for (const s of SAMPLE_SPOTS) {
  const b = buildBrief(s.query);
  parts.push(`## ${s.name}\n\n**Looking for:** ${s.expect}\n\n**Field report:**\n\n\`\`\`\n${b.report}\n\`\`\`\n`);
  parts.push(`**Offline read:** ${offlineRead(b).say}\n`);
  if (!dry) {
    const r = await askClaude(s.query);
    parts.push(
      `**Esau (${r.confidence}, ${r.spotRole}):** ${r.say}\n\n*${r.headline}* · would change his mind: ${r.wouldChangeMyMind.join("; ")}\n\n` +
        `Marks: ${r.marks.map((m) => `${m.kind} "${m.label}"`).join(", ") || "none"} · ${r.meta.servedBy}, ${r.meta.ms} ms, ${r.meta.inputTokens} in / ${r.meta.outputTokens} out\n`,
    );
  }
  console.log(`done: ${s.name}`);
}
writeFileSync(out, parts.join("\n"));
console.log(`wrote ${out}`);
