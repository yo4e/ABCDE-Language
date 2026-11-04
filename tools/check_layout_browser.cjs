// Layout/keyboard regression for the word-picking and reading flow.
// Uses an already installed Playwright/Chrome; no production services are contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..');
async function main() {
  const output = path.resolve(process.argv[2] || '/tmp/abcde-layout');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
  const checks = [], sizes = [], errors = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const url = pathToFileURL(path.join(ROOT, 'docs/index.html')).href;
    const load = async (width, height) => {
      await page.setViewportSize({ width, height }); await page.goto(url);
      await page.locator('#controls:not([disabled])').waitFor();
    };
    const shot = async (name, fullPage = true) => {
      if (fullPage) await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, name + '.png'), fullPage });
    };
    const metrics = () => page.evaluate(() => {
      const box = selector => {
        const element = document.querySelector(selector), r = element.getBoundingClientRect(), css = getComputedStyle(element);
        return { top: r.top, bottom: r.bottom, documentTop: r.top + scrollY, height: r.height, width: r.width,
          position: css.position, overflowY: css.overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
      };
      return { viewport: { width: innerWidth, height: innerHeight }, pageHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scrollY,
        dock: box('#composer-dock'), words: box('#words'), input: box('#input-panel'), result: box('#result') };
    });
    const assertLayout = async () => {
      const m = await metrics();
      assert.equal(m.horizontalOverflow, false);
      assert.ok(m.words.scrollHeight <= m.words.clientHeight + 1, 'Word list must never have internal vertical scrolling');
      assert.equal(m.words.overflowY, 'visible');
      assert.equal(m.result.overflowY, 'visible');
      assert.equal(m.result.position, 'static');
      assert.ok(m.dock.height <= 140, 'Confirmation bar must stay compact');
      return m;
    };
    for (const [width, height] of [[1280, 800], [1440, 900], [1024, 768], [768, 1024], [760, 800], [390, 844], [320, 720], [640, 400]]) {
      await load(width, height);
      assert.equal(await page.locator('#words .word-card').count(), 6);
      assert.equal(await page.locator('[data-category="common"]').getAttribute('aria-pressed'), 'true');
      const initial = await assertLayout();
      if (width >= 1100) assert.ok(initial.words.documentTop < 800, 'First word row should start within an 800px desktop viewport');
      if ([1280, 390, 320].includes(width)) await shot('initial-' + width);
      await page.locator('[data-category="all"]').click();
      assert.equal(await page.locator('#words .word-card').count(), 28);
      const all = await assertLayout();
      if (width === 1280) {
        await page.locator('#words .word-card').nth(4).hover();
        const before = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 300);
        await page.waitForFunction(y => scrollY > y, before);
        assert.equal(await page.locator('#words').evaluate(el => el.scrollTop), 0);
        checks.push('Wheel scrolling over word cards moves the page, never an inner card list');
      }
      await page.locator('[data-word="DADA"]').click();
      assert.match(await page.locator('#draft-summary').innerText(), /DADA/);
      assert.match(await page.locator('#draft-words').innerText(), /強い/);
      const end = await assertLayout();
      if ([1280, 390].includes(width)) await shot('last-word-viewport-' + width, false);
      if (height > 600) assert.ok(end.dock.top >= 0 && end.dock.top <= 12, 'Confirmation bar must follow when browsing the last card');
      else assert.equal(end.dock.position, 'static', 'Short landscape/zoomed layouts must not be covered by a sticky bar');
      await page.locator('#go-input').click();
      assert.equal(await page.locator('#text').evaluate(el => el === document.activeElement), true);
      const editing = await metrics();
      if (height > 600) assert.ok(editing.input.bottom > editing.dock.bottom);
      await page.locator('#text').fill('BA BACE ADACA');
      await page.locator('#translate').click();
      assert.equal(await page.locator('#result').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'current');
      assert.equal(await page.locator('#reading-guide').getAttribute('open'), null);
      const reading = await assertLayout();
      if ([1280, 390].includes(width)) await shot('reading-viewport-' + width, false);
      if (height > 600) assert.ok(reading.result.top >= reading.dock.bottom, 'Result heading must not be under the confirmation bar');
      await page.locator('#go-words').click();
      assert.equal(await page.locator('#word-search').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-category="common"]').click();
      await page.locator('#word-search').fill('return');
      assert.equal(await page.locator('#words .word-card').count(), 1);
      assert.equal(await page.locator('#words .word-card').getAttribute('data-word'), 'EADA');
      assert.equal(await page.locator('[data-category="all"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#text').inputValue(), 'BA BACE ADACA');
      sizes.push({ initial, all, browsingLastWord: end, reading });
    }
    checks.push('6 common words, all 28 reachable, search expands to all, single page scrolling at 8 viewport sizes');
    checks.push('Confirmation bar, editable draft/result navigation, result heading visibility, short-height fallback');

    for (const width of [1280, 390]) {
      await load(width, 844);
      // Real sequential keyboard navigation: no forced clicks or programmatic scroll corrections.
      await page.keyboard.press('Tab');
      for (let n = 0; n < 90; n++) {
        const focus = await page.evaluate(() => {
          const target = document.activeElement, r = target.getBoundingClientRect(), dock = document.querySelector('#composer-dock'), d = dock.getBoundingClientRect();
          return { width: innerWidth, top: r.top, bottom: r.bottom, dockBottom: d.bottom, tag: target.tagName, id: target.id, text: target.textContent.slice(0, 70), insideDock: dock.contains(target),
            hiddenByDock: r.top < d.bottom && r.bottom > d.top && r.left < d.right && r.right > d.left,
            // Chromium scroll offsets are integral while text layout can use fractional pixels.
            viewportVisible: r.top >= -1 && r.bottom <= innerHeight + 1 };
        });
        if (focus.tag !== 'BODY') {
          assert.equal(focus.viewportVisible, true, JSON.stringify(focus));
          if (!focus.insideDock) assert.equal(focus.hiddenByDock, false, JSON.stringify(focus));
        }
        await page.keyboard.press(n < 45 ? 'Tab' : 'Shift+Tab');
      }
    }
    checks.push('45 Tab stops followed by 45 Shift+Tab stops at desktop/mobile widths remain visible and are not covered by the sticky bar');

    await load(1280, 800);
    for (const button of await page.locator('.starter-step').all()) await button.click();
    await page.locator('#translate').click();
    await page.locator('#reading-guide > summary').click();
    await page.locator('#translate').click();
    assert.equal(await page.locator('#reading-guide').evaluate(el => el.open), true, 'Later confirmation must preserve an explicitly reopened guide');
    await page.locator('#undo').click();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'stale');
    await page.locator('#redo').click();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'current');
    await page.locator('#core-only').check();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'stale');
    await page.locator('#core-only').uncheck();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'current');
    await page.locator('#clear').click();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'empty');
    await page.locator('#undo').click();
    assert.equal(await page.locator('#composer-dock').getAttribute('data-state'), 'pending');
    await page.locator('#translate').click();
    for (let n = 0; n < 2; n++) await page.locator('#samples').getByRole('button', { name: '助けて', exact: true }).click();
    await page.locator('#translate').click();
    assert.equal(await page.locator('#result .sentence').count(), 3);
    for (const summary of await page.locator('#result .terms > summary').all()) await summary.click();
    const longResult = await assertLayout();
    assert.ok(longResult.result.height > 2000);
    await shot('long-results-expanded');
    await page.locator('#result .terms article').last().scrollIntoViewIfNeeded();
    await page.locator('#go-input').click();
    assert.equal(await page.locator('#text').evaluate(el => el === document.activeElement), true);
    await page.locator('#text').fill('BA\n' + '[<img src=x onerror=alert(1)>]'.repeat(150));
    const longDraft = await assertLayout();
    assert.ok((await page.locator('#draft-summary').textContent()).length <= 81);
    assert.equal(await page.locator('#composer-dock img').count(), 0);
    await page.locator('#text').fill('BA\n');
    assert.match(await page.locator('#draft-summary').innerText(), /BA/);
    await page.locator('#mode-manual').click();
    assert.equal(await page.locator('#go-words').isVisible(), false);
    await page.locator('#source').selectOption('en'); await page.locator('#text').fill('I want water');
    await page.locator('#translate').click();
    assert.match(await page.locator('#summary-label').innerText(), /English → ABCDE/);
    assert.equal(await page.locator('#draft-words').isVisible(), false);
    await assertLayout(); await shot('manual-mode');
    checks.push('Confirmation status stays honest through undo/redo, core changes, clear, manual directions and long drafts');
    checks.push('Three long results with all word details expanded remain in ordinary page flow; no new scroll container');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'layout-results.json'), JSON.stringify({ browser: await browser.version(), checks, sizes, longResult, longDraft, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ checks, errors, sizes: sizes.map(size => ({ viewport: size.initial.viewport, initialHeight: size.initial.pageHeight, firstWordTop: size.initial.words.documentTop, allWordsHeight: size.all.pageHeight })) }, null, 2));
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
