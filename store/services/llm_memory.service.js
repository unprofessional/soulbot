const LlmMemoryDAO = require('../dao/llm_memory.dao.js');

const llmMemoryDAO = new LlmMemoryDAO();

const getLlmMemorySummary = async ({ memberId, channelId }) => {
    const memory = await llmMemoryDAO.findByMemberAndChannel(memberId, channelId);
    return memory?.summary || null;
};

const saveLlmMemorySummary = async ({ memberId, channelId, summary }) => {
    return llmMemoryDAO.upsert(memberId, channelId, summary);
};

module.exports = {
    getLlmMemorySummary,
    saveLlmMemorySummary,
};
