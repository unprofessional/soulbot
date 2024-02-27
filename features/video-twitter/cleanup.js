const {
    readdir,
    unlink,
} = require('node:fs');

const {
    lstat,
} = require('node:fs').promises;

const path = require('node:path');

// Function to delete a single file
function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        unlink(filePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Function to delete all files in a directory (non-recursive, skips subdirectories)
function deleteFilesInDirectory(dirPath) {
    return new Promise((resolve, reject) => {
        readdir(dirPath, (err, items) => {
            if (err) {
                reject(err);
                return;
            }

            const deletionPromises = items.map((item) => {
                const itemPath = path.join(dirPath, item);
                return lstat(itemPath).then(stats => {
                    if (stats.isFile()) {
                        return deleteFile(itemPath);
                    } else {
                        console.log(`Skipping directory: ${itemPath}`);
                        return Promise.resolve(); // Skip directories
                    }
                });
            });

            Promise.all(deletionPromises)
                .then(resolve)
                .catch(reject);
        });
    });
}

// Cleanup function to purge specified files and directories
async function cleanup(filesToDelete = [], directoriesToCleanup = []) {
    try {
    // Delete individual files
        for (const file of filesToDelete) {
            await deleteFile(file);
            console.log(`Deleted file: ${file}`);
        }

        // Delete all files within specified directories
        for (const dir of directoriesToCleanup) {
            await deleteFilesInDirectory(dir);
            console.log(`Deleted all files in directory: ${dir}`);
        }

        console.log('Cleanup completed successfully.');
    } catch (err) {
        console.error('Cleanup error:', err);
    }
}

// Usage example: Specify the files and directories you want to clean up

// const filesToDelete = ['path/to/downloaded/video.mp4', 'path/to/another/file.png'];
// const directoriesToCleanup = ['path/to/generated/frames', 'path/to/processed/images'];
// cleanup(filesToDelete, directoriesToCleanup);

module.exports = {
    cleanup,
};
