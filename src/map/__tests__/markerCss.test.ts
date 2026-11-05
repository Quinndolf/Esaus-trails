import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
}

describe('map marker CSS', () => {
  it('no marker class overrides MapLibre\'s absolute positioning (a later `position: relative` pushed photo pins off the map in production)', () => {
    const bad: string[] = [];
    for (const f of cssFiles('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (/-marker(?![\w-]*__)/.test(sel) && !/::|:hover/.test(sel) && /(^|;|\s)position:\s*(relative|static|fixed|sticky)/.test(m[2]!)) bad.push(`${f}: ${sel}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no marker element sets rotate/scale/translate/transform itself (they compose with MapLibre\'s transform and send pins flying as the map moves; put them on an inner element)', () => {
    const bad: string[] = [];
    for (const f of cssFiles('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (/\.[\w-]*-marker(?![\w-]*__)(?!\s)/.test(sel.replace(/\s+/g, ' ')) && !sel.includes(' ') && !/::/.test(sel) && /(^|;|\s)(rotate|scale|translate|transform):/.test(m[2]!)) bad.push(`${f}: ${sel}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
