const FeatureDAO = require('./dao/feature.dao.js');

const featureDAO = new FeatureDAO();

async function getFeature(type) {
    await featureDAO.ensure(type, true);
    return await featureDAO.findByType(type);
}

async function getFeatures() {
    await featureDAO.ensure('twitter', true);
    return await featureDAO.findAll();
}

async function toggleTwitter() {
    const twitterFeature = await featureDAO.toggle('twitter');

    if (!twitterFeature) {
        return {
            ok: false,
            message: 'Twitter feature not found!',
        };
    }

    return {
        ok: true,
        on: twitterFeature.on,
        message: `Twitter functionality toggled to \`${twitterFeature.on}\``,
    };
}

module.exports = {
    getFeature,
    getFeatures,
    toggleTwitter,
};
