import { defineConfig } from 'vite';

export default defineConfig({
  // three.js alone is ~550 kB minified, which is expected for this game.
  build: { chunkSizeWarningLimit: 800 },
});
