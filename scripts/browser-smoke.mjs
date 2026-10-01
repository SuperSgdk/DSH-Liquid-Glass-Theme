// Run against an isolated DSH profile. No messages are sent to a model.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const url = process.env.DSH_TEST_URL;
if (!url) throw new Error('Set DSH_TEST_URL to the isolated profile URL, including its token.');
const out = resolve(process.env.DSH_TEST_OUTPUT ?? '.validation/browser');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
async function dismissOnboarding(page) {
  for (const name of ['继续', '稍后配置']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await button.isVisible()) await button.click();
  }
  await page.keyboard.press('Escape');
}
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('crash', () => errors.push('Browser renderer crashed'));
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-dsh-aqua'), { timeout: 30000 });
  await dismissOnboarding(page);
  await page.screenshot({ path: resolve(out, 'wide.png'), fullPage: true });
  const result = await page.evaluate(() => ({
    title: document.title,
    aqua: document.documentElement.hasAttribute('data-dsh-aqua'),
    float: document.documentElement.hasAttribute('data-dsh-float'),
    styles: [...document.querySelectorAll('style[data-plugin="dsh-liquid-glass-theme"]')].map(s => s.dataset.pluginCss),
  }));
  result.errors = errors;
  assert.equal(result.aqua, true);
  assert(result.styles.length >= 4);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  for (const label of ['玻璃模糊度', '磨砂度', '背景亮度']) {
    await page.getByText(label, { exact: true }).waitFor({ state: 'visible' });
  }
  result.appearanceControls = true;
  await page.locator('[role="dialog"]').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  await page.screenshot({ path: resolve(out, 'settings.png'), fullPage: true });
  await page.getByRole('button', { name: '插件', exact: true }).click();
  const card = page.locator('li').filter({ hasText: 'DSH液态玻璃皮肤插件' });
  await card.waitFor({ state: 'visible' });
  const toggle = card.getByRole('button');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await toggle.click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-dsh-aqua'));
  await page.reload();
  await dismissOnboarding(page);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '插件', exact: true }).click();
  await card.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('html').getAttribute('data-dsh-aqua'), null);
  await toggle.click();
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-dsh-aqua'));
  await page.screenshot({ path: resolve(out, 'plugins.png'), fullPage: true });
  result.settingsCard = true;
  result.toggleOffSurvivesReload = true;
  result.toggleOnRestoresTheme = true;
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const collapse = page.getByRole('button', { name: '收起侧边栏', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  result.viewports = [];
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    result.viewports.push(await page.evaluate(() => ({ width: innerWidth, bodyWidth: document.body.scrollWidth, viewportWidth: document.documentElement.clientWidth })));
    await page.screenshot({ path: resolve(out, `viewport-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
