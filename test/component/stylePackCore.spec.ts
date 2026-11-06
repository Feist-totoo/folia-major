import { test, expect } from '@playwright/test';

// Exercise the isolated renderer directly, without a player registration or Studio dependency.
test.beforeEach(async ({ page }) => {
    await page.route('**/style-pack-core-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto('/style-pack-core-test');
});

test('isolates capabilities, blocks remote requests and terminates a stuck renderer', async ({ page }) => {
    const requests: string[] = [];
    await page.route('https://folia-core-test.invalid/probe', async route => {
        requests.push(route.request().url());
        await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'reachable' });
    });
    expect(await page.evaluate(async () => (await fetch('https://folia-core-test.invalid/probe')).text())).toBe('reachable');
    expect(requests).toHaveLength(1); requests.length = 0;
    const errors = await page.evaluate(async () => {
        const hostPath = '/src/stylePacks/code/host.ts', packPath = '/src/stylePacks/code/example.ts', fixturesPath = '/src/stylePacks/fixtures.ts';
        const { mountCodePack } = await import(hostPath) as typeof import('../../src/stylePacks/code/host');
        const { RENDERER_PACK } = await import(packPath) as typeof import('../../src/stylePacks/code/example');
        const { fixtureFrame, fixtureScene } = await import(fixturesPath) as typeof import('../../src/stylePacks/fixtures');
        const errors: string[] = [];
        for (const code of [
            'FoliaStyle.define(() => ({render(){throw new Error("scope:"+typeof document+":"+typeof localStorage)}}));',
            'FoliaStyle.define(() => ({async render(){let status="allowed";try{await fetch("https://folia-core-test.invalid/probe")}catch{status="blocked"}throw new Error("network:"+status)}}));',
            'FoliaStyle.define(() => ({render(){while(true){}}}));',
        ]) {
            const root = document.createElement('div'); root.style.cssText = 'width:320px;height:180px'; document.body.append(root);
            const { cover, ...frame } = fixtureFrame(2);
            const host = mountCodePack(root, { ...RENDERER_PACK, renderer: { apiVersion: 2, code } },
                () => ({ frame: { ...frame, index: 0, paused: true }, scene: fixtureScene(), animate: false }), () => {}, true);
            try { await host.renderOnce(); errors.push('unexpected success'); }
            catch (error) { errors.push(String(error)); }
            finally { host.dispose(); root.remove(); }
        }
        return errors;
    });
    expect(errors[0]).toContain('scope:undefined:undefined');
    expect(errors[1]).toContain('network:blocked');
    expect(errors[2]).toContain('deadline exceeded');
    expect(requests).toEqual([]);
});

test('renders visible lyrics and reproduces a frame after seeking away and back', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const hostPath = '/src/stylePacks/code/host.ts', packPath = '/src/stylePacks/code/lyricTemplate.ts', fixturesPath = '/src/stylePacks/fixtures.ts';
        const { mountCodePack } = await import(hostPath) as typeof import('../../src/stylePacks/code/host');
        const { LYRIC_TEMPLATE_PACK } = await import(packPath) as typeof import('../../src/stylePacks/code/lyricTemplate');
        const { fixtureFrame, fixtureScene } = await import(fixturesPath) as typeof import('../../src/stylePacks/fixtures');
        let time = 2; const scene = fixtureScene();
        const root = document.createElement('div'); root.style.cssText = 'width:640px;height:360px'; document.body.append(root);
        const host = mountCodePack(root, LYRIC_TEMPLATE_PACK, () => {
            const { cover, ...frame } = fixtureFrame(time);
            return { frame: { ...frame, index: Math.floor(time / 6), paused: true }, scene, animate: false };
        }, () => {}, true);
        try {
            await host.renderOnce(); const first = await host.capture();
            time = 18; await host.renderOnce(); time = 2; await host.renderOnce();
            const a = new Uint8Array(await first.arrayBuffer()), b = new Uint8Array(await (await host.capture()).arrayBuffer());
            const bitmap = await createImageBitmap(first), canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            return { same: a.length === b.length && a.every((byte, i) => byte === b[i]), visible: pixels.some((byte, i) => i % 4 === 3 && byte > 0) };
        } finally { host.dispose(); root.remove(); }
    });
    expect(result).toEqual({ same: true, visible: true });
});
