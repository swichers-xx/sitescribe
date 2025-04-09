// Navigate to website using Chrome extension APIs
const logger = require('./modules/extensionLogger.js').logger;

/**
 * Navigate to a specified website with advanced error handling and monitoring
 * @param {string} url - The URL to navigate to
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {boolean} [options.forceNewTab=false] - Open in a new tab instead of current tab
 * @returns {Promise<chrome.tabs.Tab>} Promise resolving to the updated tab
 */
function navigateToWebsite(url, options = {}) {
  const { 
    timeout = 30000,  // Default 30-second timeout
    forceNewTab = false 
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Validate URL
      new URL(url);

      // Set up timeout
      const navigationTimeout = setTimeout(() => {
        logger.warn('Navigation timeout exceeded', { url, timeout });
        reject(new Error(`Navigation to ${url} timed out after ${timeout}ms`));
      }, timeout);

      const navigateAction = (tab) => {
        // Ensure we have a valid tab
        if (!tab || !tab.id) {
          clearTimeout(navigationTimeout);
          logger.error('No valid tab found for navigation', { url });
          reject(new Error('Unable to find a valid tab for navigation'));
          return;
        }

        logger.info('Attempting to navigate', { url, tabId: tab.id });

        chrome.tabs.update(tab.id, { url: url }, (updatedTab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(navigationTimeout);
            logger.error('Chrome runtime error during navigation', { 
              url, 
              error: chrome.runtime.lastError 
            });
            reject(chrome.runtime.lastError);
            return;
          }

          // Listen for navigation complete
          const navigationListener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              clearTimeout(navigationTimeout);
              chrome.tabs.onUpdated.removeListener(navigationListener);
              
              logger.info('Navigation successful', { 
                url, 
                finalUrl: changeInfo.url || url 
              });
              
              resolve(updatedTab);
            }
          };

          chrome.tabs.onUpdated.addListener(navigationListener);
        });
      };

      // Determine navigation method
      if (forceNewTab) {
        chrome.tabs.create({ url: 'about:blank' }, navigateAction);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length === 0) {
            clearTimeout(navigationTimeout);
            logger.error('No active tab found for navigation');
            reject(new Error('No active tab found'));
            return;
          }
          navigateAction(tabs[0]);
        });
      }
    } catch (error) {
      logger.error('Unexpected error in navigation', { 
        url, 
        error: error.message 
      });
      reject(error);
    }
  });
}

// Export for use in other modules
module.exports = { 
  navigateToWebsite,
  // Expose utility functions for testing and advanced usage
  _internals: {
    validateUrl: (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
  }
};

// Example usage with error handling
if (require.main === module) {
  navigateToWebsite('https://example.com', { timeout: 15000 })
    .then(tab => {
      console.log('Successfully navigated to website:', tab.url);
    })
    .catch(error => {
      console.error('Navigation failed:', error);
    });
}