// Optional real-browser checks. Use an already installed Playwright + Chromium.
// PLAYWRIGHT_MODULE=/path/to/playwright node tools/check_static_browser.cjs /tmp/abcde-static
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const output = path.resolve(process.argv[2] || '/tmp/abcde-static');
  await fs.mkdir(output, { recursive: true });
  const python = spawnSync(process.env.PYTHON || 'python3', ['tools/static_cases.py'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000,
  });
  assert.equal(python.status, 0, python.stderr);
  const corpus = JSON.parse(python.stdout);
  const assets = new Map(await Promise.all(['index.html', 'style.css', 'data.js', 'engine.js', 'composer.js', 'app.js'].map(async name =>
    [name, await fs.readFile(path.join(ROOT, 'docs', name))])));
  const server = http.createServer((request, response) => {
    const name = request.url === '/ABCDE-Language/' ? 'index.html' : request.url.replace(/^\/ABCDE-Language\//, '');
    if (request.method !== 'GET' || !request.url.startsWith('/ABCDE-Language/') || !assets.has(name)) {
      response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(assets.get(name));
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const httpURL = 'http://127.0.0.1:' + server.address().port + '/ABCDE-Language/';
    const fileURL = pathToFileURL(path.join(ROOT, 'docs/index.html')).href;
    browser = await chromium.launch({ headless: true });
    const errors = [], unexpected = [], requests = [], checks = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    context.on('request', request => {
      requests.push(request.url());
      if (request.method() !== 'GET' || !(request.url().startsWith(httpURL) || request.url().startsWith(pathToFileURL(path.join(ROOT, 'docs') + path.sep).href))) unexpected.push(request.url());
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('dialog', async dialog => { errors.push('Unexpected dialog: ' + dialog.message()); await dialog.dismiss(); });
    await page.goto(fileURL);
    await page.getByRole('button', { name: '読みを確認', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '読みを確認', exact: true }).isEnabled(), true);
    const result = page.locator('#result');
    const text = () => result.innerText();
    const submit = async (source, value) => {
      await page.locator('#mode-manual').click();
      await page.getByLabel('翻訳の方向').selectOption(source);
      await page.getByLabel('入力する言葉').fill(value);
      await page.getByRole('button', { name: '読みを確認', exact: true }).click();
    };
    const shot = name => page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot('desktop-start');
    let loadedRequests = requests.length;
    // Test the same full corpus in actual Chromium, independent of Node's V8.
    for (let offset = 0; offset < corpus.cases.length; offset += 250) {
      const batch = corpus.cases.slice(offset, offset + 250);
      const actual = await page.evaluate(cases => cases.map(test => test.source === 'abcde'
        ? ABCDE.analyze(test.text, test.conventions) : ABCDE.reverse(test.text, test.source)), batch);
      actual.forEach((value, i) => assert.deepEqual(value, corpus.expected[offset + i], 'Parity case ' + JSON.stringify(batch[i]).slice(0,200)));
    }
    checks.push('Full JSON matches Python for ' + corpus.cases.length + ' cases in Chromium');

    // Composition is separate from manual direction-specific drafts.
    const draft = page.locator('#text');
    const word = token => page.locator('#words [data-word="' + token + '"]').click();
    const confirm = () => page.getByRole('button', { name: '読みを確認', exact: true }).click();
    assert.equal(await page.locator('#words .word-card').count(), 28);
    for (const token of ['BA', 'BACE', 'ADACA']) await word(token);
    assert.equal(await draft.inputValue(), 'BA BACE ADACA');
    assert.match(await page.locator('#word-preview').innerText(), /私/);
    assert.match(await page.locator('#word-preview').innerText(), /水/);
    await confirm();
    assert.equal(await result.locator('.roles dd').nth(0).innerText(), 'BA');
    assert.equal(await result.locator('.roles dd').nth(2).innerText(), 'ADACA');
    await shot('desktop-composed-water');
    await page.locator('#undo').click(); assert.equal(await draft.inputValue(), 'BA BACE');
    assert.equal(await page.locator('#stale-note').isVisible(), true);
    await page.locator('#redo').click(); assert.equal(await draft.inputValue(), 'BA BACE ADACA');
    await page.locator('#clear').click(); assert.equal(await draft.inputValue(), '');
    await page.locator('#undo').click(); assert.equal(await draft.inputValue(), 'BA BACE ADACA');
    await page.locator('#new-sentence').click();
    await word('CEDA'); await word('BA');
    assert.equal(await draft.inputValue(), 'BA BACE ADACA\nCEDA BA');
    await confirm();
    assert.equal(await result.locator('.sentence').count(), 2);
    assert.equal(await result.locator('.sentence').nth(1).locator('.unspecified').count(), 1);
    await page.locator('#samples').getByRole('button', { name: '助けて', exact: true }).click();
    await page.locator('#samples').getByRole('button', { name: '助けて', exact: true }).click();
    assert.equal(await draft.inputValue(), 'BA BACE ADACA\nCEDA BA\nA! CEDA\nA! CEDA');
    await page.locator('.phrasebook > summary').click();
    await page.locator('#phrases').getByRole('button', { name: 'Help me', exact: true }).click();
    assert.match(await draft.inputValue(), /A! CEDA\nA! CEDA\nA! CEDA BA$/);
    await page.locator('.phrasebook > summary').click();
    const assembled = await draft.inputValue();
    checks.push('28 shared word cards; append, explicit line break, repeated phrases, undo/redo and reversible clear');

    await submit('ja', '水はいらない');
    await submit('en', 'I want water');
    await submit('abcde', 'BACEDA');
    await page.locator('#source').selectOption('ja'); assert.equal(await draft.inputValue(), '水はいらない');
    await page.locator('#source').selectOption('en'); assert.equal(await draft.inputValue(), 'I want water');
    await page.locator('#mode-build').click(); assert.equal(await draft.inputValue(), assembled);
    await draft.selectText(); // A card always appends; it never replaces the selected text.
    await word('BA'); assert.equal(await draft.inputValue(), assembled + ' BA');
    await page.locator('#undo').click(); assert.equal(await draft.inputValue(), assembled);
    await page.locator('#clear').click();
    await draft.fill('CE DE'); await confirm();
    assert.equal(await result.locator('.roles').count(), 2);
    await page.locator('#undo').click(); assert.equal(await draft.inputValue(), '');
    await page.locator('#redo').click(); assert.equal(await draft.inputValue(), 'CE DE');
    await draft.press('Meta+z'); assert.equal(await draft.inputValue(), '');
    await draft.press('Meta+Shift+z'); assert.equal(await draft.inputValue(), 'CE DE');
    await page.locator('#word-search').fill('water');
    assert.equal(await page.locator('#words .word-card').count(), 1);
    await page.locator('[data-category="predicate"]').click();
    assert.equal(await page.locator('#no-words').isVisible(), true);
    await page.locator('#word-search').fill('');
    await page.locator('[data-category="all"]').click();
    assert.equal(await page.locator('#words .word-card').count(), 28);
    const contextual = page.locator('#words [data-word="ACA"]');
    assert.match(await contextual.innerText(), /日 \/ ここ \/ 赤/);
    await page.locator('#new-sentence').click(); await word('ACA'); await confirm();
    assert.equal(await draft.inputValue(), 'CE DE\nACA');
    assert.match(await page.locator('#word-preview').innerText(), /日 \/ ここ \/ 赤/);
    assert.match(await text(), /day \/ here \/ red/);
    await page.locator('#clear').click();
    await draft.fill('A'.repeat(8192)); await word('BA');
    assert.equal((await draft.inputValue()).length, 8192);
    assert.match(await page.locator('#edit-message').innerText(), /今の入力はそのまま/);
    await page.locator('#undo').click(); assert.equal(await draft.inputValue(), '');
    await page.locator('#mode-manual').click();
    await page.locator('#source').selectOption('ja'); assert.equal(await draft.inputValue(), '水はいらない');
    checks.push('All manual drafts survive building; caret selection, typing undo, keyboard undo, search and refusal at input limit');

    await page.goto(fileURL); // Explicit reload clears in-memory drafts, as documented.
    assert.equal(await draft.inputValue(), '');
    await page.locator('#mode-manual').click(); assert.equal(await draft.inputValue(), '');
    loadedRequests = requests.length;
    await submit('ja', '水がほしい');
    assert.match(await text(), /BACE ADACA/);
    assert.equal(await result.locator('.unspecified').count(), 1);
    await submit('ja', '助けて');
    assert.equal(await result.locator('.unspecified').count(), 2);
    assert.match(await text(), /この読みの前提/);
    assert.match(await text(), /助ける側・助けられる側は未指定/);
    await shot('desktop-help');
    for (const [phrase, target] of [['私を助けて', 'BA'], ['あの人を助けて', 'BEBACA']]) {
      await submit('ja', phrase);
      assert.equal(await result.locator('.roles dd').nth(2).innerText(), target);
    }
    await submit('en', 'I want water');
    assert.match(await text(), /BA BACE ADACA/);
    await submit('ja', '食べないで');
    await result.locator('.terms > summary').click();
    assert.match(await text(), /否定：この語全体を否定/);
    await submit('abcde', 'CE DE');
    assert.equal(await result.locator('.roles').count(), 2);
    assert.match(await text(), /良い \/ 好む/);
    await shot('desktop-ambiguous');
    await submit('abcde', 'A- EADA E 3ACA');
    assert.match(await text(), /日 \/ ここ \/ 赤/);
    assert.match(await text(), /発話時点から 3 日後/);
    await shot('desktop-time');
    checks.push('Water, help, distinct beneficiaries, English, negation, ambiguous roles and relative days');

    await page.getByLabel('アトムと構文だけを見る（ABCDE入力）').check();
    await page.getByRole('button', { name: '読みを確認', exact: true }).click();
    assert.equal(await result.locator('.candidate, .lexical').count(), 0);
    assert.match(await text(), /アトムと構文のみ/);
    await page.locator('#mode-build').click();
    await page.locator('#samples').getByRole('button', { name: '水がほしい', exact: true }).click();
    assert.equal(await page.getByLabel('アトムと構文だけを見る（ABCDE入力）').isChecked(), true);
    await page.getByLabel('アトムと構文だけを見る（ABCDE入力）').uncheck();
    await confirm();
    assert.match(await text(), /BACE ADACA/);
    await submit('ja', '助けないで');
    assert.match(await text(), /この表現は未対応/);
    assert.equal(await result.locator('.answer').count(), 0);
    await shot('desktop-unsupported');
    await submit('abcde', 'BACE ADACA\nAB');
    assert.equal(await result.locator('.sentence').count(), 2);
    assert.equal(await result.locator('.candidate').count(), 1);
    await submit('abcde', 'BACEDA');
    await result.locator('.terms > summary').click();
    assert.match(await text(), /BA \+ CE \+ DA/);
    await submit('abcde', '[<script>alert(1)</script>]');
    assert.equal(await result.locator('script').count(), 0);
    await submit('ja', '</textarea><img src=x onerror=alert(1)>');
    assert.equal(await page.locator('img').count(), 0);
    await submit('ja', 'あ'.repeat(8193));
    assert.match(await text(), /1〜8192文字/);
    await submit('ja', '');
    assert.match(await text(), /入力を確認/);
    checks.push('Core-only mode, unsupported/invalid/unknown input, HTML text safety, empty and over-limit input');

    for (let i = 0; i < 3; i++) {
      await submit('ja', '水がほしい');
      await submit('ja', '助けて');
      assert.doesNotMatch(await text(), /BACE ADACA/);
    }
    await page.getByLabel('入力する言葉').fill('水がほしい');
    assert.match(await result.locator('.submission').innerText(), /助けて/);
    await page.getByRole('button', { name: 'クリア', exact: true }).click();
    assert.equal(await page.getByLabel('入力する言葉').inputValue(), '');
    assert.equal(await result.locator('.answer').count(), 0);
    await page.locator('#mode-build').click();
    await page.locator('.phrasebook > summary').click();
    await page.locator('#phrases').getByRole('button', { name: 'Help me', exact: true }).click();
    assert.equal(await draft.inputValue(), 'BACE ADACA\nA! CEDA BA');
    await confirm();
    assert.match(await text(), /A! CEDA BA/);
    assert.equal(page.url(), fileURL);
    assert.equal(requests.length, loadedRequests);
    checks.push('Repeated operations, editing, clear, examples, phrasebook; no navigation or requests on input');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.phrasebook > summary').click();
    await page.locator('#clear').click();
    for (const token of ['BA', 'CEDA', 'BEBACA']) await word(token);
    assert.equal(await draft.inputValue(), 'BA CEDA BEBACA');
    await page.locator('#undo').click(); await page.locator('#redo').click(); await confirm();
    await noOverflow(); await shot('mobile-composer');
    await submit('ja', '助けて'); await noOverflow(); await shot('mobile-help');
    await submit('abcde', 'CE DE'); await noOverflow(); await shot('mobile-ambiguous');
    await page.setViewportSize({ width: 320, height: 720 });
    await submit('abcde', '[' + 'longlabel'.repeat(40) + ']'); await noOverflow();
    await page.locator('#mode-build').click();
    await page.locator('#samples').getByRole('button', { name: '助けて', exact: true }).click();
    assert.equal(await draft.inputValue(), 'BA CEDA BEBACA\nA! CEDA');
    await confirm();
    assert.equal(await result.locator('.sentence').nth(1).locator('.unspecified').count(), 2);
    await noOverflow(); await shot('narrow-composer');
    const colors = await page.evaluate(() => ({ background: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color, button: getComputedStyle(document.getElementById('translate')).backgroundColor }));
    assert.deepEqual(colors, { background: 'rgb(255, 255, 255)', text: 'rgb(23, 23, 23)', button: 'rgb(255, 214, 41)' });
    checks.push('White/black/yellow palette and composition/undo/repeated additions at 390px and 320px');
    checks.push('1280px/390px/320px responsive layout, long labels without horizontal overflow');

    await page.goto(httpURL);
    await submit('ja', '助けて');
    assert.match(await text(), /A! CEDA/);
    const httpLoaded = requests.length;
    await context.setOffline(true);
    await submit('ja', '水がほしい');
    assert.match(await text(), /BACE ADACA/);
    assert.equal(requests.length, httpLoaded);
    assert.equal(page.url(), httpURL);
    checks.push('GitHub Pages project subpath and continued operation offline after loading');
    await context.close();

    const plain = await browser.newContext({ javaScriptEnabled: false });
    const plainPage = await plain.newPage();
    await plainPage.goto(fileURL);
    assert.equal(await plainPage.getByRole('button', { name: '読みを確認', exact: true }).isDisabled(), true);
    assert.match(await plainPage.locator('noscript').innerText(), /JavaScriptが必要/);
    await plain.close();
    checks.push('JavaScript-disabled fallback explains requirement and cannot submit input');
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    const report = { browser: await browser.version(), parityCases: corpus.cases.length, checks, errors, unexpectedRequests: unexpected };
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
