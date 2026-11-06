import type { FoliumVisualizerDef, FoliumThemeHelpers } from '../../../src/mods/folium/contract';
import { createFoliumScope } from '../../../src/mods/folium/helpers';
import { resolveThemeFontStack, resolveThemeTranslationFontStack, resolveThemeFontWeight } from '../../../src/utils/fontStacks';
import { setFoliumFaultNotifier, getFoliumIssues } from '../../../src/mods/runtime/status';
import { createPreviewContext, type PreviewState } from './previewContext';
import { validateLines } from './fixtures';

// The isolated preview runs only the selected mod client; unsupported host capabilities fail explicitly.
const root = document.getElementById('stage')!;
const ownerOrigin = new URL(import.meta.url).origin;
const post = (data: Record<string, unknown>) => parent.postMessage(data, ownerOrigin);
const error = (cause: unknown) => post({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
const definitions = new Map<string, FoliumVisualizerDef>();
let preview: ReturnType<typeof createPreviewContext> | null = null, activation: ReturnType<typeof createFoliumScope> | null = null;
let state: PreviewState, selected = '', modId = '', epoch = 0, loaded = false;
function supported<T extends object>(value: T, prefix: string): T {
    return new Proxy(Object.freeze(value), { get(target, key, receiver) {
        if (typeof key === 'symbol' || key === 'then' || Object.hasOwn(target, key)) return Reflect.get(target, key, receiver);
        throw new Error(`Studio does not simulate ${prefix}.${String(key)}; validate this capability in desktop Folia.`);
    } });
}
async function mount() {
    const version = ++epoch; preview?.dispose(); preview = null; root.replaceChildren();
    const definition = definitions.get(selected); if (!definition) throw new Error('No registered visualizer selected.');
    root.style.background = state.theme.backgroundColor;
    const container = document.createElement('div'); container.style.cssText = 'position:absolute;inset:0'; root.append(container);
    const context = createPreviewContext(container, modId, state, definition.settings); preview = context;
    try { const result = definition.mount(container, context.ctx); context.adopt(result); await result;
        if (version === epoch) post({ type: 'mounted', mode: selected, settings: context.ctx.getSettings() }); }
    catch (cause) { context.dispose(); if (version === epoch) error(cause); }
}
async function activate(id: string, initial: PreviewState) {
    if (loaded) return; loaded = true; modId = id; state = { ...initial, lines: validateLines(initial.lines) };
    activation = createFoliumScope(modId, 'studio activate', 'start');
    const theme: FoliumThemeHelpers = { resolveFontStack: resolveThemeFontStack, resolveTranslationFontStack: resolveThemeTranslationFontStack, resolveFontWeight: resolveThemeFontWeight };
    const api = supported({ modId, host: { folium: { major: 1, minor: 8 }, folia: null }, env: { context: 'main' },
        log: { info: (...args: unknown[]) => post({ type: 'log', message: args.map(String).join(' ') }), warn: (...args: unknown[]) => post({ type: 'log', message: args.map(String).join(' ') }), error },
        theme, onDispose: activation.onDispose, every: activation.every,
        registries: supported({ visualizers: { register(definition: FoliumVisualizerDef) {
            if (!definition || typeof definition.id !== 'string' || !definition.id || typeof definition.mount !== 'function' || definitions.has(definition.id)) throw new Error('Invalid or duplicate visualizer definition.');
            definitions.set(definition.id, definition);
            return { id: `${modId}:${definition.id}`, unregister() { definitions.delete(definition.id); if (selected === definition.id) { epoch++; preview?.dispose(); preview = null; root.replaceChildren(); } } };
        } } }, 'folium.registries'),
    }, 'folium');
    setFoliumFaultNotifier(() => { for (const issue of getFoliumIssues(modId)) error(`${issue.where}: ${issue.message}`); });
    const entry = new URL(`mod.js?revision=${Date.now()}`, import.meta.url).href;
    const module = await import(/* @vite-ignore */ entry);
    if (typeof module.default !== 'function') throw new Error('Folium client needs export default activate(folium).');
    const dispose = await module.default(api); if (typeof dispose === 'function') activation.onDispose(dispose);
    selected = definitions.keys().next().value ?? '';
    post({ type: 'modes', modes: [...definitions.values()].map(({ id: key, label }) => ({ id: key, label })) });
    await mount();
}
window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== ownerOrigin || !event.data || typeof event.data !== 'object') return;
    const message = event.data;
    void (async () => {
        if (message.type === 'load') await activate(message.id, message.state);
        else if (message.type === 'state' && state) {
            const next = message.state as PreviewState;
            const remount = next.staticMode !== state.staticMode || next.staticLineIndex !== state.staticLineIndex || message.newLyrics;
            state = { ...next, time: message.seek ? next.time : state.time, lines: message.newLyrics ? validateLines(next.lines) : state.lines };
            root.style.background = state.theme.backgroundColor;
            if (preview) { if (remount) await mount(); else preview.update(state); }
        } else if (message.type === 'mode') { selected = message.id; await mount(); }
        else if (message.type === 'capture') {
            const canvas = root.querySelector('canvas'); if (!canvas) throw new Error('PNG export requires a canvas visualizer; use browser capture for DOM content.');
            const data = canvas.toDataURL('image/png'); post({ type: 'capture', data, time: state.time });
        }
    })().catch(error);
});
window.addEventListener('error', event => error(event.message));
window.addEventListener('unhandledrejection', event => error(event.reason));
window.addEventListener('pagehide', () => { cancelAnimationFrame(animation); epoch++; preview?.dispose(); activation?.end(); setFoliumFaultNotifier(null); });
let last = performance.now(), lastReport = 0, animation = 0;
function tick(now: number) {
    const delta = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if (preview && !state.paused && !state.staticMode && !document.hidden) {
        const time = Math.min(state.duration, state.time + delta);
        state = { ...state, time, paused: time >= state.duration }; preview.update(state);
    }
    if (state && now - lastReport >= 100) { lastReport = now; post({ type: 'clock', time: state.time, paused: state.paused }); }
    animation = requestAnimationFrame(tick);
}
animation = requestAnimationFrame(tick);
post({ type: 'ready' });
