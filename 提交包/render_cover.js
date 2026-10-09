const { chromium } = require('/Users/leo/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const { pathToFileURL } = require('url');
(async () => {
  const exe = '/Users/leo/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files','--force-device-scale-factor=1'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => errs.push('REQFAIL: ' + r.url()));
  const url = pathToFileURL('/Users/leo/WorkBuddy/腾讯黑客松/提交包/cover.html').href;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/Users/leo/WorkBuddy/腾讯黑客松/提交包/07-封面图-1920x1080.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ok, no errors');
  await browser.close();
})();
