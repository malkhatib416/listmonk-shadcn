import path from 'node:path';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { APP_BASE, renderBuiltUrl } from './build-url';

// Go backend used by the dev server proxy (cookie auth is host-scoped, so the
// session from http://localhost:9000 works on http://localhost:5173).
const GO_URL = process.env.LISTMONK_URL ?? 'http://localhost:9000';

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
  experimental: { renderBuiltUrl },
  plugins: [
    tailwindcss(),
    tanstackStart({ router: { basepath: '/' }, spa: { enabled: true } }),
    viteReact(),
  ],
}));
