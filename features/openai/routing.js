// Explicit task opt-in; never fall back from ChatGPT plan usage to paid API keys.
function usesChatGpt(task) {
    return ['summary', 'chat'].includes(task)
        && (process.env.CHATGPT_TASKS || '').split(',').map(value => value.trim()).includes(task);
}

module.exports = { usesChatGpt };
