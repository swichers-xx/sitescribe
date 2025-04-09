// Comprehensive Navigation and Page Monitoring Test Script

// Import page monitor if using ES modules
import { pageMonitor } from './modules/pageMonitor.js';

// Enhanced navigation function with monitoring
async function testNavigationAndMonitoring(url) {
  console.log(`🚀 Starting navigation test for: ${url}`);

  try {
    // Find an active tab or create a new one
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let targetTab = tabs[0];

    // If no active tab, create a new one
    if (!targetTab) {
      targetTab = await chrome.tabs.create({ url: 'about:blank' });
    }

    // Log initial tab details
    console.log(`📋 Initial Tab Details:`, {
      id: targetTab.id,
      url: targetTab.url,
      status: targetTab.status
    });

    // Start page monitoring before navigation
    await pageMonitor.startMonitoring(targetTab.id, url);

    // Navigate to the URL
    return new Promise((resolve, reject) => {
      // Update tab with new URL
      chrome.tabs.update(targetTab.id, { url: url }, (updatedTab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        // Wait for page to load completely
        const navigationListener = (tabId, changeInfo, tab) => {
          if (tabId === targetTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(navigationListener);
            
            // Attempt to render page and capture
            pageMonitor.renderPage(tabId)
              .then(significantChanges => {
                console.log(`🔍 Page Render Result:`, {
                  url: tab.url,
                  significantChanges: significantChanges
                });
                resolve({
                  tab: tab,
                  significantChanges: significantChanges
                });
              })
              .catch(renderError => {
                console.error(`❌ Page Render Error:`, renderError);
                reject(renderError);
              });
          }
        };

        chrome.tabs.onUpdated.addListener(navigationListener);
      });
    });
  } catch (error) {
    console.error(`🚨 Comprehensive Navigation Test Failed:`, error);
    throw error;
  }
}

// Test multiple websites
const testWebsites = [
  'http://americanvape.com',
  'https://example.com',
  'https://wikipedia.org'
];

// Run tests sequentially
async function runNavigationTests() {
  console.log('🧪 Starting Navigation and Monitoring Test Suite');
  
  for (const website of testWebsites) {
    try {
      console.log(`\n🌐 Testing: ${website}`);
      const result = await testNavigationAndMonitoring(website);
      console.log(`✅ Test Successful for ${website}:`, result);
    } catch (error) {
      console.error(`❌ Test Failed for ${website}:`, error);
    }
    
    // Wait between tests to prevent overwhelming the browser
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('🏁 Navigation Test Suite Completed');
}

// Run the tests
runNavigationTests();
