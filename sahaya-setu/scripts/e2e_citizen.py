"""Browser test of the citizen app with a fake camera and GPS. Needs: pip install playwright && playwright install chromium

    uvicorn app.main:app --port 8000      (in one terminal)
    python scripts/e2e_citizen.py --base http://localhost:8000 --shots /tmp/shots
"""
import argparse
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

AMALAPURAM = {"latitude": 16.5787, "longitude": 82.0061, "accuracy": 9}


async def main(base: str, shots: Path):
    shots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        ctx = await browser.new_context(viewport={"width": 400, "height": 860}, geolocation=AMALAPURAM,
                                        permissions=["geolocation", "camera", "microphone"])
        page = await ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(base + "/citizen/")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "c1_home.png"), full_page=True)

        # Register household details before the cyclone
        await page.click("a[href='#/profile']")
        await page.fill("input[name=phone]", "9000000001")
        await page.fill("input[name=village]", "Amalapuram")
        await page.check("input[value=elderly]")
        await page.fill("input[name=contacts]", "9000000002")
        await page.check("input[name=consent]")
        await page.screenshot(path=str(shots / "c1b_profile.png"), full_page=True)
        await page.click("#profile-form button[type=submit]")
        await page.wait_for_timeout(800)

        # Live photo report
        await page.click("a[href='#/report']")
        await page.wait_for_function("document.querySelector('#video').videoWidth > 0", timeout=10000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "c2_camera.png"))
        await page.click("#shutter")
        await page.wait_for_selector("#s-review:not([hidden])")
        await page.click("[data-cat=ELEC]")
        await page.click("[data-stepper=people] button:last-child")
        await page.check("#danger")
        await page.screenshot(path=str(shots / "c3_review.png"), full_page=True)
        await page.click("#send-report")
        await page.wait_for_selector("#s-result:not([hidden])", timeout=15000)
        await page.screenshot(path=str(shots / "c4_result.png"), full_page=True)
        print("RESULT:", (await page.inner_text("#result")).replace("\n", " | ")[:160])
        await page.click("#result a.btn")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "c5_ticket.png"), full_page=True)

        # Offline report: goes to the queue, offers SMS and QR
        await page.goto(base + "/citizen/#/report")
        await page.wait_for_function("document.querySelector('#video').videoWidth > 0", timeout=10000)
        await page.wait_for_timeout(600)
        await ctx.set_offline(True)
        await page.click("#shutter")
        await page.wait_for_selector("#s-review:not([hidden])")
        await page.click("[data-cat=TREE]")
        await page.click("#send-report")
        await page.wait_for_selector("#s-result:not([hidden])", timeout=15000)
        await page.screenshot(path=str(shots / "c6_offline_result.png"), full_page=True)
        sms_href = await page.get_attribute("#result a[href^='sms:']", "href")
        print("OFFLINE SMS LINK:", sms_href[:90] if sms_href else None)
        await page.click("#result a[href='#/relay']")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(shots / "c7_qr.png"), full_page=True)

        # Back online: the queue sends itself (same ID, photo attached)
        await ctx.set_offline(False)
        await page.evaluate("window.dispatchEvent(new Event('online'))")
        await page.wait_for_timeout(3000)
        print("NET BADGE AFTER SYNC:", await page.inner_text("#net"))

        # SOS: hold 3 s, wait 5 s countdown
        await page.goto(base + "/citizen/#/sos")
        await page.wait_for_timeout(500)
        await page.click("[data-sos=MEDICAL]")
        await page.screenshot(path=str(shots / "c8_sos.png"), full_page=True)
        box = await page.locator("#hold").bounding_box()
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.mouse.down()
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "c9_sos_holding.png"))
        await page.wait_for_timeout(1800)
        await page.mouse.up()
        await page.wait_for_selector("#countdown:not([hidden])")
        await page.screenshot(path=str(shots / "c10_countdown.png"))
        await page.wait_for_selector("#s-sos-active:not([hidden])", timeout=9000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(shots / "c11_sos_active.png"), full_page=True)
        print("SOS:", (await page.inner_text("#sos-status")).replace("\n", " | ")[:120])

        # Speak (typed, since headless has no speech recognition)
        await page.click("#sos-safe")
        await page.goto(base + "/citizen/#/speak")
        await page.fill("#speech-text", "అమలాపురం దగ్గర వరద నీరు ఇళ్ళలోకి వస్తోంది")
        await page.click("#send-speech")
        await page.wait_for_selector("#s-result:not([hidden])", timeout=10000)
        print("VOICE:", (await page.inner_text("#result")).replace("\n", " | ")[:100])

        # English mode home
        await page.goto(base + "/citizen/#/home")
        await page.click("#lang")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(shots / "c12_home_en.png"), full_page=True)
        print("ERRORS:", errors)
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--shots", default="shots")
    a = ap.parse_args()
    asyncio.run(main(a.base, Path(a.shots)))
