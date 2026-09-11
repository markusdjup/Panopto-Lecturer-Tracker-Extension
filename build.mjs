import * as esbuild from 'esbuild';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');

if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

cpSync('public', 'dist', { recursive: true });

const buildOptions = {
  entryPoints: {
    content: 'src/content.js',
    background: 'src/background.js',
    offscreen: 'src/offscreen.js',
    popup: 'src/popup.js',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome110',
  logLevel: 'info',
};

cpSync('src/content.css', 'dist/content.css');

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete -> dist/');
}
