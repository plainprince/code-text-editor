/**
 * explorer-utils.js
 * Utility/helper functions for the file explorer.
 * Add shared logic here for use across explorer modules.
 */

// Example utility: join paths safely
export function joinPath(...parts) {
    return parts
        .filter(Boolean)
        .join('/')
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '');
}

// Example utility: get file/folder name from path
export function getNameFromPath(path) {
    if (!path) return '';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1];
}

// Add more utilities as needed...
