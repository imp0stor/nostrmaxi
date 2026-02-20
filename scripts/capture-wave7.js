const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const baseUrl = "http://localhost:8085";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjNmVlZmFkYjQzYmI4YThjNzA1MjM4ZGRhMTE3MmNmNDcwNTdlMzYyNjFlZTRmZTRmODc3YjlkYTdkNjNkMzRmIiwic2Vzc2lvbklkIjoiODQ0N2NjMzYzNTc0ZWE1ZDZmM2JmZTFkNmEyMjcyOThkM2MwZTUwZjA2Mjk3ZTRlM2ZlODYwZWU0NGQ1MTU1ZCIsImlhdCI6MTc3MTMwMjM3NiwiZXhwIjoxNzczODk0Mzc2fQ.wVcN--DQC5B1cFZehYUl5m7NdwBSCJVEp_s2PLYu97M";
const outputDir = "/home/neo/nostrmaxi-production/ui-evidence/wave7";
const viewports = [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
];
const pages = [
  { name: "pricing", path: "/pricing" },
  { name: "nip05", path: "/nip05" },
];

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 60000) {
    try {
      const res = await fetch(baseUrl, { method: "GET" });
      if (res.ok) return;
    } catch (err) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Server did not start in time");
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.addInitScript((tokenValue) => {
    localStorage.setItem("nostrmaxi_token", tokenValue);
  }, token);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const target of pages) {
      const url = `${baseUrl}${target.path}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const file = path.join(
        outputDir,
        `${target.name}-${viewport.width}x${viewport.height}.png`
      );
      await page.screenshot({ path: file, fullPage: true });
    }
  }

  await browser.close();
  console.log("Screenshots saved to", outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
