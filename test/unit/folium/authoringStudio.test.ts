import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startStudio } from '../../../dev/folium/studio/server.mjs';
import { projectFile, openProject, bundleProject } from '../../../dev/folium/studio/project.mjs';

// Exercise project boundaries and actual build output without executing submitted client code on the server.
let directory: string, studio: Awaited<ReturnType<typeof startStudio>>;
beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'folium-studio-test-'));
    await writeFile(path.join(directory, 'mod.json'), JSON.stringify({ folium: 1, id: 'studio-probe', name: 'Probe', version: '1.0.0', client: 'client.mjs' }));
    await mkdir(path.join(directory, 'parts'));
    await writeFile(path.join(directory, 'parts/nested.mjs'), 'export const url = new URL("a.png", import.meta.url).href;');
    await writeFile(path.join(directory, 'client.mjs'), 'import {url} from "./parts/nested.mjs"; export default function activate(folium) { throw new Error(url); }');
    studio = await startStudio({ directory });
});
afterAll(async () => {
    await studio?.close();
    if (path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith('folium-studio-test-')) await rm(directory, { recursive: true, force: true });
});
it('builds a standard mod and keeps nested import.meta.url relative to its source module', async () => {
    const response = await fetch(studio.url + 'mod.js');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(studio.url + 'project/parts/nested.mjs');
    expect((await fetch(studio.url + 'frame.js')).status).toBe(200);
    const frame = await fetch(studio.url + 'frame.html');
    expect(frame.headers.get('content-security-policy')).not.toContain("'unsafe-eval'");
    expect(await (await fetch(studio.url + 'check.json')).json()).toMatchObject({ valid: true, accepted: false });
});
it('rejects writes, foreign origins, missing session URLs and paths outside the selected directory', async () => {
    expect((await fetch(studio.url, { method: 'POST' })).status).toBe(405);
    expect((await fetch(studio.url, { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await fetch(new URL('/', studio.url))).status).toBe(404);
    for (const relative of ['../package.json', '..\\package.json', '/C:/outside', 'parts/../client.mjs']) {
        await expect(projectFile(directory, relative)).rejects.toThrow();
    }
});
it('refuses bare and escaping imports instead of resolving server dependencies', async () => {
    const project = await openProject(directory);
    try {
        for (const specifier of ['node:fs', '../outside.mjs']) {
            await writeFile(path.join(directory, 'client.mjs'), `import x from ${JSON.stringify(specifier)}; export default function activate() { return x; }`);
            await expect(bundleProject(project, studio.url)).rejects.toThrow();
        }
    } finally { await writeFile(path.join(directory, 'client.mjs'), 'export default function activate() {}'); }
});
