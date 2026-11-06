import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { packMod } from '../../../dev/folium/toolkit/pack.mjs';

// Packaging must preserve a standard Folium directory and never overwrite the caller's existing archive.
it('archives a standard mod and refuses an existing output or an output inside the project', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'folium-pack-test-'));
    const source = path.join(directory, 'source'), output = path.join(directory, 'mod.zip');
    try {
        await mkdir(source);
        const manifest = JSON.stringify({ folium: 1, id: 'test-pack', name: 'Test', version: '1.0.0', client: 'client.mjs' });
        await writeFile(path.join(source, 'mod.json'), manifest);
        await writeFile(path.join(source, 'client.mjs'), 'export default function activate() {}');
        const result = await packMod(source, output);
        expect(result.accepted).toBe(false);
        const zip = await readFile(output), entries = unzipSync(zip);
        expect(Object.keys(entries).sort()).toEqual(['client.mjs', 'mod.json']);
        expect(strFromU8(entries['mod.json'])).toBe(manifest);
        await expect(packMod(source, output)).rejects.toMatchObject({ code: 'EEXIST' });
        expect(await readFile(output)).toEqual(zip);
        await expect(packMod(source, path.join(source, 'self.zip'))).rejects.toThrow(/outside/);
        await writeFile(path.join(source, 'mod.json'), '{}');
        await expect(packMod(source, path.join(directory, 'invalid.zip'))).rejects.toThrow();
    } finally {
        if (path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith('folium-pack-test-')) await rm(directory, { recursive: true, force: true });
    }
});
