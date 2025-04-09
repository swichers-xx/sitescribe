// Import the fetchScriptContent function from the scriptFetcher module
import { fetchScriptContent } from './modules/scriptFetcher.js';

// Add page monitoring state
import { pageMonitor } from './modules/pageMonitor.js';

import { recentCaptures, MAX_RECENT_CAPTURES, CAPTURE_FORMATS, screenshotRateLimit } from './modules/captureManager.js';

import { parseUrl, createFolderStructure, blobToDataUrl, ensureContentScript } from './modules/utils.js';

// Enhanced Logging for Capture Process
async function logCaptureDetails(captures) {
  console.log('🔍 Capture Configuration:', {
    totalCaptures: captures.length,
    captureTypes: captures.map(c => c.type)
  });

  for (const capture of captures) {
    try {
      console.log(`📸 Preparing Capture: ${capture.type}`, {
        filename: capture.filename,
        hasCaptureMethod: !!capture.capture,
        hasDirectData: !!capture.data
      });
    } catch (logError) {
      console.error(`❌ Logging Error for ${capture.type}:`, logError);
    }
  }
}

// Main capture function
async function captureWebsite(tabId, url) {
  try {
    console.log(`🌐 Initiating Website Capture`, { 
      tabId, 
      url, 
      timestamp: new Date().toISOString() 
    });

    console.log(`🔍 Starting capture for tab ${tabId}, URL: ${url}`);
    
    // Get settings with enhanced logging
    const settings = await chrome.storage.sync.get({
      captureFormats: {
      pdf: true,
      html: true,
      markdown: true,
      screenshot: true
      },
      captureScripts: true,
      captureNetworkRequests: true,
      maxNetworkRequests: 100
    });
    console.log('📋 Capture Settings:', JSON.stringify(settings, null, 2));

    // Check if tab is accessible
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('Skipping restricted page:', tab.url);
        return;
      }
    } catch (error) {
      console.error('Tab access error:', error);
      return;
    }

    // Ensure content script is loaded with retry
    let contentScriptLoaded = false;
    for (let i = 0; i < 3; i++) {
      try {
        await ensureContentScript(tabId);
        contentScriptLoaded = true;
        break;
      } catch (error) {
        console.warn(`Content script injection attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Add more detailed logging for content script injection
    if (!contentScriptLoaded) {
      console.error('❌ CRITICAL: Failed to inject content script after multiple attempts');
      console.error(`Details: tabId=${tabId}, url=${url}`);
    }

    // Get content and metadata with retry
    const pageData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Content script timeout')), 5000);
      chrome.tabs.sendMessage(tabId, { 
      action: 'getContent',
      captureScripts: settings.captureScripts,
      captureNetworkRequests: settings.captureNetworkRequests,
      maxNetworkRequests: settings.maxNetworkRequests
      }, async response => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Fetch external script contents if enabled
        if (settings.captureScripts && response?.metadata?.scripts) {
          const scripts = response.metadata.scripts;
          for (const script of scripts) {
            if (script.type === 'external' && script.src) {
              const fetchedContent = await fetchScriptContent(script.src);
              // Only assign content if fetch was successful (not null)
              script.content = fetchedContent !== null ? fetchedContent : '/* Fetch failed */'; 
            }
          }
        }
        resolve(response || { content: 'No content available', metadata: {} });
      }
      });
    });

    // Enhanced logging for page data
    console.log('📦 Page Data Received:', {
      contentLength: pageData.content ? pageData.content.length : 'No content',
      metadataKeys: pageData.metadata ? Object.keys(pageData.metadata) : 'No metadata'
    });

    // Create folder structure
    const urlComponents = parseUrl(url);
    urlComponents.fullUrl = url;
    const { folderPath, metadata } = createFolderStructure(urlComponents, pageData.metadata);
    
    // Define captures with proper error handling
    const fileTimestamp = metadata.captureTime;
    const captures = [
      {
      type: 'metadata',
      data: new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }),
      filename: 'metadata.json'
      },
      {
      type: 'screenshot_visible',
      capture: async () => screenshotRateLimit.capture(),
      filename: `screenshot_visible_${fileTimestamp}.png`
      },
      {
      type: 'screenshot_full',
      capture: async () => {
        const { width, height } = await chrome.tabs.sendMessage(tabId, { action: 'getPageDimensions' });
        await chrome.tabs.setZoom(tabId, 1);
        const dataUrl = await screenshotRateLimit.capture();
        return dataUrl;
      },
      filename: `screenshot_full_${fileTimestamp}.png`
      },
      {
      type: 'mhtml',
      capture: async () => {
        try {
        const mhtmlData = await chrome.pageCapture.saveAsMHTML({ tabId });
        return new Blob([mhtmlData], { type: CAPTURE_FORMATS.MHTML.mimeType });
        } catch (error) {
        console.error('MHTML capture error:', error);
        throw new Error('MHTML capture failed');
        }
      },
      filename: `page_${fileTimestamp}.mhtml`
      },
      {
      type: 'html',
      capture: async () => {
        const html = await chrome.tabs.sendMessage(tabId, { action: 'getHTML' });
        return new Blob([html], { type: CAPTURE_FORMATS.HTML.mimeType });
      },
      filename: `page_${fileTimestamp}.html`
      },
      {
      type: 'text',
      capture: async () => {
        const text = await chrome.tabs.sendMessage(tabId, { action: 'getText' });
        return new Blob([text], { type: CAPTURE_FORMATS.TEXT.mimeType });
      },
      filename: `content_${fileTimestamp}.txt`
      },
      {
      type: 'markdown',
      data: new Blob([pageData.content], { type: CAPTURE_FORMATS.MARKDOWN.mimeType }),
      filename: `content_${fileTimestamp}.md`
      },
      {
      type: 'readability',
      capture: async () => {
        const readableContent = await chrome.tabs.sendMessage(tabId, { action: 'getReadableContent' });
        return new Blob([readableContent], { type: CAPTURE_FORMATS.TEXT.mimeType });
      },
      filename: `readable_${fileTimestamp}.txt`
      }
    ];

    // Add script and network data to metadata
    if (settings.captureScripts || settings.captureNetworkRequests) {
      const scriptData = new Blob([JSON.stringify({
      scripts: settings.captureScripts ? pageData.metadata.scripts : [],
      networkRequests: settings.captureNetworkRequests ? 
        pageData.metadata.networkRequests?.slice(-settings.maxNetworkRequests) : [],
      apiEndpoints: settings.captureNetworkRequests ? pageData.metadata.apiEndpoints : []
      }, null, 2)], { type: 'application/json' });

      captures.push({
      type: 'script_data',
      data: scriptData,
      filename: `script_data_${fileTimestamp}.json`
      });
    }

    // Filter captures based on user settings
    const enabledCaptures = captures.filter(capture => {
      if (capture.type === 'metadata' || capture.type === 'script_data') return true; // Always capture metadata and script/network data
      if (capture.type.startsWith('screenshot') && settings.captureFormats.screenshot) return true;
      return settings.captureFormats[capture.type];
    });

    // Add logging before processing captures
    await logCaptureDetails(enabledCaptures);

    // Process captures with individual error handling
    for (const capture of enabledCaptures) {
      try {
        const data = capture.data || await capture.capture();
        const dataUrl = capture.type === 'screenshot' ? data : await blobToDataUrl(data);
        await chrome.downloads.download({
          url: dataUrl,
          filename: `${folderPath}/${capture.filename}`,
          saveAs: false
        });
        console.log(`${capture.type} saved successfully`);
        } catch (error) {
        console.error(`${capture.type} capture failed:`, error);
        }
      }

      // Add to recent captures
      const captureRecord = {
        title: tab.title,
        url: tab.url,
        timestamp: new Date().toISOString(),
        formats: enabledCaptures.map(c => c.type)
      };

      recentCaptures.unshift(captureRecord);
      if (recentCaptures.length > MAX_RECENT_CAPTURES) {
        recentCaptures.pop();
      }

      // Save to storage and notify popup
      await chrome.storage.local.set({ recentCaptures });
      chrome.runtime.sendMessage({ action: 'captureComplete', capture: captureRecord });

      } catch (globalCaptureError) {
    console.error('🚨 Global Capture Error:', {
      message: globalCaptureError.message,
      stack: globalCaptureError.stack,
      url,
      tabId
    });
    // Consider adding more robust error handling or reporting mechanism
  }
}

// Debounced tab update handler
let captureTimeouts = new Map();
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    chrome.storage.sync.get({ autoCaptureEnabled: true }, async (data) => {
      if (!data.autoCaptureEnabled) return;
      
      // Clear existing timeout
      if (captureTimeouts.has(tabId)) {
        clearTimeout(captureTimeouts.get(tabId));
        captureTimeouts.delete(tabId);
      }

      // Start monitoring the page
      await pageMonitor.startMonitoring(tabId, tab.url);
      
      // Initial capture after page load, potentially after rendering dynamic content
      const timeoutId = setTimeout(async () => {
        try {
          console.log(`Starting render check for tab ${tabId}...`);
          const significantChanges = await pageMonitor.renderPage(tabId);
          if (significantChanges) {
             // Re-fetch tab info as it might have changed
             const currentTab = await chrome.tabs.get(tabId);
             if (currentTab?.url && currentTab.url.startsWith('http')) {
                console.log(`Significant changes detected after render in tab ${tabId}, capturing ${currentTab.url}...`);
                await captureWebsite(tabId, currentTab.url);
             } else {
                console.warn(`Tab ${tabId} URL changed or inaccessible after render, skipping capture.`);
             }
          } else {
            console.log(`No significant changes detected after render in tab ${tabId}.`);
          }
        } catch (error) {
          // Handle potential errors during renderPage or captureWebsite
          console.error(`Error during post-load render/capture for tab ${tabId}:`, error);
          // Clean up potentially stuck monitoring state if render failed badly?
          // pageMonitor.activePages.delete(tabId);
        }
        // Clear the timeout reference once executed
        captureTimeouts.delete(tabId);
      }, 2000); // Consider if 2000ms is the right delay

      captureTimeouts.set(tabId, timeoutId);
    });
  }
});

// Enhanced Connection Handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔍 Background Script Received Message:', {
    action: request.action,
    sender: sender.tab ? sender.tab.id : 'No Tab',
    timestamp: new Date().toISOString()
  });

  if (request.action === 'connectionTest') {
    console.log('✅ Connection Test Received from Content Script');
    sendResponse({ 
      status: 'connected', 
      timestamp: Date.now(),
      extensionVersion: chrome.runtime.getManifest().version
    });
    return true;
  }

  if (!sender.tab) {
    if (request.action === 'captureNow') {
      captureWebsite(request.tabId, request.url);
    }
    return true;
  }
  
  const tabId = sender.tab.id;
  const page = pageMonitor.activePages.get(tabId);
  
  if (!page) {
    if (request.action === 'contentReady') {
      console.log('Content script ready in tab:', tabId);
      sendResponse({ status: 'received' });
    }
    return true;
  }

  switch (request.action) {
    case 'pageHeightChanged':
      page.significantChanges = true;
      break;
    case 'scrollPositionChanged':
      pageMonitor.scrollStates.set(tabId, request.position);
      break;
    case 'contentReady':
      console.log('Content script ready in tab:', tabId);
      sendResponse({ status: 'received' });
      break;
  }
  return true;
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  pageMonitor.activePages.delete(tabId);
  pageMonitor.scrollStates.delete(tabId);
  pageMonitor.mutationObservers.delete(tabId);
  captureTimeouts.delete(tabId);
});

// Clear script cache periodically
setInterval(() => {
  scriptCache.clear();
}, 30 * 60 * 1000); // Clear every 30 minutes

// Add global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🛑 Unhandled Rejection at:', promise, 'reason:', reason);
});
