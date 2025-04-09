// Navigate to website using Chrome extension APIs
function navigateToWebsite(url) {
  return new Promise((resolve, reject) => {
    try {
      // Find the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          reject(new Error('No active tab found'));
          return;
        }

        const activeTab = tabs[0];

        // Navigate to the specified URL
        chrome.tabs.update(activeTab.id, { url: url }, (updatedTab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          // Wait for page to load
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === activeTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(updatedTab);
            }
          });
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Example usage
navigateToWebsite('http://americanvape.com')
  .then(tab => {
    console.log('Successfully navigated to website:', tab.url);
  })
  .catch(error => {
    console.error('Navigation failed:', error);
  });