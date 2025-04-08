// Script Fetcher Module

/**
 * In-memory cache for fetched external script content.
 * Key: URL (string), Value: Script content (string).
 * Note: Cache is cleared periodically by background.js.
 * @type {Map<string, string>}
 */
const scriptCache = new Map();

/**
 * Fetches the content of an external script URL.
 * Uses an in-memory cache to avoid redundant fetches.
 * @param {string} url - The URL of the script to fetch.
 * @returns {Promise<string | null>} A promise resolving to the script content, or null if the fetch fails.
 */
export async function fetchScriptContent(url) {
  if (scriptCache.has(url)) {
    return scriptCache.get(url);
  }

  try {
    const response = await fetch(url);
    const content = await response.text();
    scriptCache.set(url, content);
    return content;
  } catch (error) {
    console.error(`Failed to fetch script: ${url}`, error);
    return null;
  }
}

/**
 * FOR TESTING PURPOSES ONLY.
 * Clears the internal script cache.
 * @private
 */
export function _resetCacheForTests() {
  scriptCache.clear();
}