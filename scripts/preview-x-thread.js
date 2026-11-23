// Deterministic, offline preview: node scripts/preview-x-thread.js [output directory]
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { registerFonts } = require('../features/twitter-post/canvas/fonts');
const { renderThreadSnapshotCanvas } = require('../features/twitter-core/thread_snapshot_canvas');
registerFonts();
const dir = path.resolve(process.argv[2] || 'tempdata/render-previews');
fs.mkdirSync(dir, { recursive: true });
function sample(width, height, color, label) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff20';
    for (let i = 0; i < width; i += 100) ctx.fillRect(i, 0, 50, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(label, 24, height / 2);
    return canvas.toDataURL();
}
const portrait = sample(600, 800, '#285967', 'Portrait image');
const landscape = sample(1000, 500, '#75513f', 'Landscape image');
const avatar = sample(80, 80, '#4b7390', '');
const base = { user_name: 'Morgan Ellis', user_screen_name: 'morgan', user_verified: true, user_profile_image_url: avatar, date_epoch: Date.parse('2026-11-23T18:00:00Z') / 1000, replies: 44, retweets: 26, likes: 704, views: 35000 };
const photo = url => ({ type: 'image', url });
async function main() {
    const scenarios = {
        text: [{ ...base, text: 'A thread about making things easier to read. Thanks to @example for the thoughtful discussion.\n\nParagraph spacing should stay intact, just like the desktop conversation view.' }, { ...base, user_name: 'Alex Rivera', user_screen_name: 'alex', text: 'This is the final post in the conversation.\n\nIts text spans the full width below the author header, with room for longer thoughts and a clear Eastern timestamp.', views: 8164 }],
        media: [{ ...base, text: 'A closer look at the image.', media_extended: [photo(landscape)], qtMetadata: { ...base, text: 'Here is the original image and some context for the discussion.', media_extended: [photo(portrait)] } }, { ...base, user_name: 'Alex Rivera', user_screen_name: 'alex', text: '', media_extended: [photo(landscape)] }],
        gallery: [{ ...base, text: 'Two photographs.', media_extended: [photo(portrait), photo(landscape)] }, { ...base, text: 'A four-image gallery.', media_extended: [photo(portrait), photo(landscape), photo(landscape), photo(portrait)] }],
    };
    for (const [name, posts] of Object.entries(scenarios)) {
        const file = path.join(dir, `x-thread-desktop-${name}.png`);
        fs.writeFileSync(file, await renderThreadSnapshotCanvas({ posts, now: Date.parse('2026-11-23T22:00:00Z') }));
        console.log(file);
    }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
