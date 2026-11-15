#!/usr/bin/env python3
"""Headless tour of new markets, shop, haggling and level select.
Usage: python tools/nmr_expand_test.py http://localhost:4173 docs/screenshots
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"
OUT = sys.argv[2] if len(sys.argv) > 2 else "docs/screenshots"

SHOTS = []


async def shot(page, name):
    path = os.path.join(OUT, name)
    await page.screenshot(path=path, full_page=False)
    SHOTS.append(path)
    print("screenshot", path, flush=True)


async def wait_boot(page, timeout=180000):
    await page.wait_for_function(
        "window.__nmr && window.__nmr.catalogs && window.__nmr.catalogs.stall && window.__nmr.catalogs.stall.length >= 12",
        timeout=timeout,
    )
    status = await page.inner_text("#asset-status")
    print("asset status:", status, flush=True)
    return status


async def wait_waiting(page, timeout=20000):
    await page.wait_for_function(
        "window.__nmr && window.__nmr.customers.some(c => c.state === 'wait')",
        timeout=timeout,
    )


async def serve_some(page, n=3, skip_haggle=False):
    served = 0
    for _ in range(50):
        if served >= n:
            break
        name = await page.evaluate(
            """() => {
              const n = window.__nmr;
              const c = n.customers.find(c => c.state === 'wait');
              if (!c) { n.spawnCustomer(); return null; }
              const i = n.shelf.findIndex(s => s && s.item.id === c.item.id);
              if (i < 0) return null;
              n.serve(i, {fromApprentice: true});
              return c.item.name;
            }"""
        )
        if name:
            served += 1
            print("served", name, flush=True)
        await page.wait_for_timeout(650)
    return served


async def force_haggle(page):
    await page.wait_for_function(
        """() => {
          const n = window.__nmr;
          if (!n.G.playing) return false;
          if (n.customers.some(c => c.state === 'wait')) return true;
          n.spawnCustomer();
          return n.customers.some(c => c.state === 'wait');
        }""",
        timeout=20000,
    )
    return await page.evaluate(
        """() => {
          const n = window.__nmr;
          const c = n.customers.find(c => c.state === 'wait');
          if (!c) return false;
          const i = n.shelf.findIndex(s => s && s.item.id === c.item.id);
          if (i < 0) return false;
          c.haggle = true;
          c.haggled = false;
          n.beginHaggle(c, c.item, n.shelf[i]);
          const el = document.getElementById('haggle');
          return !!(el && !el.classList.contains('hidden'));
        }"""
    )


async def main():
    os.makedirs(OUT, exist_ok=True)
    errors = []
    async with async_playwright() as p:
        chrome = os.environ.get("PLAYWRIGHT_CHROMIUM", "/usr/bin/google-chrome")
        args = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
        launch_kw = dict(args=args)
        if os.path.exists(chrome):
            launch_kw["executable_path"] = chrome
        browser = await p.chromium.launch(**launch_kw)
        page = await browser.new_page(viewport={"width": 1280, "height": 760})
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
        await page.goto(URL, wait_until="networkidle", timeout=120000)
        status = await wait_boot(page)
        assert "placeholder" in status.lower() or "Lux3D" in status

        # fresh save: locked markets
        await page.evaluate(
            """() => {
              localStorage.removeItem('nmr-save-v1');
              const p = {bank:0,muted:true,stars:{stall:0,ojaoba:0,night:0},bestCash:{stall:0,ojaoba:0,night:0},upgrades:{hands:0,shelf:0,apprentice:0,canopy:0}};
              window.__nmr.setProgress(p);
            }"""
        )
        await page.click("#btn-markets")
        await page.wait_for_selector("#levels:not(.hidden)")
        locked = await page.evaluate(
            """() => ({
              stall: !document.querySelector('[data-level=stall]').disabled,
              ojaoba: document.querySelector('[data-level=ojaoba]').classList.contains('locked'),
              night: document.querySelector('[data-level=night]').classList.contains('locked'),
            })"""
        )
        print("locked state", locked, flush=True)
        assert locked["stall"] and locked["ojaoba"] and locked["night"]
        await shot(page, "16-level-select-locked.png")

        # unlock + bank, level select open
        await page.evaluate(
            """() => {
              window.__nmr.grantBank(80000);
              window.__nmr.unlockAll();
            }"""
        )
        await page.wait_for_timeout(200)
        unlocked = await page.evaluate(
            """() => Array.from(document.querySelectorAll('#level-grid .level-card')).map(el => ({
              id: el.dataset.level, locked: el.classList.contains('locked'), disabled: el.disabled
            }))"""
        )
        print("unlocked cards", unlocked, flush=True)
        assert all(not c["locked"] and not c["disabled"] for c in unlocked)
        await shot(page, "17-level-select.png")

        # shop
        await page.click("#btn-shop-levels")
        await page.wait_for_selector("#shop:not(.hidden)")
        await shot(page, "18-shop.png")
        # buy all four upgrades
        bought = 0
        for uid in ("hands", "shelf", "apprentice", "canopy"):
            res = await page.evaluate("(id) => window.__nmr.buyUpgrade(id)", uid)
            print("buy", uid, res, flush=True)
            if res and res.get("ok"):
                bought += 1
        assert bought == 4, f"expected 4 upgrades, got {bought}"
        await page.wait_for_timeout(200)
        await shot(page, "19-shop-after-upgrades.png")
        owned = await page.evaluate(
            "() => Array.from(document.querySelectorAll('#shop-list button')).map(b => b.textContent)"
        )
        assert owned == ["Owned", "Owned", "Owned", "Owned"], owned

        # close shop back to levels, start Oja Oba
        await page.click("#shop-close")
        await page.wait_for_selector("#levels:not(.hidden)")
        await page.click("[data-level=ojaoba]")
        await page.wait_for_function("() => window.__nmr.G.playing && window.__nmr.currentLevel().id === 'ojaoba'")
        await wait_waiting(page, timeout=25000)
        await page.wait_for_timeout(800)
        await shot(page, "20-ojaoba-gameplay.png")
        served_oja = await serve_some(page, 2)
        print("ojaoba served (pre-haggle)", served_oja, flush=True)

        ok = await force_haggle(page)
        assert ok, "could not open haggle overlay"
        await page.wait_for_selector("#haggle:not(.hidden)")
        await page.wait_for_timeout(250)
        await shot(page, "21-haggling.png")
        # lock at a mid needle if possible; otherwise just click
        await page.click("#haggle-lock")
        await page.wait_for_function("() => document.getElementById('haggle').classList.contains('hidden')")
        await page.wait_for_timeout(900)
        await shot(page, "22-after-haggle.png")

        await page.evaluate("() => { window.__nmr.G.time = 0.4; }")
        await page.wait_for_selector("#over:not(.hidden)", timeout=8000)
        await shot(page, "23-ojaoba-results.png")
        stars = await page.inner_text("#over-stars")
        print("ojaoba stars", stars, flush=True)

        # Night Market
        await page.click("#btn-over-markets")
        await page.wait_for_selector("#levels:not(.hidden)")
        await page.click("[data-level=night]")
        await page.wait_for_function("() => window.__nmr.G.playing && window.__nmr.currentLevel().id === 'night'")
        await wait_waiting(page, timeout=25000)
        await page.wait_for_timeout(900)
        await shot(page, "24-night-market.png")
        served_night = await serve_some(page, 3)
        print("night served", served_night, flush=True)
        assert served_night >= 2, "night serving failed"
        await page.wait_for_timeout(700)
        await shot(page, "25-night-serving.png")
        await page.evaluate("() => window.__nmr.endRound()")
        await page.wait_for_selector("#over:not(.hidden)")

        # Stall level 1
        await page.click("#btn-over-markets")
        await page.wait_for_selector("#levels:not(.hidden)")
        await page.click("[data-level=stall]")
        await page.wait_for_function("() => window.__nmr.G.playing && window.__nmr.currentLevel().id === 'stall'")
        await wait_waiting(page, timeout=25000)
        await serve_some(page, 2)
        await page.wait_for_timeout(600)
        await shot(page, "26-stall-level1.png")
        await page.evaluate("() => window.__nmr.endRound()")
        await page.wait_for_selector("#over:not(.hidden)")

        # Mobile (close the desktop page first so Swiftshader is not running two WebGL games)
        await page.close()
        mobile = await browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mobile.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        mobile.on("console", lambda m: errors.append("mobile console:" + m.text) if m.type == "error" else None)
        await mobile.goto(URL, wait_until="networkidle", timeout=120000)
        await wait_boot(mobile)
        await mobile.evaluate(
            """() => {
              const p = {bank:50000,muted:true,stars:{stall:1,ojaoba:1,night:1},bestCash:{stall:12000,ojaoba:15000,night:9000},upgrades:{hands:1,shelf:1,apprentice:1,canopy:1}};
              window.__nmr.setProgress(p);
            }"""
        )
        await mobile.tap("#btn-markets")
        await mobile.wait_for_selector("#levels:not(.hidden)")
        await mobile.wait_for_timeout(300)
        await shot(mobile, "27-mobile-level-select.png")
        await mobile.click("[data-level=night]")
        await mobile.wait_for_function("() => window.__nmr.G.playing && window.__nmr.currentLevel().id === 'night'", timeout=20000)
        await mobile.evaluate("() => window.__nmr.spawnCustomer()")
        await wait_waiting(mobile, timeout=40000)
        await mobile.wait_for_timeout(900)
        await shot(mobile, "28-mobile-night.png")
        await browser.close()

    real = [e for e in errors if "favicon" not in e]
    print("console/page errors:", real or "none", flush=True)
    print("shots:", SHOTS, flush=True)
    fatal = [e for e in real if "Error" in e or e.startswith("pageerror")]
    if fatal:
        print("FATAL", fatal, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
