import { expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { packMod } from '../../../dev/folium/toolkit/pack.mjs';
import { configureCodex, resolveCodex } from '../../../dev/folium/toolkit/codex.mjs';

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

it('resolves native and npm Codex launchers without executing shell shims', () => {
    const directory = path.resolve('fixture path with spaces'), native = path.join(directory, 'codex.exe');
    expect(resolveCodex({ env: { PATH: directory }, platform: 'win32', exists: file => file === native })).toEqual({ command: native, prefix: [] });
    for (const entry of [path.join(directory, 'node_modules/@openai/codex/bin/codex.js'), path.resolve(directory, '../@openai/codex/bin/codex.js')]) {
        const files = new Set([path.join(directory, 'codex.cmd'), entry]);
        expect(resolveCodex({ env: { PATH: directory }, platform: 'win32', exists: file => files.has(String(file)) })).toEqual({ command: process.execPath, prefix: [entry] });
    }
    expect(() => resolveCodex({ env: { PATH: directory }, platform: 'win32', exists: () => false })).toThrow(/not found/);
});

it('refuses to overwrite or remove another installation and refuses mutation when backup fails', async () => {
    const server = path.resolve('own-server.mjs'), node = process.execPath, backup = vi.fn(async () => {});
    for (const action of ['connect', 'disconnect']) {
        for (const transport of [{ command: 'another-node', args: [server] }, { command: node, args: ['another-server'] }, { command: node, args: [server, '--http', '43197'] }]) {
            const entry = { name: 'folium-authoring', transport }, run = vi.fn(() => JSON.stringify(action === 'connect' ? [entry] : entry));
            await expect(configureCodex(action, { server, node, run, backup })).rejects.toThrow(/another installation/);
            expect(run).toHaveBeenCalledTimes(1); expect(backup).not.toHaveBeenCalled();
        }
        const entry = { name: 'folium-authoring', transport: { command: node, args: [server] } };
        const run = vi.fn(() => JSON.stringify(action === 'connect' ? [entry] : entry));
        await expect(configureCodex(action, { server, node, run, backup: async () => { throw new Error('backup denied'); } })).rejects.toThrow('backup denied');
        expect(run).toHaveBeenCalledTimes(1);
    }
});

it('backs up before adding its entry or removing its own entry', async () => {
    const server = path.resolve('own-server.mjs'), node = process.execPath;
    for (const action of ['connect', 'disconnect']) {
        const order: string[] = [], entry = { name: 'folium-authoring', transport: { command: node, args: [server] } };
        const run = (args: string[]) => { order.push(args[1]); return JSON.stringify(action === 'connect' ? [] : entry); };
        await configureCodex(action, { server, node, run, backup: async () => { order.push('backup'); } });
        expect(order).toEqual(action === 'connect' ? ['list', 'backup', 'add'] : ['get', 'backup', 'remove']);
    }
});
