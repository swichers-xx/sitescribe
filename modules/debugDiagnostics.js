// Comprehensive Diagnostic Module for SiteScribe

export async function runDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      browser: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    },
    extensionPermissions: {
      tabs: await checkPermission('tabs'),
      activeTab: await checkPermission('activeTab'),
      webRequest: await checkPermission('webRequest'),
      storage: await checkPermission('storage')
    },
    contentScriptStatus: await testContentScriptInjection(),
    networkRequestCapture: await testNetworkRequestCapture(),
    storageAccessibility: await testStorageAccess()
  };

  return diagnostics;
}

async function checkPermission(permission) {
  try {
    const result = await chrome.permissions.contains({ permissions: [permission] });
    return result;
  } catch (error) {
    return { error: error.message };
  }
}

async function testContentScriptInjection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return { error: 'No active tab found' };

    const result = await chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' });
    return result === 'pong' ? 'Successful' : 'Failed';
  } catch (error) {
    return { error: error.message };
  }
}

async function testNetworkRequestCapture() {
  try {
    const settings = await chrome.storage.sync.get('captureNetworkRequests');
    return {
      settingEnabled: settings.captureNetworkRequests ?? false,
      networkRequests: window.performance.getEntriesByType('resource').length
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function testStorageAccess() {
  try {
    await chrome.storage.sync.set({ testKey: 'testValue' });
    const result = await chrome.storage.sync.get('testKey');
    await chrome.storage.sync.remove('testKey');
    return result.testKey === 'testValue' ? 'Successful' : 'Failed';
  } catch (error) {
    return { error: error.message };
  }
}

// Add a ping response in content script
if (chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse('pong');
    }
  });
}
