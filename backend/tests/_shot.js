const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_phase_e_out');
const IMG = path.join(__dirname, '_phase_e_img');
if (!fs.existsSync(IMG)) fs.mkdirSync(IMG);

(async () => {
  const files = process.argv.slice(2);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });
  for (const f of files) {
    const p = path.resolve(OUT, f);
    const url = 'file:///' + p.replace(/\\/g, '/');
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2500));
      const png = path.join(IMG, f.replace(/\.pdf$/, '') + '.png');
      await page.screenshot({ path: png, fullPage: false });
      console.log('[SHOT]', png);
    } catch (e) {
      console.log('[FAIL]', f, e.message);
    }
  }
  await browser.close();
})();
