import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3101";
const owner =
  process.argv[3] ?? "0x35f733b22A851307aE10D6Ba4689510e6Febdc4f";
const tokens = Array.from({ length: 11 }, (_, index) => 42 + index);
const previews = await Promise.all(
  tokens.map(async (token) => {
    const response = await fetch(`${baseUrl}/api/preview/${owner}/${token}`);
    if (!response.ok) throw new Error(`Preview #${token} returned ${response.status}`);
    return { token, data: await response.json() };
  }),
);

const cards = previews
  .map(({ token, data }) => {
    const family = data.svg.match(/data-family="([a-z-]+)"/)?.[1] ?? "unknown";
    const image = `data:image/svg+xml;base64,${Buffer.from(data.svg).toString("base64")}`;
    return `<article><img src="${image}"><strong>#${token}</strong><span>${family}</span></article>`;
  })
  .join("");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1500, height: 1100 },
  deviceScaleFactor: 1,
});
await page.setContent(`
  <style>
    body { margin: 0; padding: 28px; background: #101010; color: #fff; font: 16px monospace; }
    h1 { margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    article { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; background: #222; }
    img { width: 100%; grid-column: 1 / -1; image-rendering: pixelated; }
    span { color: #aaa; }
  </style>
  <h1>Friendenza v4 composition review</h1>
  <div class="grid">${cards}</div>
`);
await page.screenshot({
  path: "artifacts/friendenza-v4-gallery.png",
  fullPage: true,
});
await page.goto(baseUrl);
await page.getByRole("button", { name: "Switch to dark mode" }).click();
await page.screenshot({
  path: "artifacts/friendenza-v4-home-dark.png",
  fullPage: true,
});
await browser.close();
