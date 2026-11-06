import { readFile, readdir, writeFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { checkMod } from '../mcp/tools.mjs';

// Archive a checked standard mod without changing its files or inventing an additional manifest.
export async function packMod(directory, destination) {
    const root = await realpath(path.resolve(directory)), output = path.resolve(destination);
    const relation = path.relative(root, output);
    if (!relation.startsWith('..') && !path.isAbsolute(relation)) throw new Error('Put the ZIP outside the source mod.');
    const report = await checkMod({ directory: root });
    if (!report.valid) throw new Error(report.issues.join('\n'));
    let total = 0, count = 0; const files = Object.create(null);
    async function walk(folder, depth = 0) {
        if (depth > 24) throw new Error('Mod exceeds depth budget.');
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            if (++count > 600) throw new Error('Mod exceeds entry budget.');
            const file = path.join(folder, entry.name), info = await lstat(file);
            if (info.isSymbolicLink()) throw new Error('Symlinks cannot be archived.');
            if (info.isDirectory()) { await walk(file, depth + 1); continue; }
            if (!info.isFile()) throw new Error('Only regular files can be archived.');
            total += info.size; if (total > 16 * 1024 * 1024) throw new Error('Mod exceeds 16 MiB budget.');
            const relative = path.relative(root, file).split(path.sep).join('/');
            files[relative] = await readFile(file);
        }
    }
    await walk(root);
    const zip = zipSync(files, { level: 6 });
    await writeFile(output, zip, { flag: 'wx' });
    return { output, bytes: zip.length, files: Object.keys(files).length, valid: true, accepted: false,
        next: 'Extract into a Folium mod directory, reload and confirm enable in desktop Folia. ZIP creation does not sign or approve a mod.' };
}
