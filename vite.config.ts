import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } } },
  // Babylon loads GLSL/WGSL modules dynamically. Keep those side-effect registrations
  // in their original modules during development instead of dependency prebundling.
  optimizeDeps: { exclude: ['@babylonjs/core', '@babylonjs/loaders'] },
});
