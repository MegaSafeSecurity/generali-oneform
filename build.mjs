// Build statik: public/ -> dist/ + bundle TypeScript (termasuk pdf-lib) -> dist/oneform.js
import { build } from 'esbuild';
import { cpSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/client/index.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/oneform.js', legalComments: 'none' });
copyFileSync('dist/index.html', 'dist/404.html'); // GitHub Pages: refresh pada laluan tidak dikenali kembali ke portal
writeFileSync('dist/.nojekyll', '');
console.log('dist/ siap');
