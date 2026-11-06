import type { FoliumStageContext, FoliumTheme, FoliumDisplay, FoliumLine, FoliumSetting, FoliumSettingValues } from '../../../src/mods/folium/contract';
import { createFoliumMountScope, type FoliumHostContext } from '../../../src/mods/folium/helpers';
import { sanitizeFoliumParams, mergeFoliumParamValues } from '../../../src/mods/params/params';

// Reuse the actual host's lifecycle and settings helpers; only the song/theme/audio inputs are simulated.
export interface PreviewState { time: number; paused: boolean; theme: FoliumTheme; display: FoliumDisplay; lines: FoliumLine[];
    duration: number; staticMode: boolean; staticLineIndex: number | null; settings: Record<string, unknown>; }
export function createPreviewContext(container: HTMLElement, modId: string, state: PreviewState, schema: FoliumSetting[] = []) {
    const changes = new Set<() => void>(), times = new Set<(time: number) => void>();
    const fields = sanitizeFoliumParams(schema, modId);
    let settings: FoliumSettingValues = mergeFoliumParamValues(fields, state.settings), current = state;
    const lineIndex = () => activeLineIndex(current.lines, current.time);
    const spectrum = new Uint8Array(32), bands = { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0 };
    const power = () => lineIndex() < 0 ? 0 : .35 + Math.sin(current.time * 5) * .2;
    const host: FoliumHostContext<FoliumStageContext> = {
        lines: Object.freeze(state.lines), song: Object.freeze({ id: 'studio-fixture', title: 'Folium Studio', artist: '', album: null, source: null, ref: null }),
        staticMode: state.staticMode, staticLineIndex: state.staticLineIndex, seed: 'folium-studio-fixture', isPreview: true,
        lyricTime: { get: () => current.time, on: listener => { times.add(listener); return () => { times.delete(listener); }; } },
        getDuration: () => current.duration, getLineIndex: lineIndex, isPaused: () => current.paused || current.staticMode,
        getTheme: () => current.theme, getSubtitleTheme: () => current.theme, getCoverUrl: () => null,
        getDisplay: () => current.display, getSettings: () => settings, getSurface: () => ({ transparent: false, hostBackground: true }), getLayout: () => null,
        audio: { getPower: power, getBands: () => { for (const key of Object.keys(bands) as (keyof typeof bands)[]) bands[key] = power(); return bands; },
            getSpectrum: () => { spectrum.fill(Math.round(power() * 255)); return spectrum; } },
        subscribe: listener => { changes.add(listener); return () => { changes.delete(listener); }; },
    };
    const scope = createFoliumMountScope<FoliumStageContext>(host, modId, 'studio visualizer', container, 'visualizer');
    return { ctx: scope.ctx, adopt: scope.adopt, dispose: scope.end,
        update(next: PreviewState) {
            const previous = current, oldIndex = lineIndex(); current = next;
            if (previous.settings !== next.settings) settings = mergeFoliumParamValues(fields, next.settings);
            if (oldIndex !== lineIndex() || previous.paused !== next.paused || previous.theme !== next.theme
                || previous.display !== next.display || previous.settings !== next.settings
                || previous.duration !== next.duration) for (const notify of [...changes]) notify();
            if (previous.time !== next.time) for (const notify of [...times]) notify(next.time);
        },
    };
}

// Active lyric windows exclude visual tails; gaps must report -1 to the public context.
export function activeLineIndex(lines: readonly FoliumLine[], time: number) {
    return lines.findIndex(line => time >= line.startTime && time < line.endTime);
}

// A new fixture is a new song; stale static indices and playback state must not survive it.
export function replaceLyrics(state: PreviewState, lines: FoliumLine[], duration: number): PreviewState {
    return { ...state, lines, duration, time: 0, paused: true, staticMode: false, staticLineIndex: null };
}
