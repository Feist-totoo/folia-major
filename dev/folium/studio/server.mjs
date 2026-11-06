import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openProject, projectFile, bundleProject } from './project.mjs';
import { buildStudio } from './build.mjs';
import { checkMod } from '../mcp/tools.mjs';

// Serve one explicitly selected project on a private loopback URL; no write, install or approval endpoints.
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.bin': 'application/octet-stream' };
export async function startStudio({ directory, port = 0 }) {
    let project = await openProject(directory);
    const assets = await buildStudio();
    const prefix = `/${randomBytes(24).toString('hex')}/`;
    let authority = '', url = '', busy = false;
    const server = createServer(async (req, res) => {
        const controller = new AbortController();
        res.once('close', () => { if (!res.writableFinished) controller.abort(); });
        const reply = (status, type, body) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(body); };
        if (req.headers.host !== authority || (req.headers.origin && !['null', `http://${authority}`].includes(req.headers.origin))) { reply(403, 'text/plain', 'Loopback studio only.'); return; }
        if (req.method !== 'GET') { reply(405, 'text/plain', 'Read-only studio.'); return; }
        let route;
        try { route = decodeURIComponent(new URL(req.url, url).pathname); } catch { reply(400, 'text/plain', 'Invalid URL.'); return; }
        if (!route.startsWith(prefix)) { reply(404, 'text/plain', 'Unknown session.'); return; }
        route = route.slice(prefix.length);
        try {
            if (Object.hasOwn(assets, route)) { res.setHeader('Access-Control-Allow-Origin', '*'); reply(200, route.endsWith('.css') ? 'text/css' : 'text/javascript', assets[route]); }
            else if (route === '') {
                res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src 'self' data: blob:; media-src blob:; font-src 'self' data:; base-uri 'none'; form-action 'none'");
                reply(200, 'text/html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folium Studio</title><link rel="stylesheet" href="style.css"></head><body><main id="app"></main><script type="module" src="ui.js"></script></body></html>');
            } else if (route === 'frame.html') {
                const projectUrl = `${url}project/`;
                res.setHeader('Content-Security-Policy', `default-src 'none'; script-src ${url} 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src ${projectUrl} data: blob:; font-src ${projectUrl} data: blob:; connect-src ${projectUrl}; media-src ${projectUrl} blob:; base-uri 'none'; form-action 'none'`);
                reply(200, 'text/html', '<!doctype html><html><head><meta charset="utf-8"><style>html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden}#stage{position:relative}</style></head><body><div id="stage"></div><script type="module" src="frame.js"></script></body></html>');
            } else if (route === 'session.json') {
                reply(200, 'application/json', JSON.stringify({ name: project.manifest.name, id: project.manifest.id, version: project.manifest.version,
                    support: 'Pure client visualizers, theme helpers, clocks, lifecycle, audio simulation and default settings. No host overlays, persistence, main or other services. Desktop validation remains required.' }));
            } else if (route === 'check.json') { reply(200, 'application/json', JSON.stringify(await checkMod({ directory: project.root }, { signal: controller.signal }))); }
            else if (route === 'mod.js') {
                if (busy) { reply(409, 'text/plain', 'Compilation in progress; reload after it completes.'); return; }
                busy = true;
                try { project = await openProject(project.root, { signal: controller.signal }); const code = await bundleProject(project, url);
                    res.setHeader('Access-Control-Allow-Origin', '*'); reply(200, 'text/javascript', code); }
                finally { busy = false; }
            } else if (route.startsWith('project/')) {
                const relative = route.slice(8), type = mime[path.extname(relative).toLowerCase()];
                if (!type) { reply(415, 'text/plain', 'Unsupported preview asset type.'); return; }
                const file = await projectFile(project.root, relative);
                res.setHeader('Access-Control-Allow-Origin', '*'); reply(200, type, await readFile(file));
            } else reply(404, 'text/plain', 'Not found.');
        } catch (error) { reply(422, 'text/plain', error.message); }
    });
    server.requestTimeout = 15000; server.headersTimeout = 10000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    authority = `127.0.0.1:${server.address().port}`; url = `http://${authority}${prefix}`;
    return { url, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
