import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build only the standalone debugger assets; the player bundle and running Vite server are unaffected.
const directory = fileURLToPath(new URL('.', import.meta.url));
export async function buildStudio() {
    try {
        const files = await Promise.all(['ui.js', 'frame.js', 'style.css'].map(async name => [name, await readFile(path.join(directory, 'compiled', name), 'utf8')]));
        return Object.fromEntries(files);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const { compile } = await import('@tailwindcss/node');
    const js = await build({ entryPoints: [path.join(directory, 'ui.ts'), path.join(directory, 'frame.ts')], outdir: 'studio', bundle: true,
        write: false, format: 'esm', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'raw-guides', setup(api) {
            api.onResolve({ filter: /\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw' }));
            api.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
        } }] });
    const css = await compile(await readFile(path.join(directory, 'style.css'), 'utf8'), { base: directory, onDependency() {} });
    return { ...Object.fromEntries(js.outputFiles.map(file => [path.basename(file.path), file.text])), 'style.css': css.build([]) };
}
