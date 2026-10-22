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
  const assets = new Map(await Promise.all(['index.html', 'style.css', 'data.js', 'engine.js', 'app.js'].map(async name =>
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
      await page.getByLabel('翻訳の方向').selectOption(source);
      await page.getByLabel('入力する言葉').fill(value);
      await page.getByRole('button', { name: '読みを確認', exact: true }).click();
    };
    const shot = name => page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot('desktop-start');
    const loadedRequests = requests.length;
    // Test the same full corpus in actual Chromium, independent of Node's V8.
    for (let offset = 0; offset < corpus.cases.length; offset += 250) {
      const batch = corpus.cases.slice(offset, offset + 250);
      const actual = await page.evaluate(cases => cases.map(test => test.source === 'abcde'
        ? ABCDE.analyze(test.text, test.conventions) : ABCDE.reverse(test.text, test.source)), batch);
      actual.forEach((value, i) => assert.deepEqual(value, corpus.expected[offset + i], 'Parity case ' + JSON.stringify(batch[i]).slice(0,200)));
    }
    checks.push('Full JSON matches Python for ' + corpus.cases.length + ' cases in Chromium');
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
    await page.locator('#samples').getByRole('button', { name: '水がほしい', exact: true }).click();
    assert.equal(await page.getByLabel('翻訳の方向').inputValue(), 'ja');
    assert.equal(await page.getByLabel('アトムと構文だけを見る（ABCDE入力）').isChecked(), false);
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
    await page.locator('.phrasebook > summary').click();
    await page.locator('#phrases').getByRole('button', { name: 'Help me', exact: true }).click();
    assert.equal(await page.getByLabel('翻訳の方向').inputValue(), 'en');
    assert.match(await text(), /A! CEDA BA/);
    assert.equal(page.url(), fileURL);
    assert.equal(requests.length, loadedRequests);
    checks.push('Repeated operations, editing, clear, examples, phrasebook; no navigation or requests on input');

    await page.setViewportSize({ width: 390, height: 844 });
    await submit('ja', '助けて'); await noOverflow(); await shot('mobile-help');
    await submit('abcde', 'CE DE'); await noOverflow(); await shot('mobile-ambiguous');
    await page.setViewportSize({ width: 320, height: 720 });
    await submit('abcde', '[' + 'longlabel'.repeat(40) + ']'); await noOverflow();
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
