import { expect, it } from 'vitest';
import { fixture, theme, display } from '../../../dev/folium/studio/fixtures';
import { activeLineIndex, replaceLyrics } from '../../../dev/folium/studio/previewContext';

// Public clock semantics must match active lyric windows, independently of a visualizer's trailing effect.
it('switches at adjacent lyric boundaries and returns -1 in gaps even while visual tails continue', () => {
    const lines = fixture().slice(0, 2);
    lines[1] = { ...lines[1], startTime: lines[0].endTime };
    expect(lines[0].renderHints.renderEndTime).toBeGreaterThan(lines[0].endTime);
    expect(activeLineIndex(lines, lines[0].endTime - .001)).toBe(0);
    expect(activeLineIndex(lines, lines[0].endTime)).toBe(1);
    expect(activeLineIndex(fixture(), 6.1)).toBe(-1);
    expect(activeLineIndex([], 0)).toBe(-1);
});

it('drops a previous song static index on shorter and instrumental fixtures', () => {
    const state = { time: 26, paused: false, theme, display, lines: fixture(), duration: 40, staticMode: true, staticLineIndex: 3, settings: {} };
    for (const lines of [fixture().slice(0, 1), []]) {
        const next = replaceLyrics(state, lines, 12);
        expect(next).toMatchObject({ lines, time: 0, paused: true, duration: 12, staticMode: false, staticLineIndex: null });
        expect(state.staticLineIndex).toBe(3);
    }
});
