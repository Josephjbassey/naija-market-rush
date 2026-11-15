"""Drives the Lux3D 'Make an item' UI against the backend in LUX3D_MOCK=1 mode (no credits spent)."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/screenshots'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 760})
        await pg.goto(URL, wait_until='networkidle')
        await pg.wait_for_function("window.__nmr && window.__nmr.catalog.length >= 12", timeout=30000)
        await pg.click('#btn-make-start')
        await pg.wait_for_function("document.querySelector('#lux-status').textContent.includes('MOCK')", timeout=10000)
        await pg.fill('#lux-prompt', 'a woven raffia basket full of red tomatoes')
        await pg.fill('#lux-name', 'Tomato basket')
        await pg.click('#lux-go')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/08-lux3d-generating-mock.png')
        await pg.wait_for_function("window.__nmr.catalog.some(i => i.source === 'lux3d-api')", timeout=40000)
        print('mock Lux3D item added:', await pg.evaluate("window.__nmr.catalog.filter(i=>i.fresh).map(i=>i.name)"))
        await b.close()
asyncio.run(main())
