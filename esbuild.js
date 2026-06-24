const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  sourcesContent: false,
  minify: production,
  logLevel: 'warning',
};

async function main() {
  const extensionCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
  });

  if (watch) {
    await extensionCtx.watch();
  } else {
    await extensionCtx.rebuild();
    await extensionCtx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
