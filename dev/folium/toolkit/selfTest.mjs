import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, sources } from '../mcp/content.mjs';
import { startHttpServer } from '../mcp/http.mjs';

// Real protocol calls cover all authoring tools, resources, prompts, failures and both transports.
export async function selfTest({ url = '', token = process.env.FOLIUM_MCP_TOKEN } = {}) {
    if (url) {
        const endpoint = new URL(url);
        if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/mcp'
            || endpoint.search || endpoint.hash || endpoint.username || endpoint.password || !token) throw new Error('Use authenticated loopback /mcp only.');
    }
    const directory = await mkdtemp(path.join(tmpdir(), 'folia-toolkit-selftest-'));
    const file = path.join(directory, 'valid'), invalid = path.join(directory, 'invalid');
    const checks = [];
    let http;
    async function probe(transport, label) {
        const client = new Client({ name: 'folia-installed-selftest', version: '1' }, { capabilities: {} });
        const watchdog = setTimeout(() => { void client.close(); void transport.close(); }, 30000);
        try {
            await client.connect(transport);
            const definitions = await client.listTools();
            assert.equal(definitions.tools.length, 7);
            const call = async (name, args = {}) => {
                const result = await client.callTool({ name, arguments: args });
                assert.ok(!result.isError, `${label}: ${name}: ${JSON.stringify(result.content)}`);
                return JSON.parse(result.content[0].text);
            };
            const status = await call('folium_status');
            const catalog = await call('folium_catalog');
            assert.equal(catalog.entries.length, 17);
            assert.equal((await call('folium_catalog', { kind: 'personality' })).entries.length, 6);
            assert.equal((await call('folium_catalog', { kind: 'lyric-template' })).entries.length, 11);
            assert.equal(path.resolve(status.projectRoot), path.resolve(root));
            assert.equal((await call('folium_brief', { task: 'Installed toolchain verification', source: 'wallpaper' })).source, 'wallpaper');
            for (const topic of status.guides) assert.ok((await call('folium_read_guide', { topic })).text.length > 100);
            for (const [style, files] of Object.entries(sources)) {
                for (let index = 0; index < files.length; index++) assert.ok((await call('folium_reference', { style, file: index, lineCount: 5 })).text.length);
            }
            assert.equal((await call('folium_check_mod', { directory: file })).valid, true);
            assert.equal((await call('folium_check_mod', { directory: invalid })).valid, false);
            const phrase = label => ({ label, context: 'test', reason: 'Deliberate repeat for the diagnostic fixture',
                samples: Array.from({ length: 6 }, (_, i) => ({ t: i, x: i / 10, y: .3 })) });
            const motion = await call('folium_review_motion', { source: { kind: 'planned', artifact: 'self-test fixture' }, phrases: [phrase('a'), phrase('b')] });
            assert.equal(motion.accepted, false);
            assert.ok(motion.warnings.some(item => item.code === 'repeated-trajectory'));
            assert.equal((await client.callTool({ name: 'folium_reference', arguments: { style: '../../secret' } })).isError, true);
            const resources = await client.listResources();
            for (const resource of resources.resources) assert.ok((await client.readResource({ uri: resource.uri })).contents[0].text.length > 100);
            assert.equal((await client.listPrompts()).prompts[0].name, 'folium_director');
            assert.ok((await client.getPrompt({ name: 'folium_director', arguments: { task: 'Installed prompt verification' } })).messages.length);
            checks.push({ transport: label, passed: true, tools: definitions.tools.map(tool => tool.name), guides: status.guides.length,
                sourceFiles: Object.values(sources).flat().length, resources: resources.resources.length, prompts: 1,
                validAndInvalidMod: true, rejectedInvalidArguments: true });
        } finally { clearTimeout(watchdog); if (label === 'streamable-http') await transport.terminateSession().catch(() => {}); await client.close(); await transport.close(); }
    }
    try {
        await mkdir(file); await mkdir(invalid);
        await writeFile(path.join(file, 'mod.json'), JSON.stringify({folium:1,id:'self-test',name:'Self test',version:'1.0.0',client:'client.mjs'}));
        await writeFile(path.join(file, 'client.mjs'), 'export default function activate() { throw new Error("must not execute"); }');
        await writeFile(path.join(invalid, 'mod.json'), '{}');
        if (!url) {
            await probe(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dev/folium/mcp/server.mjs')],
                cwd: directory, stderr: 'pipe' }), 'stdio');
            token = randomBytes(32).toString('hex');
            http = await startHttpServer({ port: 0, token });
            url = http.url;
        }
        await probe(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }), 'streamable-http');
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        assert.equal((await fetch(url, { method: 'POST', body })).status, 401);
        assert.equal((await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, Origin: 'https://example.com' } })).status, 403);
        return { passed: true, runtime: process.execPath, root, checks, httpUnauthorizedRejected: true, browserOriginRejected: true,
            scope: 'Real MCP protocol interfaces; host UI/model turns and visual quality require separate review.' };
    } finally {
        if (http) await http.close();
        // Only the freshly created OS temporary directory is removed, never a caller-selected path.
        if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('folia-toolkit-selftest-')) throw new Error('Unexpected temporary path');
        await rm(directory, { recursive: true, force: true });
    }
}
