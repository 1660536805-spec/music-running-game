const { chromium } = require('playwright-core');

(async () => {
  const base = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(base + '?scene=desert', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);

  // jump test
  const rest = await page.evaluate(() => window.__info().desert.heroFeet[1]);
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  const j1 = await page.evaluate(() => window.__info().jump);
  await page.waitForTimeout(140);
  const air = await page.evaluate(() => window.__info().desert.heroFeet[1]);
  const j2 = await page.evaluate(() => window.__info().jump);
  await page.waitForTimeout(900);
  const back = await page.evaluate(() => window.__info().desert.heroFeet[1]);
  console.log('jump states: ' + JSON.stringify(j1) + ' -> ' + JSON.stringify(j2));
  console.log('jump: rest=' + rest + '  air=' + air + '  landed=' + back +
              '  -> lifted=' + (rest - air > 0.02));

  // scene switch via keys
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  const hud1 = await page.evaluate(() => document.querySelector('#huds .hudLayer .title h1') ? document.querySelector('#huds .hudLayer .title h1').textContent : null);
  await page.evaluate(() => window.__setScene('cave'));
  await page.waitForTimeout(400);
  const prompt = await page.evaluate(() => !!document.querySelector('#huds .hudLayer .prompt'));
  await page.evaluate(() => window.__setScene('base'));
  await page.waitForTimeout(400);
  const map = await page.evaluate(() => !!document.querySelector('#huds .hudLayer .map'));

  console.log('home title:', hud1);
  console.log('cave prompt present:', prompt);
  console.log('base minimap present:', map);

  // P7 · 图鉴 / 设置浮层（只打印，不判失败 —— 断言在 mech.js ⑥c）
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  const codex = await page.evaluate(() => {
    const b = document.querySelector('.menu button[data-codex]'); if (!b) return { found: false };
    b.click();
    const el = document.querySelector('#codex');
    return { found: true, on: !!(el && el.classList.contains('on')),
             rows: el ? el.querySelectorAll('#codex .tk').length : 0,
             mechs: el ? el.querySelectorAll('#codex .mch').length : 0 };
  });
  const settings = await page.evaluate(() => {
    const b = document.querySelector('.menu button[data-settings]'); if (!b) return { found: false };
    b.click();
    const el = document.querySelector('#settings');
    return { found: true, on: !!(el && el.classList.contains('on')),
             sliders: el ? el.querySelectorAll('#settings input[type=range]').length : 0,
             switches: el ? el.querySelectorAll('#settings .sw').length : 0,
             bigui: document.body.classList.contains('bigui'),
             rm: document.body.classList.contains('rm') };
  });
  console.log('codex:', JSON.stringify(codex));
  console.log('settings:', JSON.stringify(settings));

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();
