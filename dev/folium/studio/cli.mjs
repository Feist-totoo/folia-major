import { spawn } from 'node:child_process';
import { startStudio } from './server.mjs';

// Open the independent debugger for a standard Folium project; keep the terminal alive until Ctrl+C.
try {
    const [directory, ...flags] = process.argv.slice(2);
    if (!directory || flags.some(flag => flag !== '--no-open')) throw new Error('Usage: studio <mod-directory> [--no-open]');
    const studio = await startStudio({ directory });
    console.info(`[FoliumStudio] ${studio.url}`);
    if (!flags.includes('--no-open')) {
        const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const child = spawn(command, [studio.url], { detached: true, stdio: 'ignore', windowsHide: true });
        child.on('error', error => console.error('[FoliumStudio] Open this URL manually.', error)); child.unref();
    }
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void studio.close().finally(() => process.exit()); });
} catch (error) { console.error('[FoliumStudio] Startup failed.', error); process.exitCode = 1; }
