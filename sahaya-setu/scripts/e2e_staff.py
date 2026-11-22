"""Browser test of the dashboard, field app and public board. Run seed_demo.py first.

    python scripts/e2e_staff.py --base http://localhost:8000 --shots /tmp/shots
"""
import argparse
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


async def main(base: str, shots: Path):
    shots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        errors = []

        def watch(page):
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "tile.openstreetmap" not in m.text
                    and "ERR_" not in m.text else None)

        # Control room
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page(); watch(page)
        await page.goto(base + "/dashboard/")
        await page.wait_for_selector("#login:not([hidden])")
        await page.screenshot(path=str(shots / "d0_login.png"))
        await page.click("[data-token=control-demo]")
        await page.wait_for_selector(".strip", timeout=10000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "d1_queue.png"))
        await page.click(".strip.sos")
        await page.wait_for_selector("#detail:not([hidden]) .d-head")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(shots / "d2_sos_detail.png"))
        await page.click(".box.actions [data-status=assigned]")
        await page.wait_for_timeout(1200)
        print("SOS AFTER ASSIGN:", await page.inner_text("#detail .d-tags"))
        # review ticket -> merge
        await page.click("#counters [data-quick=review]")
        await page.wait_for_timeout(500)
        await page.click(".strip >> nth=0")
        await page.wait_for_selector("#detail .box.review")
        await page.screenshot(path=str(shots / "d3_review.png"))
        merge = page.locator("[data-merge]")
        if await merge.count():
            await merge.first.click()
            await page.wait_for_timeout(1200)
            print("AFTER MERGE:", (await page.inner_text("#detail .d-head")).strip())
        # warnings
        await page.click("[data-view=alerts]")
        await page.wait_for_timeout(1200)
        await page.click("[data-vuln]")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(shots / "d4_alerts.png"), full_page=True)
        print("VULNERABLE:", (await page.inner_text("#vulnerable h2")).strip())
        await page.fill("#alert-form [name=title]", "Heavy rain warning for Kakinada")
        await page.fill("#alert-form [name=message]", "Stay indoors after 8 PM.")
        await page.click("#alert-form button[type=submit]")
        await page.wait_for_timeout(1000)
        print("ALERTS LISTED:", await page.locator("#alert-list li").count())
        # sitrep
        await page.click("[data-view=sitrep]")
        await page.click("#sitrep-run")
        await page.wait_for_function("document.querySelector('#sitrep-text').textContent.length > 50", timeout=10000)
        await page.screenshot(path=str(shots / "d5_sitrep.png"))
        await page.click("[data-view=sms]")
        await page.wait_for_timeout(800)
        print("SMS ROWS:", await page.locator("#sms-rows tr").count())
        await ctx.close()

        # Department desk only sees its own tickets
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await ctx.new_page(); watch(page)
        await page.goto(base + "/dashboard/")
        await page.click("[data-token=elec-demo]")
        await page.wait_for_timeout(1500)
        print("ELECTRICITY DESK SEES:", await page.locator(".strip").count(), "tickets; sitrep tab hidden:",
              await page.locator("[data-view=sitrep]").is_hidden())
        await ctx.close()

        # Field team on a phone
        ctx = await browser.new_context(viewport={"width": 400, "height": 840}, geolocation={"latitude": 16.58, "longitude": 82.0},
                                        permissions=["geolocation"])
        page = await ctx.new_page(); watch(page)
        await page.goto(base + "/field/")
        await page.fill("input[name=t]", "elec-demo")
        await page.click("button[type=submit]")
        await page.wait_for_selector(".job", timeout=8000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(shots / "f1_jobs.png"), full_page=True)
        await page.click(".job >> nth=0")
        await page.wait_for_selector("#fix")
        await page.screenshot(path=str(shots / "f2_job.png"), full_page=True)
        await page.set_input_files("#proof", str(shots / "c2_camera.png") if (shots / "c2_camera.png").exists() else str(shots / "d1_queue.png"))
        await page.wait_for_timeout(1500)
        print("FIELD AFTER FIX:", (await page.inner_text("main"))[:60].replace("\n", " "))
        await ctx.close()

        # Public board
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page(); watch(page)
        await page.goto(base + "/board/")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(shots / "b1_board.png"), full_page=True)
        await page.goto(base + "/")
        await page.screenshot(path=str(shots / "l1_landing.png"))
        print("ERRORS:", errors)
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--shots", default="shots")
    a = ap.parse_args()
    asyncio.run(main(a.base, Path(a.shots)))
