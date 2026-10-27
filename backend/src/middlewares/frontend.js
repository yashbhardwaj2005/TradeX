import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

// A single Node service can serve the Vite build and API on the same origin.
// API errors and missing assets must never turn into an HTML success response.
export function attachFrontend(app, directory) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index))
    throw new Error('The frontend build is missing. Run npm run build before npm run start:full.');
  const isApi = (pathname) => pathname === '/api' || pathname.startsWith('/api/');
  const serveAssets = express.static(directory, {
    index: false,
    redirect: false,
    dotfiles: 'ignore',
    setHeaders(res, file) {
      res.setHeader(
        'Cache-Control',
        file.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });
  app.use((req, res, next) => (isApi(req.path) ? next() : serveAssets(req, res, next)));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || isApi(req.path) || !req.accepts('html'))
      return next();
    if (
      req.path.startsWith('/assets/') ||
      /\.(js|css|map|svg|png|jpe?g|ico|webp|woff2?|json|txt)$/i.test(req.path)
    )
      return next();
    res.sendFile(index, { headers: { 'Cache-Control': 'no-cache' } });
  });
}
