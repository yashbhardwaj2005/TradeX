import { createServer } from 'vite';
const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
});
try {
  // Load React and the app through the same Vite module graph. This checks route
  // rendering without claiming browser behavior or visual layout verification.
  const { runChecks } = await vite.ssrLoadModule('/scripts/render-fixtures.jsx');
  await runChecks();
  console.log(
    'PASS: all 14 frontend routes render with deterministic query fixtures. Browser interactions and visual layout remain unverified.',
  );
} finally {
  await vite.close();
}
