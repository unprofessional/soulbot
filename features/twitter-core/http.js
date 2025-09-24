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
 * - Always attach {url} to the result so callers can attribute errors.
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

                // Handle retries
                if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
                    attempt++;
                    if (attempt > maxRetries) {
                        // Exhausted retries for this URL, fall through to next URL
                        lastResult = { ok: false, status: res.status, text: bodyPreview, url };
                        break;
                    }
                    const retryAfter = Number(res.headers.get('retry-after')) || 0;
                    const backoff = retryAfter ? retryAfter * 1000 : (500 * attempt + Math.random() * 500);
                    log?.(`[HTTP] retrying ${url} in ${backoff}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(backoff);
                    continue;
                }

                // If OK, return immediately (JSON preferred, but text is fine)
                if (res.ok) {
                    if (ct.includes('application/json')) {
                        return { ok: true, status: res.status, json: await res.json(), url };
                    } else {
                        return { ok: true, status: res.status, text: bodyPreview, url };
                    }
                }

                // Non-OK but not retryable (e.g., 400/401/403/404/etc). Fall through to next URL.
                // Keep this as the lastResult so callers can see what happened if all fail.
                if (ct.includes('application/json')) {
                    let parsed;
                    try { parsed = JSON.parse(bodyPreview); } catch { parsed = undefined; }
                    lastResult = { ok: false, status: res.status, json: parsed, text: bodyPreview, url };
                } else {
                    lastResult = { ok: false, status: res.status, text: bodyPreview, url };
                }
                // Break out of retry loop for this URL and proceed to next one.
                break;
            } catch (err) {
                attempt++;
                if (attempt > maxRetries) {
                    // Network/timeout exhausted for this URL; fall through to next URL
                    lastResult = { ok: false, error: String(err), status: 0, text: '', url };
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
