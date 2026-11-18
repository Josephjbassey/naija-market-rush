"""Headless smoke test: loads the game, plays a few serves, imports a GLB, saves screenshots.
Usage: python tests/smoke.py http://localhost:4173 docs/screenshots [path/to/test.glb]"""
import asyncio, sys, os
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/screenshots'
GLB = sys.argv[3] if len(sys.argv) > 3 else None

async def main():
    os.makedirs(OUT, exist_ok=True)
    errors = []
    async with async_playwright() as p:
        chrome = os.environ.get('PLAYWRIGHT_CHROMIUM', '/usr/bin/chromium')
        kw = dict(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        if os.path.exists(chrome):
            kw['executable_path'] = chrome
        b = await p.chromium.launch(**kw)
        pg = await b.new_page(viewport={'width': 1280, 'height': 760})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(URL, wait_until='load')
        await pg.wait_for_function("window.__nmr && window.__nmr.catalog.length >= 12", timeout=30000)
        print('asset status:', await pg.inner_text('#asset-status'))
        await pg.screenshot(path=f'{OUT}/01-start.png')
        await pg.click('#btn-markets')
        await pg.click('[data-level=stall]')
        await pg.wait_for_timeout(5500)
        await pg.screenshot(path=f'{OUT}/02-customers.png')
        served = 0
        for _ in range(60):
            if served >= 3: break
            res = await pg.evaluate("""() => { const n = window.__nmr;
                let c = n.customers.find(c => c.state === 'wait' && (!c.haggle || c.haggled));
                if (!c) {
                    if (!n.customers.some(c => c.state === 'walkin')) n.spawnCustomer();
                    return null;
                }
                const i = n.shelf.findIndex(s => s && s.item.id === c.item.id);
                if (i < 0) return null;
                n.serve(i);
                return c.item.name; }""")
            if res: served += 1
            await pg.wait_for_timeout(700)
            if served == 3: await pg.screenshot(path=f'{OUT}/03-serving.png')
        g = await pg.evaluate("() => ({cash: window.__nmr.G.cash, combo: window.__nmr.G.best, served: window.__nmr.G.served})")
        print('after auto-serves:', g)
        assert g['served'] >= 1, 'serving did not work'
        # wrong item
        await pg.mouse.click(10, 750)
        if GLB:
            await pg.click('#btn-make-hud')
            await pg.click('.tab[data-tab=import]')
            await pg.set_input_files('#imp-file', GLB)
            await pg.fill('#imp-name', 'Test duck (import)')
            await pg.fill('#imp-line', 'Abeg, bring the duck!')
            await pg.screenshot(path=f'{OUT}/04-make-item.png')
            await pg.click('#imp-go')
            await pg.wait_for_timeout(1500)
            n = await pg.evaluate("() => window.__nmr.catalog.filter(i => i.fresh).length")
            print('imported items:', n); assert n == 1, 'GLB import failed'
            await pg.screenshot(path=f'{OUT}/05-import-test-khronos-duck.png')
        await pg.evaluate("() => { window.__nmr.endRound(); }")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/06-results-after-import-test.png')
        assert await pg.is_visible('#over'), 'results screen did not show'
        await pg.close()
        m = await b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        m.on('pageerror', lambda e: errors.append(str(e)))
        await m.goto(URL, wait_until='domcontentloaded')
        await m.wait_for_function("window.__nmr && window.__nmr.catalog.length >= 12", timeout=30000)
        await m.tap('#btn-markets'); await m.wait_for_timeout(400); await m.tap('[data-level=stall]'); await m.wait_for_timeout(5000)
        await m.screenshot(path=f'{OUT}/07-mobile.png')
        await b.close()
    real = [e for e in errors if 'favicon' not in e]
    print('console/page errors:', real or 'none')
    if any('Error' in e for e in real): sys.exit(1)

asyncio.run(main())
