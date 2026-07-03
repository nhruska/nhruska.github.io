// Render-verify the Light/Dark theme end-to-end with headless Chromium.
// Loads /music/play/ in both themes at phone + desktop, asserts the app mounts,
// asserts zero console/page errors, checks computed bg actually flips, and
// exercises the live in-app Auto/Light/Dark toggle. Screenshots -> outDir.
//
// Manual dev tool (not wired into CI; the repo stays no-build). Run:
//   python3 -m http.server 8123          # from repo root, in one shell
//   npm i playwright                     # one-time; browser is preinstalled
//   node scripts/verify-theme.mjs /tmp/theme-shots
// node_modules + package*.json are gitignored.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8123/music/play/';
const EXE = '/opt/pw-browsers/chromium';
const outDir = process.argv[2] || '/tmp/theme-shots';
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
];
const themes = ['dark', 'light'];

const browser = await chromium.launch({ executablePath: EXE, headless: true });
let hardErrors = [];

async function bg(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

for (const theme of themes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const errs = [];
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('music.theme.v1', t); } catch (e) {}
    }, theme);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#s-library', { timeout: 8000 });
    const attr = await page.getAttribute('html', 'data-theme');
    const bgc = await bg(page);
    const shot = `${outDir}/${theme}-${vp.name}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    // Ignore external-origin fetch failures (Google Fonts CDN is blocked in this
    // sandbox) + PWA/favicon noise; only app-origin JS/console errors are real.
    const bad = errs.filter((e) => !/favicon|manifest|Service Worker|sw\.js|404 \(\)|net::ERR_|fonts\.g(oogleapis|static)/i.test(e));
    console.log(`[${theme} ${vp.name}] data-theme=${attr} bg=${bgc} errors=${bad.length} -> ${shot}`);
    bad.forEach((e) => console.log('     ! ' + e));
    if (attr !== theme) hardErrors.push(`${theme}/${vp.name}: data-theme was '${attr}'`);
    if (bad.length) hardErrors.push(`${theme}/${vp.name}: ${bad.length} console/page errors`);
    await ctx.close();
  }
}

// --- live toggle interaction: dark default -> open Settings -> tap Light ---
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const errs = [];
  // seed an explicit DARK start so clicking Light is a real dark->light flip
  // (headless prefers-color-scheme defaults to light, so 'auto' wouldn't flip).
  await ctx.addInitScript(() => { try { localStorage.setItem('music.theme.v1', 'dark'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#s-library', { timeout: 8000 });
  const before = await bg(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('#themeSeg .thSeg', { timeout: 4000 });
  // click the "Light" segment (data-m="light")
  await page.click('#themeSeg .thSeg[data-m="light"]');
  await page.waitForTimeout(200);
  const afterAttr = await page.getAttribute('html', 'data-theme');
  const after = await bg(page);
  const persisted = await page.evaluate(() => localStorage.getItem('music.theme.v1'));
  await page.screenshot({ path: `${outDir}/toggle-after-light.png` });
  console.log(`[toggle] bg ${before} -> ${after} | data-theme=${afterAttr} | persisted=${persisted} | pageerrors=${errs.length}`);
  if (afterAttr !== 'light') hardErrors.push(`toggle: data-theme did not become light (${afterAttr})`);
  if (before === after) hardErrors.push('toggle: background did not change on Light');
  if (persisted !== 'light') hardErrors.push(`toggle: choice not persisted (${persisted})`);
  errs.forEach((e) => hardErrors.push('toggle ' + e));
  await ctx.close();
}

await browser.close();
console.log('\n' + (hardErrors.length ? 'FAIL:\n - ' + hardErrors.join('\n - ') : 'ALL GREEN: both themes render, mount, flip, and toggle with zero errors'));
process.exit(hardErrors.length ? 1 : 0);
