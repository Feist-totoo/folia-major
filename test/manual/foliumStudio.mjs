import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startStudio } from '../../dev/folium/studio/server.mjs';

// Real-browser regression: hold async activation, change fixtures/seek, then inspect the first mounted context.
const directory = await mkdtemp(path.join(tmpdir(), 'folium-preview-browser-'));
let browser, studio;
try {
    await writeFile(path.join(directory, 'mod.json'), JSON.stringify({ folium: 1, id: 'delayed-probe', name: 'Delayed probe', version: '1.0.0', client: 'client.mjs' }));
    await writeFile(path.join(directory, 'client.mjs'), `export default async function activate(folium) {
        window.addEventListener('message', e => { if(e.data?.type === 'state') window.lastTestState = e.data; });
        await new Promise(resolve => { window.releaseTestActivation = resolve; });
        folium.registries.visualizers.register({id:'probe',label:'Probe',mount(container,ctx){
            const pre=document.createElement('pre'); container.append(pre);
            const draw=()=>{pre.textContent=JSON.stringify({lines:ctx.lines.length,time:ctx.lyricTime.get(),daylight:ctx.getTheme().isDaylight,staticIndex:ctx.staticLineIndex});};
            draw();ctx.onChange(draw);ctx.onLyricTime(draw);
        }});
    }`);
    studio = await startStudio({ directory });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage(); await page.goto(studio.url);
    await page.waitForSelector('iframe');
    const frame = await (await page.$('iframe')).contentFrame();
    await frame.waitForFunction(() => typeof window.releaseTestActivation === 'function');
    await page.locator('#instrumental').click(); await page.locator('#light').click();
    await page.locator('#time').evaluate(element => { element.value = '5.25'; element.dispatchEvent(new Event('input')); });
    await frame.waitForFunction(() => window.lastTestState?.state.time === 5.25);
    await frame.evaluate(() => window.releaseTestActivation());
    await frame.waitForSelector('pre');
    assert.deepEqual(JSON.parse(await frame.locator('pre').textContent()), { lines: 0, time: 5.25, daylight: true, staticIndex: null });
    await page.locator('#normal').click(); await frame.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).lines === 4);
    await page.locator('#time').evaluate(element => { element.value = '26'; element.dispatchEvent(new Event('input')); });
    await page.locator('#still').click(); await frame.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).staticIndex === 3);
    await page.locator('#fixture').setInputFiles({ name: 'one-line.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{fullText:'one',startTime:1,endTime:2,words:[]}])) });
    await frame.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).lines === 1);
    assert.equal(JSON.parse(await frame.locator('pre').textContent()).staticIndex, null);
    console.info('[FoliumStudio] Browser regression passed: deferred activation, seek, theme and shorter static fixture.');
} finally {
    await browser?.close(); await studio?.close();
    if (path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith('folium-preview-browser-')) await rm(directory, { recursive: true, force: true });
}
