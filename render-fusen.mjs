import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/shaofuwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const origin = 'http://127.0.0.1:8794';
const pages = ['index.html', 'r01/index.html', 'r01/itinerary.html', 'r01/ac/index.html', 'r01/ac/itinerary.html', 'r01/bd/index.html', 'r01/bd/itinerary.html'];
let localLinks = 0;
for (const relative of pages) {
  const filename = path.join(root, 'docs', relative);
  const html = fs.readFileSync(filename, 'utf8');
  assert.equal(/AD|BC|四種組合/.test(html), false, relative);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith('#') || /^https?:/.test(href)) continue;
    let target = path.resolve(path.dirname(filename), href.split('?')[0]);
    if (href.endsWith('/')) target = path.join(target, 'index.html');
    assert.equal(fs.existsSync(target), true, `${relative} missing ${href}`);
    localLinks++;
  }
}
console.log(JSON.stringify({ pages: pages.length, localLinksVerified: localLinks, noDraftReferences: true }));
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true
});

try {
  const posters = [
    ['r01/itinerary.html', 'r01-itinerary.png'],
    ['r01/ac/itinerary.html', 'r01-ac-itinerary.png'],
    ['r01/bd/itinerary.html', 'r01-bd-itinerary.png']
  ];
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [url, filename] of posters) {
    await page.goto(`${origin}/${url}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)), true);
    const poster = page.locator('#poster');
    await poster.screenshot({ path: path.join(root, 'docs/assets', filename) });
    console.log(JSON.stringify({ filename, box: await poster.boundingBox() }));
  }

  fs.mkdirSync(path.join(root, '../tmp/fusen-preview'), { recursive: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['r01/', 'r01/ac/', 'r01/bd/']) {
      await page.goto(`${origin}/${route}`, { waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${route} overflow`);
      assert.equal(await page.locator('a[href*="/ad/"]').count(), 0);
      assert.equal(await page.locator('a[href*="/bc/"]').count(), 0);
      if (route !== 'r01/') {
        const code = route.includes('/ac/') ? 'AC' : 'BD';
        assert.ok((await page.locator('body').innerText()).includes(code));
        await page.locator('#sound-toggle').click();
        await page.waitForFunction(() => window.jinbinSound.enabled);
        assert.equal(await page.evaluate(() => window.jinbinSound.kind), 'r01');
        assert.ok(await page.evaluate(() => window.jinbinSound.whistleCount >= 1));
        await page.locator('#sound-toggle').click();
        await page.locator('[data-pack="0"]').check();
        assert.ok((await page.locator('#packing-count').innerText()).includes('1 / 6'));
      }
      await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
      await page.screenshot({ path: path.join(root, `../tmp/fusen-preview/${route.replaceAll('/', '-')}${width}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  console.log('Posters rendered. Six responsive page checks, image loading, railway sound and packing interactions passed.');
} finally {
  await browser.close();
}
