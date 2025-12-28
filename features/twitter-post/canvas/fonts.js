// features/twitter-post/canvas/fonts.js
const fs = require('fs');
const path = require('path');
const { registerFont } = require('canvas');

/**
 * Case-by-case exclusions for troubleshooting.
 * Prefer excluding by filename (more deterministic).
 */
const EXCLUDE_FILENAMES = new Set([
    // Example:
    // 'NotoSansCJK-VF.ttf.ttc',
]);

const EXCLUDE_FAMILIES = new Set([
    // Example:
    // 'Noto Sans CJK',
]);

const SUPPORTED_EXTS = new Set(['.ttf', '.otf', '.ttc']);

/**
 * Convert common Noto filenames into a family name.
 * Examples:
 * - NotoSansEgyptianHieroglyphs-Regular.ttf -> "Noto Sans Egyptian Hieroglyphs"
 * - NotoColorEmoji.ttf -> "Noto Color Emoji"
 * - NotoSansCJK-VF.ttf.ttc -> "Noto Sans CJK"
 */
function familyFromFilename(filename) {
    const base = filename
        .replace(/\.(ttf|otf|ttc)$/i, '')
        .replace(/-Regular$/i, '')
        .replace(/-VF$/i, '');

    // Insert spaces between camel-case chunks
    // e.g. NotoSansEgyptianHieroglyphs -> Noto Sans Egyptian Hieroglyphs
    const spaced = base.replace(/([a-z])([A-Z])/g, '$1 $2');

    return spaced.trim();
}

function walkFiles(dirAbsPath) {
    const results = [];

    if (!fs.existsSync(dirAbsPath)) return results;

    const entries = fs.readdirSync(dirAbsPath, { withFileTypes: true });
    for (const entry of entries) {
        const abs = path.join(dirAbsPath, entry.name);

        if (entry.isDirectory()) {
            results.push(...walkFiles(abs));
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!SUPPORTED_EXTS.has(ext)) continue;

        results.push(abs);
    }

    return results;
}

/**
 * Register all Noto fonts found on disk.
 *
 * By default expects fonts in:
 *   /usr/share/fonts/truetype/noto/
 *   /usr/share/fonts/opentype/noto/
 *
 * @param {string} baseFontUrl absolute root, e.g. '/usr/share/fonts'
 * @returns {{ registered: Array<{ file: string, family: string }>, skipped: Array<{ file: string, reason: string }> }}
 */
function registerFonts(baseFontUrl = '/usr/share/fonts') {
    const notoDirs = [
        path.join(baseFontUrl, 'truetype', 'noto'),
        path.join(baseFontUrl, 'opentype', 'noto'),
    ];

    const files = notoDirs.flatMap(walkFiles);

    const registered = [];
    const skipped = [];

    for (const fileAbsPath of files) {
        const filename = path.basename(fileAbsPath);

        if (EXCLUDE_FILENAMES.has(filename)) {
            skipped.push({ file: fileAbsPath, reason: `excluded by filename (${filename})` });
            continue;
        }

        const family = familyFromFilename(filename);

        if (EXCLUDE_FAMILIES.has(family)) {
            skipped.push({ file: fileAbsPath, reason: `excluded by family (${family})` });
            continue;
        }

        try {
            registerFont(fileAbsPath, { family });
            registered.push({ file: fileAbsPath, family });
        } catch (err) {
            skipped.push({
                file: fileAbsPath,
                reason: `registerFont failed: ${err?.message ?? String(err)}`,
            });
        }
    }

    // Optional: if you want quick visibility in logs (leave disabled by default)
    // console.log('[fonts] registered:', registered);
    // console.log('[fonts] skipped:', skipped);

    return { registered, skipped };
}

module.exports = {
    registerFonts,
    // exporting these makes troubleshooting easier without editing the module
    EXCLUDE_FILENAMES,
    EXCLUDE_FAMILIES,
};
