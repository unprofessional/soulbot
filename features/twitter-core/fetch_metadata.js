// features/twitter-core/fetch_metadata.js

/**
 * Robust FX/VX fetcher. Always returns either a tweet JSON object
 * or a structured error object: { error:true, _fx_code:number, message:string, details?:string }
 *
 * @param {string} url        Original X/Twitter status URL (x.com or twitter.com)
 * @param {object} [message]  Optional Discord message (unused; kept for sig-compat)
 * @param {boolean} [isXDotCom]
 * @param {(s:string)=>void} [log] Logger callback
 * @returns {Promise<Object>} JSON or error object (never null/undefined)
 */
async function fetchMetadata(url, message, isXDotCom, log = () => {}) {
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/^\/+/, ''); // e.g. "Breaking911/status/123"
        const bases = [
            'https://api.fxtwitter.com',
            'https://api.vxtwitter.com'
        ];

        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'soulbot/1.0 (+https://github.com/your-org)'
        };

        let lastErr = null;

        for (const base of bases) {
            const endpoint = `${base}/${path}`;
            try {
                const res = await fetch(endpoint, { headers });
                const ct = res.headers.get('content-type') || '';
                log?.(`[HTTP] ${res.status} ${endpoint} ct=${ct} len=${res.headers.get('content-length') || 'n/a'}`);

                // Try to parse body (JSON preferred, but tolerate text)
                let body;
                try {
                    body = ct.includes('application/json') ? await res.json() : await res.text();
                } catch (e) {
                    body = { message: 'Invalid JSON from upstream.' };
                }

                if (!res.ok) {
                    // Normalize an error object and continue to next base (fallback)
                    lastErr = {
                        error: true,
                        _fx_code: res.status,
                        message: (body && (body.error || body.message || body.detail)) || `HTTP ${res.status}`,
                        details: typeof body === 'string' ? body : undefined,
                    };
                    continue;
                }

                // Success: ensure we *always* return a plain object
                if (body && typeof body === 'object') {
                    body._fx_code = res.status;
                    return body;
                }

                // Weird but handled: successful status with non-JSON body
                return {
                    error: true,
                    _fx_code: res.status,
                    message: 'Unexpected upstream response.',
                    details: typeof body === 'string' ? body : undefined,
                };
            } catch (e) {
                lastErr = {
                    error: true,
                    _fx_code: 0,
                    message: 'Network error to upstream.',
                    details: String(e && e.message || e),
                };
            }
        }

        // If all bases failed, return the last normalized error
        return lastErr || {
            error: true,
            _fx_code: 0,
            message: 'Unknown error contacting upstream.'
        };
    } catch (outer) {
        return {
            error: true,
            _fx_code: 0,
            message: 'Bad URL or internal error.',
            details: String(outer && outer.message || outer),
        };
    }
}

/**
 * Quote-tweet metadata fetch. Same behavior/shape as fetchMetadata.
 * @param {string} url
 * @param {(s:string)=>void} [log]
 * @returns {Promise<Object>}
 */
async function fetchQTMetadata(url, log = () => {}) {
    // Delegate to the same logic; no need to duplicate
    return fetchMetadata(url, undefined, undefined, log);
}

module.exports = {
    fetchMetadata,
    fetchQTMetadata,
};
