"""
Take baseline screenshots of Nachi for the README.

Requires a running dev server (./run.sh) and an uploaded sample document
so the PDF pane has content. Default expects docs/samples/about-nachi.pdf
to already be in the app.

Run with the nachi venv active:
    ~/.nachi/venv/bin/python docs/samples/take-screenshots.py
"""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path(__file__).parent.parent / "screenshots"
URL = "http://localhost:5173"


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # Make sure we open in a clean, known state.
        await page.add_init_script(
            "localStorage.setItem('nachi:theme', 'light');"
            "localStorage.removeItem('nachi:split');"
        )

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_selector(".app", timeout=15_000)

        # Wait for pdf.js to actually paint: a canvas with real pixel data.
        await page.wait_for_selector(".pdf-page canvas", timeout=15_000)
        await page.wait_for_function(
            """() => {
                const c = document.querySelector('.pdf-page canvas');
                if (!c || !c.getContext) return false;
                // Canvas must have non-zero dimensions and some non-default pixel
                const ctx = c.getContext('2d');
                if (!ctx) return false;
                if (c.width < 50 || c.height < 50) return false;
                // Sample a pixel in the middle — expect non-black once rendered
                try {
                  const data = ctx.getImageData(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1).data;
                  return data[0] > 10 || data[1] > 10 || data[2] > 10 || data[3] > 10;
                } catch { return true; }
            }""",
            timeout=20_000,
        )
        # Settle: fonts, highlight layers, second-pass layout.
        await page.wait_for_timeout(2500)

        # 1. Overview, light mode.
        await page.screenshot(path=str(OUT / "overview-light.png"), full_page=False)
        print(f"wrote {OUT / 'overview-light.png'}")

        # 2. Overview, dark mode.
        await page.click(".theme-toggle")
        await page.wait_for_timeout(700)
        await page.screenshot(path=str(OUT / "overview-dark.png"), full_page=False)
        print(f"wrote {OUT / 'overview-dark.png'}")

        # Back to light for the modal screenshot.
        await page.click(".theme-toggle")
        await page.wait_for_timeout(500)

        # 3. Scholar editor modal.
        try:
            await page.click(".agent-edit-btn", timeout=3000)
            await page.wait_for_selector(".modal-edit-agent", timeout=5000)
            # Wait for the persona textarea to populate from /agents/:id fetch.
            await page.wait_for_selector(".edit-agent-textarea", timeout=5000)
            await page.wait_for_timeout(1500)
            await page.screenshot(path=str(OUT / "editor.png"))
            print(f"wrote {OUT / 'editor.png'}")
            # close modal
            await page.keyboard.press("Escape")
        except Exception as e:
            print(f"editor screenshot skipped: {e}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
