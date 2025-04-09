// Comprehensive Navigation and Monitoring Test Suite
const pageMonitor = require('./modules/pageMonitor.js');
const logger = require('./modules/extensionLogger.js').logger;

class NavigationTestSuite {
  constructor() {
    this.testWebsites = [
      'https://example.com',
      'https://wikipedia.org',
      'https://developer.mozilla.org'
    ];
  }

  async runContentScriptTest(tabId) {
    logger.info('🧪 Testing Content Script Injection');
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response === 'pong') {
        logger.info('✅ Content Script Injection Successful');
        return true;
      } else {
        logger.error('❌ Content Script Response Invalid');
        return false;
      }
    } catch (error) {
      logger.error('❌ Content Script Injection Test Failed', error);
      return false;
    }
  }

  async testNavigation(url) {
    logger.info(`🌐 Testing Navigation to: ${url}`);
    
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url: 'about:blank' }, async (tab) => {
        try {
          // Start monitoring
          await pageMonitor.startMonitoring(tab.id, url);

          // Navigate to URL
          chrome.tabs.update(tab.id, { url: url }, (updatedTab) => {
            const navigationListener = async (tabId, changeInfo) => {
              if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(navigationListener);

                // Verify content script
                const contentScriptInjected = await this.runContentScriptTest(tabId);

                // Attempt page render
                const significantChanges = await pageMonitor.renderPage(tabId);

                resolve({
                  url,
                  contentScriptInjected,
                  significantChanges,
                  tabId
                });
              }
            };

            chrome.tabs.onUpdated.addListener(navigationListener);
          });
        } catch (error) {
          logger.error(`❌ Navigation Test Failed for ${url}`, error);
          reject(error);
        }
      });
    });
  }

  async runTestSuite() {
    logger.info('🚀 Starting Navigation Test Suite');
    const results = [];

    for (const website of this.testWebsites) {
      try {
        const result = await this.testNavigation(website);
        results.push(result);
        logger.info(`✅ Test Completed for ${website}`, result);
      } catch (error) {
        logger.error(`❌ Test Failed for ${website}`, error);
        results.push({ url: website, error: error.message });
      }

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('🏁 Navigation Test Suite Completed', results);
    return results;
  }
}

// Run the test suite
const testSuite = new NavigationTestSuite();
testSuite.runTestSuite()
  .then(results => {
    console.log('Test Suite Results:', results);
  })
  .catch(error => {
    console.error('Test Suite Execution Error:', error);
  });
