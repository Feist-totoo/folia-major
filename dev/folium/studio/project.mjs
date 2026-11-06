import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build, transform } from 'esbuild';
import { checkMod } from '../mcp/tools.mjs';

// Preview standard relative Folium modules; all served paths stay within the explicitly selected project.
const require = createRequire(import.meta.url);
const { validateManifest } = require('../../../electron/modSystem/manifest.cjs');
export async function projectFile(root, relative) {
    if (!relative || relative.includes('\0') || relative.includes('\\') || relative.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid project path.');
    const resolved = await realpath(path.resolve(root, relative));
    const relation = path.relative(root, resolved);
    if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('Project path escapes selected directory.');
    const info = await stat(resolved);
    if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error('Expected a regular project file up to 16 MiB.');
    return resolved;
}
export async function openProject(directory, options = {}) {
    const root = await realpath(path.resolve(directory));
    const report = await checkMod({ directory: root }, options);
    if (!report.valid) throw new Error(report.issues.join('\n'));
    const validation = validateManifest(JSON.parse(await readFile(await projectFile(root, 'mod.json'), 'utf8')));
    if (!validation.ok) throw new Error(validation.errors.join('\n'));
    const manifest = validation.value;
    if (!manifest.client || manifest.main || manifest.depends.length || manifest.permissions.length || manifest.experimental.length) {
        throw new Error('Preview supports pure client visualizers without main, depends, permissions or experimental APIs. Use desktop Folia for other mod capabilities.');
    }
    return { root, manifest };
}
export async function bundleProject(project, baseUrl) {
    const entry = await projectFile(project.root, project.manifest.client);
    const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
        plugins: [{ name: 'folium-relative-modules', setup(api) {
            api.onResolve({ filter: /.*/ }, async args => {
                if (args.kind !== 'entry-point' && !args.path.startsWith('./') && !args.path.startsWith('../')) throw new Error('Folium client imports must be relative local modules.');
                const file = args.kind === 'entry-point' ? args.path : path.resolve(args.resolveDir, args.path);
                const checked = await projectFile(project.root, path.relative(project.root, file).split(path.sep).join('/'));
                if (!/\.(mjs|js)$/.test(checked)) throw new Error('Folium client modules must use .mjs or .js.');
                return { path: checked };
            });
            api.onLoad({ filter: /\.(mjs|js)$/ }, async args => {
                const relative = path.relative(project.root, args.path).split(path.sep).map(encodeURIComponent).join('/');
                const source = await transform(await readFile(args.path, 'utf8'), { loader: 'js', target: 'es2022',
                    define: { 'import.meta.url': JSON.stringify(new URL(`project/${relative}`, baseUrl).href) } });
                return { contents: source.code, loader: 'js', resolveDir: path.dirname(args.path) };
            });
        } }] });
    return result.outputFiles[0].text;
}
