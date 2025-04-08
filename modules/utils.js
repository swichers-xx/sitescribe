// Utility Functions Module

// Helper function to parse URL into components
/**
 * Parses a URL into its components.
 * @param {string} url - The URL to parse.
 * @returns {Object} An object containing protocol, domain, path, query, timestamp, and the original full URL.
 */
export function parseUrl(url) {
  const urlObj = new URL(url);
  const domainParts = urlObj.hostname.split('.');
  return {
    fullUrl: url,
    protocol: urlObj.protocol.replace(':', ''),
    domain: {
      full: urlObj.hostname,
      main: domainParts.slice(-2).join('.'),
      sub: domainParts.length > 2 ? domainParts.slice(0, -2).join('.') : ''
    },
    path: urlObj.pathname.split('/').filter(Boolean),
    query: urlObj.search,
    timestamp: new Date().toISOString()
  };
}

// Helper function to create folder structure
/**
 * Creates a folder structure based on URL components and page metadata.
 * @param {Object} urlComponents - The parsed URL components.
 * @param {Object} pageMetadata - Metadata about the page.
 * @returns {Object} An object with folder path and metadata.
 */
export function createFolderStructure(urlComponents, pageMetadata) {
  const timestamp = urlComponents.timestamp.replace(/[:.]/g, '-');
  const { domain, path } = urlComponents;
  
  // Create folder hierarchy
  const parts = [
    'webData',
    domain.main,
    domain.sub,
    ...path
  ].filter(Boolean);

  return {
    folderPath: parts.join('/'),
    metadata: {
      captureTime: timestamp,
      url: {
        full: urlComponents.fullUrl,
        domain: domain.full,
        mainDomain: domain.main,
        subdomain: domain.sub,
        path: path.join('/'),
        query: urlComponents.query
      },
      page: pageMetadata
    }
  };
}

// Helper function to convert blob to data URL
/**
 * Converts a Blob object to a data URL.
 * @param {Blob} blob - The Blob to convert.
 * @returns {Promise<string>} A Promise that resolves to a data URL string.
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to ensure content script is loaded
/**
 * Ensures that the content script is loaded in the specified tab.
 * @param {number} tabId - The ID of the tab to inject the script into.
 * @returns {void}
 */
export async function ensureContentScript(tabId) {
  try {
    // Check if the content script is already injected
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.contentScriptInjected,
    });

    if (result.result) {
      console.log('Content script already injected');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    console.log('Content script injected successfully');
  } catch (error) {
    console.error('Failed to inject content script:', error);
  }
}