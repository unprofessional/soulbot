// features/twitter-core/http.js
const DEFAULT_HEADERS = {
    // Many CDNs block requests without a UA; make it explicit.
    'User-Agent': 'SOULbot/1.0',
    'Accept': 'application/json,text/plain;q=0.8,*/*;q=0.5',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Try a list of URLs in order. For each URL:
 * - Retry on 429/5xx and network errors.
 * - If 4xx (except 429), DO NOT return; fall through to the next URL.
 * - If 2xx BUT Content-Type is NOT JSON, treat as failure and fall through (APIs should return JSON).
 * - Always attach {url, ct} to the result for attribution.
 */
async function getJsonWithFallback(
    urls,
    { headers = {}, timeoutMs = 8000, maxRetries = 2, log } = {}
) {
    const h = { ...DEFAULT_HEADERS, ...headers };
    let lastResult = { ok: false, status: 0, text: 'No endpoints succeeded' };

    for (const url of urls) {
        let attempt = 0;

        while (attempt <= maxRetries) {
            const ctrl = new AbortController();
            const to = setTimeout(() => ctrl.abort(), timeoutMs);

            try {
                const res = await fetch(url, { headers: h, signal: ctrl.signal });
                const ct = res.headers.get('content-type') || '';
                const bodyPreview = await (async () => {
                    try { return await res.clone().text(); } catch { return ''; }
                })();

                log?.(`[HTTP] ${res.status} ${url} ct=${ct.split(';')[0]} len=${bodyPreview.length}`);

                // Retryables
                if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
                    attempt++;
                    if (attempt > maxRetries) {
                        lastResult = { ok: false, status: res.status, text: bodyPreview, url, ct };
                        break;
                    }
                    const retryAfter = Number(res.headers.get('retry-after')) || 0;
                    const backoff = retryAfter ? retryAfter * 1000 : (500 * attempt + Math.random() * 500);
                    log?.(`[HTTP] retrying ${url} in ${backoff}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(backoff);
                    continue;
                }

                // 2xx
                if (res.ok) {
                    if (ct.includes('application/json')) {
                        return { ok: true, status: res.status, json: await res.json(), url, ct };
                    }
                    // HTML or other non-JSON "success" (e.g., provider error pages) → treat as failure and fall through
                    lastResult = { ok: false, status: res.status, text: bodyPreview, url, ct };
                    break;
                }

                // Non-OK and non-retryable (4xx except 429): fall through
                if (ct.includes('application/json')) {
                    let parsed;
                    try { parsed = JSON.parse(bodyPreview); } catch { parsed = undefined; }
                    lastResult = { ok: false, status: res.status, json: parsed, text: bodyPreview, url, ct };
                } else {
                    lastResult = { ok: false, status: res.status, text: bodyPreview, url, ct };
                }
                break;
            } catch (err) {
                attempt++;
                if (attempt > maxRetries) {
                    lastResult = { ok: false, error: String(err), status: 0, text: '', url, ct: '' };
                    break;
                }
                const backoff = 400 * attempt + Math.random() * 400;
                log?.(`[HTTP] error on ${url}: ${err}. retrying in ${backoff}ms`);
                await sleep(backoff);
            } finally {
                clearTimeout(to);
            }
        }
    }

    return lastResult;
}

module.exports = { getJsonWithFallback };
