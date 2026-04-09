const path = require('node:path');
const { readFileSync, readdirSync } = require('node:fs');

const ASSETS_ROOT = path.join(__dirname, '..', 'assets');

function loadJsonFixture(filename) {
    const fixturePath = path.join(ASSETS_ROOT, 'json', filename);
    return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

function findFixtureByStem(dir, remoteUrl) {
    const basename = path.basename(String(remoteUrl || '').split('?')[0] || '');
    const stem = basename.replace(/\.[^.]+$/, '');
    const dirPath = path.join(ASSETS_ROOT, dir);
    const match = readdirSync(dirPath).find(name => name === basename || name.startsWith(`${stem}.`));

    if (!match) {
        throw new Error(`No local ${dir} fixture found for ${remoteUrl}`);
    }

    return path.join(dirPath, match);
}

function resolveImageFixturePath(remoteUrl) {
    return findFixtureByStem('images', remoteUrl);
}

function resolveVideoFixturePath(remoteUrl) {
    return findFixtureByStem('video', remoteUrl);
}

module.exports = {
    loadJsonFixture,
    resolveImageFixturePath,
    resolveVideoFixturePath,
};
