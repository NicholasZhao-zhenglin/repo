import { build } from 'esbuild';
await build({ entryPoints: { main: 'electron/main.ts', preload: 'electron/preload.ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron'], outdir: 'dist-electron', outExtension: { '.js': '.cjs' } });
