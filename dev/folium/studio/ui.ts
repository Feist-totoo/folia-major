import { fixture, theme, display, validateLines } from './fixtures';
import type { PreviewState } from './previewContext';
import { t, labels } from './locales';
import { download } from './download';
import { mountVideoReference } from './videoReference';

// The parent controls fixtures and evidence; a fresh opaque iframe owns each mod revision.
const app = document.getElementById('app')!;
const button = (id: string, key: Parameters<typeof t>[0]) => `<button id="${id}" type="button">${t(key)}</button>`;
app.innerHTML = `<header><div><h1>${t('title')}</h1><p id="project"></p></div><div class="controls">${button('reload','reload')}${button('check','check')}${button('capture','capture')}${button('report','report')}</div></header>
<p>${t('subtitle')}</p><section class="panel"><div id="modes" class="modes"></div><div class="stage-wrap" id="stage-wrap"></div>
<div class="controls">${button('play','play')}${button('landscape','landscape')}${button('portrait','portrait')}${button('light','light')}${button('hide','hide')}${button('still','still')}
<label>${t('font')}<input id="scale" type="range" min="0.5" max="2" step="0.1" value="1"></label></div>
<input id="time" aria-label="${t('timeline')}" type="range" min="0" max="40" step="0.01" value="0"><p id="clock"></p><p id="status" role="status"></p></section>
<section class="panel"><div class="controls">${button('normal','normal')}${button('long','long')}${button('rtl','rtl')}${button('instrumental','instrumental')}
<label class="file">${t('fixture')}<input id="fixture" type="file" accept=".json"></label></div>
<label>${t('settings')}<textarea id="settings">{}</textarea></label>${button('apply','apply')}<p>${t('scope')}</p><pre id="log"></pre></section><section id="video" class="panel"></section>`;
const find = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let iframe: HTMLIFrameElement, portrait = false, mounted = false, fixtureVersion = 0;
let state: PreviewState = { time: 0, paused: true, theme, display, lines: fixture(), duration: 40, staticMode: false, staticLineIndex: null, settings: {} };
const logs: { at: string; type: string; message: string; time: number }[] = [];
let checkReport: unknown = null, project: { id: string; name: string; version: string };
const log = (type: string, message: string) => {
    logs.push({ at: new Date().toISOString(), type, message, time: state.time }); if (logs.length > 100) logs.shift();
    find('log').textContent = logs.map(item => `${item.time.toFixed(2)} s · ${item.type} · ${item.message}`).join('\n');
};
const send = (message: Record<string, unknown>) => iframe?.contentWindow?.postMessage(message, '*');
const update = (newLyrics = false, seek = false) => { send({ type: 'state', state, newLyrics, seek }); };
function reload() {
    mounted = false; find('status').textContent = t('waiting'); iframe?.remove();
    iframe = document.createElement('iframe'); iframe.sandbox.add('allow-scripts'); iframe.title = t('title');
    iframe.src = `frame.html?revision=${Date.now()}`;
    iframe.style.maxWidth = portrait ? '390px' : '100%'; iframe.style.aspectRatio = portrait ? '390 / 844' : '16 / 9';
    find('stage-wrap').append(iframe);
}
window.addEventListener('message', event => {
    if (event.source !== iframe?.contentWindow || !event.data || typeof event.data !== 'object') return;
    const message = event.data;
    if (message.type === 'ready') send({ type: 'load', id: project.id, state });
    if (message.type === 'error') { mounted = false; find('status').textContent = `${t('failed')} ${message.message}`; log('error', String(message.message)); }
    if (message.type === 'log') log('mod', String(message.message));
    if (message.type === 'mounted') { mounted = true; find('status').textContent = t('ready'); find<HTMLTextAreaElement>('settings').value = JSON.stringify(message.settings, null, 2); log('mount', String(message.mode)); }
    if (message.type === 'modes') {
        find('modes').replaceChildren();
        for (const mode of message.modes) {
            const element = document.createElement('button'); element.type = 'button';
            element.textContent = typeof mode.label === 'string' ? mode.label : mode.label[navigator.language] ?? mode.label.en ?? mode.id;
            element.onclick = () => { send({ type: 'mode', id: mode.id }); };
            find('modes').append(element);
        }
    }
    if (message.type === 'clock' && Number.isFinite(message.time)) {
        state = { ...state, time: message.time, paused: message.paused };
        find<HTMLInputElement>('time').value = String(message.time); find('clock').textContent = `${message.time.toFixed(2)} / ${state.duration.toFixed(2)} s`;
    }
    if (message.type === 'capture' && typeof message.data === 'string' && message.data.startsWith('data:image/png;base64,')) {
        const bytes = Uint8Array.from(atob(message.data.split(',')[1]), char => char.charCodeAt(0));
        download(`${project.id}-${Number(message.time).toFixed(2)}.png`, new Blob([bytes], { type: 'image/png' }));
    }
});
find('reload').onclick = reload;
find('play').onclick = () => { state = { ...state, paused: !state.paused }; update(); };
find<HTMLInputElement>('time').oninput = event => { state = { ...state, time: Number((event.target as HTMLInputElement).value), paused: true }; update(false, true); };
find<HTMLInputElement>('scale').oninput = event => { state = { ...state, display: { ...state.display, lyricsFontScale: Number((event.target as HTMLInputElement).value) } }; update(); };
find('light').onclick = () => { const daylight = !state.theme.isDaylight; state = { ...state, theme: { ...state.theme, isDaylight: daylight, backgroundColor: daylight ? '#eef0f4' : '#101522', primaryColor: daylight ? '#15223c' : '#edf0f7' } }; update(); };
find('hide').onclick = () => { state = { ...state, display: { ...state.display, showText: !state.display.showText } }; update(); };
find('still').onclick = () => { state = { ...state, staticMode: !state.staticMode, staticLineIndex: state.staticMode ? null : Math.max(0, state.lines.findIndex(line => state.time >= line.startTime && state.time < line.endTime)), paused: true }; update(); };
for (const kind of ['normal', 'long', 'rtl', 'instrumental']) find(kind).onclick = () => { fixtureVersion++; state = { ...state, lines: fixture(kind), time: 0, paused: true, duration: 40 }; find<HTMLInputElement>('time').max = '40'; update(true, true); };
for (const kind of ['landscape', 'portrait']) find(kind).onclick = () => { portrait = kind === 'portrait'; iframe.style.maxWidth = portrait ? '390px' : '100%'; iframe.style.aspectRatio = portrait ? '390 / 844' : '16 / 9'; };
find('capture').onclick = () => { if (mounted) send({ type: 'capture' }); };
find('apply').onclick = () => {
    try { const settings = JSON.parse(find<HTMLTextAreaElement>('settings').value);
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Expected a settings object.');
        state = { ...state, settings }; update(); }
    catch (error) { log('error', String(error)); }
};
find<HTMLInputElement>('fixture').onchange = async event => {
    const version = ++fixtureVersion;
    try { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
        if (file.size > 1024 * 1024) throw new Error('Fixture limit: 1 MiB.');
        const lines = validateLines(JSON.parse(await file.text())), duration = Math.max(1, ...lines.map(line => line.endTime)) + 6;
        if (version !== fixtureVersion) return;
        state = { ...state, lines, time: 0, paused: true, duration }; find<HTMLInputElement>('time').max = String(duration); update(true, true); }
    catch (error) { log('error', String(error)); }
};
find('check').onclick = async () => { try { const response = await fetch('check.json'); if (!response.ok) throw new Error(await response.text()); checkReport = await response.json(); log('check', JSON.stringify(checkReport)); } catch (error) { log('error', String(error)); } };
find('report').onclick = () => download(`${project.id}-studio-report.json`, JSON.stringify({ project, accepted: false, checkReport, previewMounted: mounted, state, logs,
    limitation: 'Preview of selected public visual interfaces. Desktop runtime and continuous aesthetic review remain required. No automatic artistic approval.' }, null, 2));
const disposeVideo = mountVideoReference(find('video'), labels);
window.addEventListener('pagehide', disposeVideo, { once: true });
try { const response = await fetch('session.json'); if (!response.ok) throw new Error(await response.text()); project = await response.json(); find('project').textContent = `${project.name} · ${project.version}`; reload(); }
catch (error) { find('status').textContent = `${t('failed')} ${String(error)}`; }
