// Readability Initialization Module
// NOTE: This module is intended to run in the content script context.

/** @type {boolean} - Flag to track if the Readability library has been successfully loaded. */
let readabilityLoaded = false;

/**
 * Dynamically loads the Readability.js library into the current page if it hasn't been loaded yet.
 * The library script must be declared in manifest.json's web_accessible_resources.
 * @returns {Promise<void>} A promise that resolves when the script is loaded, or rejects if loading fails.
 * @throws {Error} Throws an error if the script fails to load.
 */
export async function initReadability() {
  if (readabilityLoaded) return;
  
  try {
    const readabilityScript = document.createElement('script');
    readabilityScript.src = chrome.runtime.getURL('lib/Readability.js');
    
    await new Promise((resolve, reject) => {
      readabilityScript.onload = resolve;
      readabilityScript.onerror = reject;
      document.head.appendChild(readabilityScript);
    });
    
    readabilityLoaded = true;
    console.log('Readability library loaded successfully');
  } catch (error) {
    console.error('Failed to load Readability:', error);
    throw error;
  }
}