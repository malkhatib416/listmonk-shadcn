import path from 'node:path';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Go backend used by the dev server proxy (cookie auth is host-scoped, so the
// session from http://localhost:9000 works on http://localhost:5173).
const GO_URL = process.env.LISTMONK_URL ?? 'http://localhost:9000';

// URL prefix the built assets are served under by Go (see cmd/init.go).
const APP_BASE = '/admin/app/';

const PROXIED = [
  '/api',
  '/admin/login',
  '/admin/static',
  '/admin/custom.css',
  '/admin/custom.js',
  '/public',
  '/uploads',
];

export default defineConfig(({ command }) => ({
  base: command === 'build' ? APP_BASE : '/',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    proxy: Object.fromEntries(PROXIED.map((p) => [p, { target: GO_URL }])),
  },
  experimental: {
    // Chunk and preload URLs resolved from JS honor a root-URL sub-path. Go sets
    // window._LM_ROOT when it serves the shell (internal/adminapp/shell.go).
    renderBuiltUrl(filename, { hostType, ssr }) {
      if (hostType === 'js' && !ssr) {
        return {
          runtime: `(window._LM_ROOT||'')+${JSON.stringify(APP_BASE)}+${JSON.stringify(filename)}`,
        };
      }
      return undefined;
    },
  },
  plugins: [tanstackStart({ router: { basepath: '/admin' }, spa: { enabled: true } }), viteReact()],
}));
