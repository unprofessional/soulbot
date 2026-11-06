const { getAccessToken } = require('./auth');

async function authorizedFetch(path, options = {}) {
    const token = await getAccessToken();
    const response = await fetch(`https://api.openai.com/v1/${path}`, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`ChatGPT request failed (HTTP ${response.status}). Check your authorization and https://chatgpt.com/settings/usage. No API-key fallback was used.`);
    }
    return response;
}

async function listModels() {
    const response = await authorizedFetch('models');
    const data = await response.json();
    if (!Array.isArray(data.models)) throw new Error('Unexpected ChatGPT model catalog.');
    return data.models.filter(model => model.visibility === 'list');
}

async function readResponseStream(body) {
    if (!body) throw new Error('Missing ChatGPT response stream.');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let dataLines = [];
    let output = '';
    let completed = false;
    let bytesRead = 0;
    function dispatch() {
        if (!dataLines.length) return;
        const data = dataLines.join('\n');
        dataLines = [];
        if (data === '[DONE]') return;
        const event = JSON.parse(data);
        if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
            throw new Error('ChatGPT inference failed or was incomplete. Check https://chatgpt.com/settings/usage; no fallback was used.');
        }
        if (event.type === 'response.output_text.delta') output += event.delta || '';
        if (event.type === 'response.refusal.delta') output += event.delta || '';
        if (event.type === 'response.completed') {
            completed = true;
            const finalText = (event.response?.output || [])
                .flatMap(item => item.content || [])
                .map(part => part.type === 'output_text' ? part.text : (part.type === 'refusal' ? part.refusal : ''))
                .join('');
            if (finalText) output = finalText;
        }
    }
    function consumeLines(final = false) {
        let newline;
        while ((newline = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, newline).replace(/\r$/, '');
            pending = pending.slice(newline + 1);
            if (!line) dispatch();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        if (final) {
            if (pending.startsWith('data:')) dataLines.push(pending.slice(5).replace(/^ /, '').replace(/\r$/, ''));
            dispatch();
        }
    }
    try {
        while (!completed) {
            const { done, value } = await reader.read();
            if (done) {
                pending += decoder.decode();
                consumeLines(true);
                break;
            }
            bytesRead += value.byteLength;
            if (bytesRead > 4 * 1024 * 1024) throw new Error('ChatGPT response exceeded the size limit.');
            pending += decoder.decode(value, { stream: true });
            consumeLines();
        }
        if (!completed) throw new Error('ChatGPT stream ended before response.completed.');
        if (!output.trim()) throw new Error('ChatGPT returned no text.');
        return output;
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

function getModel(task) {
    return process.env[`CHATGPT_${task.toUpperCase()}_MODEL`] || process.env.CHATGPT_MODEL;
}

async function generateText(prompt, task) {
    const model = getModel(task);
    if (!model) throw new Error('Set CHATGPT_MODEL using a slug from npm run chatgpt:auth -- models.');
    const response = await authorizedFetch('responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: [{ role: 'user', content: prompt }], store: false, stream: true }),
    });
    return readResponseStream(response.body);
}

module.exports = { generateText, getModel, listModels, readResponseStream };
