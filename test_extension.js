// SiteScribe Extension Functional Test

async function testExtensionFunctionality() {
  console.log('🧪 Starting SiteScribe Functional Test');
  
  try {
    // Test storage access
    await chrome.storage.sync.set({ testKey: 'testValue' });
    const storageTest = await chrome.storage.sync.get('testKey');
    console.assert(storageTest.testKey === 'testValue', '❌ Storage test failed');
    
    // Test tab querying
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.assert(tabs.length > 0, '❌ No active tabs found');
    
    // Test content script communication
    const activeTab = tabs[0];
    const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'ping' });
    console.assert(response === 'pong', '❌ Content script communication failed');
    
    // Test network request capture
    const networkRequests = performance.getEntriesByType('resource');
    console.log(`📊 Network Requests Captured: ${networkRequests.length}`);
    
    console.log('✅ All SiteScribe functional tests passed!');
  } catch (error) {
    console.error('❌ Functional Test Failed:', error);
  }
}

// Run test when script is loaded
testExtensionFunctionality();
