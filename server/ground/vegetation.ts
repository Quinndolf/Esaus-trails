import { PNG } from "pngjs";

/**
 * Overhead-imagery inputs for the food model, both best-effort (a failure leaves the grid without them):
 * - crops: USDA CropScape CDL WMS, decoded from its legend colours
 * - greenness: NAIP colour-infrared from the USGS National Map image service, NDVI = (NIR - red) / (NIR + red)
 * Not yet wired: USFS Forest Type Groups (the grid and food model already accept `forestType`).
 */

type Fetch = typeof fetch;
interface Box { west: number; south: number; east: number; north: number }

/** CDL legend colours for the crops and covers that matter to deer. */
export const CDL_COLORS: [number, [number, number, number]][] = [
  [1, [255, 211, 0]], // corn
  [4, [255, 158, 11]], // sorghum
  [5, [38, 112, 0]], // soybeans
  [24, [165, 112, 0]], // winter wheat
  [36, [255, 165, 226]], // alfalfa
  [37, [165, 245, 141]], // other hay
  [61, [191, 191, 119]], // fallow
  [176, [232, 255, 191]], // grass/pasture
];

export function cdlFromRgb(r: number, g: number, b: number): number {
  let best = 0, bestD = Infinity;
  for (const [code, [cr, cg, cb]] of CDL_COLORS) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = code; }
  }
  return bestD > 30 ** 2 ? 0 : best;
}

/** Per-cell reduce of a PNG that is `scale` times the grid size. */
function reduce<T>(png: Buffer, cols: number, rows: number, scale: number, cell: (px: [number, number, number][]) => T): T[] {
  const img = PNG.sync.read(png);
  const out: T[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const px: [number, number, number][] = [];
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const X = Math.min(img.width - 1, Math.floor(((c * scale + x + 0.5) / (cols * scale)) * img.width));
          const Y = Math.min(img.height - 1, Math.floor(((r * scale + y + 0.5) / (rows * scale)) * img.height));
          const i = (Y * img.width + X) * 4;
          if (img.data[i + 3]! < 128) continue;
          px.push([img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]);
        }
      out.push(cell(px));
    }
  return out;
}

export function cropsFromPng(png: Buffer, cols: number, rows = cols, scale = 4): number[] {
  return reduce(png, cols, rows, scale, (px) => {
    const votes = new Map<number, number>();
    for (const [r, g, b] of px) {
      const code = cdlFromRgb(r, g, b);
      if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
    }
    let best = 0, n = 0;
    for (const [code, k] of votes) if (k > n) { best = code; n = k; }
    // Need a real share of the cell, not a stray pixel.
    return n >= Math.max(2, px.length / 3) ? best : 0;
  });
}

/** Mean NDVI x 100 per cell from a CIR image whose bands are (NIR, red, green). 0 where there are no pixels. */
export function greennessFromPng(png: Buffer, cols: number, rows = cols, scale = 4): number[] {
  return reduce(png, cols, rows, scale, (px) => {
    if (!px.length) return 0;
    let sum = 0;
    for (const [nir, red] of px) sum += nir + red > 0 ? (nir - red) / (nir + red) : 0;
    return Math.round(Math.max(0, (sum / px.length) * 100));
  });
}

async function image(f: Fetch, url: string, host: string): Promise<Buffer> {
  const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
  if (!res.ok) throw new Error(`${host} returned ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("png")) throw new Error(`${host} did not return an image`);
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchCrops(b: Box, f: Fetch = fetch, cols = 32, rows = cols, year = new Date().getFullYear() - 1): Promise<number[]> {
  const url =
    `https://nassgeodata.gmu.edu/CropScapeService/wms_cdlall.cgi?service=WMS&version=1.1.1&request=GetMap` +
    `&layers=cdl_${year}&styles=&srs=EPSG:4326&bbox=${b.west},${b.south},${b.east},${b.north}` +
    `&width=${cols * 4}&height=${rows * 4}&format=image/png&transparent=true`;
  return cropsFromPng(await image(f, url, "nassgeodata.gmu.edu"), cols, rows);
}

export async function fetchGreenness(b: Box, f: Fetch = fetch, cols = 32, rows = cols): Promise<number[]> {
  const url =
    `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?f=image` +
    `&bbox=${b.west},${b.south},${b.east},${b.north}&bboxSR=4326&imageSR=4326&size=${cols * 4},${rows * 4}` +
    `&format=png&bandIds=3,0,1&interpolation=RSP_NearestNeighbor`;
  return greennessFromPng(await image(f, url, "imagery.nationalmap.gov"), cols, rows);
}
