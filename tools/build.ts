// Assemble le code du navigateur (src/client) dans dist/game.js.
//   node tools/build.ts                  build unique
//   node tools/build.ts --watch --serve  reconstruit à chaque modification et lance le serveur
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');

const options: esbuild.BuildOptions = {
  absWorkingDir: ROOT,
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  outfile: 'dist/game.js',
  format: 'iife',
  target: 'es2022',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}

if (serve) {
  const { startServer } = await import('../server/main.ts');
  startServer();
}
