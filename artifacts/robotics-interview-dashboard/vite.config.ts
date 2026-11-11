import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// The agent briefing lives in public/AGENTS.md and is served at /AGENTS.md.
// Static hosts match paths case-sensitively on Linux, so /agents.md used to
// fall through to the SPA fallback and render the 404 page instead of the
// markdown. This alias serves the same file at the lowercase path in
// dev/preview and copies it into the build output so static hosts have it
// too (the API server also aliases it for already-built bundles).
const agentsMdAlias = (): Plugin => {
  const file = path.resolve(import.meta.dirname, 'public', 'AGENTS.md');
  let outDir = path.resolve(import.meta.dirname, 'dist', 'public');
  const middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const pathname = req.url
      ? new URL(req.url, 'http://localhost').pathname
      : '';
    if (pathname !== '/agents.md') {
      next();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: 'agents-md-alias',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    closeBundle() {
      try {
        if (fs.existsSync(outDir)) {
          fs.copyFileSync(file, path.join(outDir, 'agents.md'));
        }
      } catch {
        // Non-fatal: the API server aliases /agents.md as a fallback.
      }
    },
  };
};

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    agentsMdAlias(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    // Keep the production build inside small Render instances: gzipped-size
    // reporting and sourcemaps are the heaviest parts of the build and
    // OOM'd the free tier (2GB heap, ~5.6k modules). Neither affects the
    // served output or egress.
    sourcemap: false,
    reportCompressedSize: false,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
