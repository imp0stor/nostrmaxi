import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

const url = process.env.NOSTRMAXI_URL || "http://127.0.0.1";
const outDir = process.env.OUT_DIR || "/home/neo/nostrmaxi-production/ui-evidence";
const viewports = [
  { w: 320, h: 900 },
  { w: 375, h: 900 },
  { w: 768, h: 1024 },
  { w: 1024, h: 1024 },
];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const file = path.join(outDir, `nostrmaxi-${vp.w}x${vp.h}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}
await browser.close();
console.log(`screenshots: ${outDir}`);
