// The live Netlify bundle was built with NEXT_PUBLIC_API_URL unset, so it calls
// http://localhost:8000. Chrome's Private Network Access blocks an https page from
// reaching a local address, so we intercept those calls in Playwright and fulfil them
// from the real backend ourselves. The page is still the live site; the data is real.
const BACKEND = process.env.BACKEND ?? 'http://127.0.0.1:8000';

export async function installApiBridge(page, { onCall } = {}) {
  await page.route('http://localhost:8000/**', async (route) => {
    const req = route.request();
    const target = BACKEND + new URL(req.url()).pathname + new URL(req.url()).search;
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors, body: '' });
    }
    try {
      const res = await fetch(target, {
        method: req.method(),
        headers: { 'content-type': req.headers()['content-type'] ?? 'application/json' },
        body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      onCall?.(`${res.status} ${req.method()} ${new URL(req.url()).pathname}`);
      await route.fulfill({
        status: res.status,
        headers: {
          ...cors,
          'content-type': res.headers.get('content-type') ?? 'application/json',
          ...(res.headers.get('content-disposition')
            ? { 'content-disposition': res.headers.get('content-disposition') }
            : {}),
        },
        body: buf,
      });
    } catch (err) {
      onCall?.(`BRIDGE-FAIL ${req.method()} ${req.url()} ${err.message}`);
      await route.fulfill({ status: 502, headers: cors, body: '{"error":{"code":"bridge","message":"local backend unreachable"}}' });
    }
  });
}
