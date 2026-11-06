import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { root } from '../mcp/content.mjs';
import { exportClients } from '../mcp/exportClients.mjs';
import { diagnose } from '../mcp/diagnose.mjs';
import { selfTest } from './selfTest.mjs';
import { configureCodex } from './codex.mjs';

// Installed commands use the bundled runtime; client configuration always points at its absolute path.
const server = path.join(root, 'dev/folium/mcp/server.mjs');
const data = path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'FoliumAuthoringTools');
const [command = 'help', ...args] = process.argv.slice(2);
async function backupCodex() {
    const config = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'config.toml');
    const out = path.join(data, 'backups');
    await mkdir(out, { recursive: true });
    try { await copyFile(config, path.join(out, `codex-${Date.now()}.toml`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
}
try {
    if (command === 'serve') {
        process.argv = [process.execPath, server, ...args];
        await import('../mcp/server.mjs');
    } else if (command === 'doctor' || command === 'self-test') {
        if (args.length && (args.length !== 2 || args[0] !== '--http')) throw new Error('Usage: doctor|self-test [--http http://127.0.0.1:port/mcp]');
        const options = args.length ? { url: args[1] } : {};
        console.info(JSON.stringify(await (command === 'doctor' ? diagnose(options) : selfTest(options)), null, 2));
    } else if (command === 'configs') {
        if (args.length > 1) throw new Error('Usage: configs [output-directory]');
        const out = path.resolve(args[0] ?? path.join(data, 'client-configs'));
        await exportClients(out);
        console.info(`[FoliumMCP] Client profiles: ${out}`);
    } else if (command === 'connect-codex' || command === 'disconnect-codex') {
        console.info(await configureCodex(command === 'connect-codex' ? 'connect' : 'disconnect', { server, backup: backupCodex }));
    } else if (command === 'studio') {
        const entry = path.join(root, 'dev/folium/studio/cli.mjs');
        const studioArgs = args[0] && !args[0].startsWith('--') ? args : [path.join(root, 'mods/sample-aurora-visualizer'), ...args];
        process.argv = [process.execPath, entry, ...studioArgs];
        await import('../studio/cli.mjs');
    } else if (command === 'pack') {
        const { packMod } = await import('./pack.mjs');
        if (args.length !== 2) throw new Error('Usage: pack <mod-directory> <output.zip>');
        console.info(JSON.stringify(await packMod(...args)));
    } else if (['new', 'check'].includes(command)) {
        const entry = path.join(root, `dev/folium/${command}.mjs`);
        process.argv = [process.execPath, entry, ...args];
        await import(`../${command}.mjs`);
    } else if (command === 'help') {
        console.info('Folium Authoring Tools\n\n  studio [mod-directory] [--no-open]\n  doctor | self-test [--http http://127.0.0.1:port/mcp]\n  configs [directory]\n  connect-codex | disconnect-codex\n  serve [--http port]\n  new <directory> [--main]\n  pack <directory> <output.zip>\n  check <mod-directory>\n\nMCP guidance and validation are read-only; standard mod rendering runs in Folium Studio and desktop Folia.');
    } else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error('[FoliumMCP] Command failed.', error); process.exitCode = 1; }
