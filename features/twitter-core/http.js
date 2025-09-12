// features/twitter-core/http.js
const DEFAULT_HEADERS = {
    // Many CDNs block requests without a UA; make it explicit.
    'User-Agent': 'SOULbot/1.0',
    'Accept': 'application/json,text/plain;q=0.8,*/*;q=0.5',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJsonWithFallback(urls, { headers = {}, timeoutMs = 8000, maxRetries = 2, log } = {}) {
    const h = { ...DEFAULT_HEADERS, ...headers };

    for (const [i, url] of urls.entries()) {
        let attempt = 0;
        while (attempt <= maxRetries) {
            const ctrl = new AbortController();
            const to = setTimeout(() => ctrl.abort(), timeoutMs);
            try {
                const res = await fetch(url, { headers: h, signal: ctrl.signal });
                const ct = res.headers.get('content-type') || '';
                const bodyPreview = await (async () => {
                    // Peek without consuming twice: clone then read text from clone.
                    try { return await res.clone().text(); } catch { return ''; }
                })();

                log?.(`[HTTP] ${res.status} ${url} ct=${ct.split(';')[0]} len=${bodyPreview.length}`);

                // 429/5xx → retry (with jitter)
                if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
                    attempt++;
                    const retryAfter = Number(res.headers.get('retry-after')) || 0;
                    const backoff = retryAfter ? retryAfter * 1000 : (500 * attempt + Math.random() * 500);
                    log?.(`[HTTP] retrying ${url} in ${backoff}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(backoff);
                    continue;
                }

                // Try JSON; if HTML/plain, surface details instead of throwing
                if (ct.includes('application/json')) {
                    return { ok: res.ok, status: res.status, json: await res.json() };
                } else {
                    return { ok: res.ok, status: res.status, text: bodyPreview };
                }
            } catch (err) {
                attempt++;
                if (attempt > maxRetries) {
                    return { ok: false, error: String(err), status: 0, text: '' };
                }
                const backoff = 400 * attempt + Math.random() * 400;
                log?.(`[HTTP] error on ${url}: ${err}. retrying in ${backoff}ms`);
                await sleep(backoff);
            } finally {
                clearTimeout(to);
            }
        }
    }
    return { ok: false, status: 0, text: 'No endpoints succeeded' };
}

module.exports = { getJsonWithFallback };
