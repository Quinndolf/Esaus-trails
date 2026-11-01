// Screenshots every screen of the app at phone size, using fake data.
// Usage: npm run preview:shots   (needs the dev server on :5173 and Playwright)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { SPOT, tilePng, groundGrid } from './fixtures.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(require('node:path').join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:5173/';
const OUT = process.env.PREVIEW_OUT ?? 'preview-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  geolocation: { latitude: SPOT.lat, longitude: SPOT.lng }, permissions: ['geolocation'],
});
// No internet needed: fake tiles, fake ground, and a 503 so Esau answers from his built-in rules.
await ctx.route(/arcgisonline|basemaps|tile|openstreetmap|opentopomap/i, (r) =>
  r.request().url().startsWith(BASE) ? r.fallback() : r.fulfill({ contentType: 'image/png', body: tilePng(/topo/i.test(r.request().url()) ? 'topo' : 'sat') }));
await ctx.route('**/api/ground*', (r) => r.fulfill({ json: groundGrid(new URL(r.request().url())) }));
await ctx.route('**/api/esau', (r) => r.fulfill({ status: 503, json: { error: 'preview' } }));
await ctx.route(/api\.open-meteo|api\.weather\.gov/, (r) => r.abort());

const page = await ctx.newPage();
const failed = [];
let n = 0;
const snap = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };
const step = async (name, fn) => { try { await fn(); await snap(name); } catch (e) { failed.push(name); console.log('FAILED', name, '-', e.message.split('\n')[0]); } };
const click = (sel) => page.locator(sel).first().click({ timeout: 4000 });
const close = () => page.getByLabel('Close', { exact: true }).first().click({ timeout: 2000 }).catch(() => {});

await page.goto(BASE); await page.waitForTimeout(2500);
await page.locator('[data-testid=tutorial-skip]').click({ timeout: 2000 }).catch(() => {});
await snap('first-open');
const pickAnimal = async (id, weapon) => { await click('[data-testid=animal-chip]'); await click(`[data-testid=animal-${id}]`); if (weapon) await click(`[data-testid=weapon-${weapon}]`); };
await pickAnimal('whitetail', 'crossbow');
await page.waitForTimeout(2500);
await snap('home-with-hour-slider');
await step('hour-slider-evening', () => page.locator('[data-testid=hour-bar] input[type=range]').first().fill('9'));
await snap('home-clean-map');
await step('compass-mode', () => click('[aria-label^="My location"]'));
await click('[aria-label^="Compass on"]').catch(() => {});
await step('map-layers', () => click('[aria-label="Map Layers"]'));
await step('layer-view-options', () => page.getByText('Government Lands').first().click({ timeout: 3000 }));
await close(); await page.getByLabel('Back').first().click({ timeout: 800 }).catch(() => {}); await close();
await step('tools-menu', () => click('[aria-label="Tools"]'));
await step('waypoints-list', () => page.getByText('My Marks', { exact: false }).first().click({ timeout: 3000 })); await close();
await click('[aria-label="Tools"]'); await step('photos', () => page.getByText('Photos').first().click({ timeout: 3000 })); await close();
await click('[aria-label="Tools"]'); await step('calls', () => page.getByText('Calls').first().click({ timeout: 3000 })); await close();
await click('[aria-label="Tools"]'); await step('measure-tool', () => page.getByText('Measure distance').click({ timeout: 3000 }));
await page.mouse.click(195, 400); await page.mouse.click(250, 520); await snap('measure-two-points');
await page.getByLabel('Close', { exact: false }).first().click({ timeout: 800 }).catch(() => {});
await click('[aria-label="Tools"]').catch(() => {}); await step('mark-my-location', () => page.getByText('Mark my location').click({ timeout: 3000 }));
// Start fresh so no tool or sheet is left open, then tap the ground for Esau's read.
await page.reload(); await page.waitForTimeout(2500);
await page.locator('[data-testid=tutorial-skip]').click({ timeout: 2000 }).catch(() => {});
await pickAnimal('whitetail', 'crossbow').catch(() => {}); await page.waitForTimeout(2500);
await page.mouse.click(150, 560);
await step('esau-reads-spot', () => page.locator('[aria-label="Esau\'s read of this spot"]').waitFor({ timeout: 8000 }));
await step('esau-expanded', () => page.getByLabel('Expand').first().click({ timeout: 3000 }));
await close();
await step('change-animal', () => click('[data-testid=animal-chip]'));
await click('[data-testid=animal-ginseng]').catch(() => {});
await step('ginseng-mode', async () => { await page.waitForTimeout(1500); });

await browser.close();
console.log(failed.length ? `Done with ${failed.length} missed: ${failed.join(', ')}` : 'Done, every screen captured.');
