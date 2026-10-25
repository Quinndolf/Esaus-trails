import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Stamps dist/sw.js with this build's id and every file it shipped, so the
// service worker precaches the whole app and an installed copy runs offline.
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'esau-stamp-sw',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    writeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('/' + relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = ['/', ...files.filter((f) => f !== '/sw.js')];
      const swPath = join(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace(/const BUILD = '[^']*';/, `const BUILD = '${Date.now().toString(36)}';`)
        .replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(precache)};`);
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } },
  },
});
