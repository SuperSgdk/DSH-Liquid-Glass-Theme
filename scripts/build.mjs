// Standalone DSH module-loader build. Modified by SuperSgdk, 2026-10-01.
import { build } from 'esbuild';
import { transform } from 'lightningcss';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const externals = ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives'];
const cssPlugin = {
  name: 'dsh-inline-css',
  setup(builder) {
    builder.onResolve({ filter: /\.css$/ }, args => ({ path: relative(root, resolve(args.resolveDir, args.path)).replaceAll('\\', '/'), namespace: 'dsh-css' }));
    builder.onLoad({ filter: /.*/, namespace: 'dsh-css' }, async args => {
      const cssModules = args.path.endsWith('.module.css');
      const file = resolve(root, args.path);
      const result = transform({ filename: args.path, code: await readFile(file), minify: true,
        ...(cssModules ? { cssModules: { pattern: '[hash]_[local]' } } : {}) });
      const classes = Object.fromEntries(Object.entries(result.exports ?? {}).sort().map(([key, value]) => [key, value.name]));
      const tagId = `${pkg.name}/${basename(args.path)}`;
      return { loader: 'js', watchFiles: [file], resolveDir: dirname(file), contents: `
        const tagId = ${JSON.stringify(tagId)};
        if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']')) {
          const tag = document.createElement('style');
          tag.dataset.plugin = ${JSON.stringify(pkg.name)};
          tag.dataset.pluginCss = tagId;
          tag.textContent = ${JSON.stringify(result.code.toString())};
          document.head.appendChild(tag);
        }
        export default ${JSON.stringify(classes)};
      ` };
    });
  },
};
const libDir = resolve(root, 'lib');
if (dirname(libDir) !== resolve(root) || basename(libDir) !== 'lib') throw new Error('Invalid build output directory');
await rm(libDir, { recursive: true, force: true });
await mkdir(libDir, { recursive: true });
const common = { absWorkingDir: root, bundle: true, target: 'es2022', sourcemap: true, legalComments: 'inline', logLevel: 'info' };
await build({ ...common, entryPoints: ['src/index.ts', 'src/invariant.ts'], outdir: 'lib', platform: 'node', format: 'esm' });
const client = await build({ ...common, entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', platform: 'browser', format: 'cjs',
  jsx: 'automatic', external: externals, plugins: [cssPlugin], metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `// DSH liquid glass theme; AGPL-3.0-only; see NOTICE.\nwindow.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
});
for (const output of Object.values(client.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && !externals.includes(dependency.path)) throw new Error(`Undeclared browser module: ${dependency.path}`);
  }
}
