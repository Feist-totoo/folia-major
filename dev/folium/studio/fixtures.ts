import type { FoliumLine, FoliumTheme, FoliumDisplay } from '../../../src/mods/folium/contract';
import { buildLineRenderHints } from '../../../src/utils/lyrics/renderHints';

// Synthetic inputs use public Folium DTOs and the host's render-hint calculation.
export const theme: FoliumTheme = { name: 'Studio', backgroundColor: '#101522', primaryColor: '#edf0f7', secondaryColor: '#a6b6cd', accentColor: '#92dcd0',
    fontStyle: 'sans', fontWeight: 500, animationIntensity: 'normal', isDaylight: false };
export const display: FoliumDisplay = { showText: true, lyricsFontScale: 1, subtitleFontScale: 1, subtitleOverlayOpacity: 1,
    subtitleOverlayBackground: false, subtitleUpcomingLyricsBlur: false, showHarmonySubtitle: false, harmonySubtitleBackground: false,
    showSubtitleTranslation: true, hideTranslationSubtitle: false, subtitleContentMode: 'translation', isPlayerChromeHidden: true, isPanelOpen: false, visualizerOpacity: 1 };
export function fixture(kind = 'normal'): FoliumLine[] {
    if (kind === 'instrumental') return [];
    const texts = kind === 'rtl' ? ['مرحبا بالعالم', 'نغني في ضوء الليل', 'We breathe, then sing again', '晚风轻轻经过窗边'] : kind === 'long'
        ? ['一连串快速的字沿着歌声依次出现并停在附近轻轻浮动', 'Supercalifragilisticexpialidocious flows through the quiet night', '我——仍——在——等——你', '最后两句仍然可以读完，不应该消失得太早']
        : ['晚风轻轻经过窗边', '一只蜜蜂沿着歌声慢慢飞', '每个字留下自己的位置', '下一段旋律还会继续'];
    return texts.map((fullText, index) => {
        const startTime = index * 8 + 1, endTime = startTime + (index === 2 ? 7 : 5);
        const units = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(fullText)].map(item => item.segment);
        const words = units.map((text, i) => ({ text, startTime: startTime + i / units.length * (endTime - startTime), endTime: startTime + (i + 1) / units.length * (endTime - startTime) }));
        return { fullText, startTime, endTime, words, isChorus: index === 2, translation: 'A phrase takes shape and stays nearby.', renderHints: buildLineRenderHints({ startTime, endTime, words }) };
    });
}
export function validateLines(value: unknown): FoliumLine[] {
    if (!Array.isArray(value) || value.length > 1000) throw new Error('Expected at most 1000 FoliumLine objects.');
    return value.map(line => {
        if (!line || typeof line.fullText !== 'string' || line.fullText.length > 1000 || !Number.isFinite(line.startTime) || !Number.isFinite(line.endTime)
            || line.startTime < 0 || line.endTime < line.startTime || !Array.isArray(line.words) || line.words.length > 1000) throw new Error('Invalid FoliumLine.');
        const words = line.words.map((word: { text: unknown; startTime: number; endTime: number }) => {
            if (typeof word.text !== 'string' || word.text.length > 1000 || !Number.isFinite(word.startTime) || !Number.isFinite(word.endTime) || word.startTime < 0 || word.endTime < word.startTime) throw new Error('Invalid FoliumWord.');
            return Object.freeze({ text: word.text, startTime: word.startTime, endTime: word.endTime });
        });
        return Object.freeze({ fullText: line.fullText, startTime: line.startTime, endTime: line.endTime, words,
            ...(typeof line.translation === 'string' ? { translation: line.translation.slice(0, 2000) } : {}),
            isChorus: line.isChorus === true, renderHints: Object.freeze(buildLineRenderHints({ ...line, words, renderHints: undefined })) });
    });
}
