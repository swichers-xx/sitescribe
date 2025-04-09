// Enhanced Background Script with Comprehensive Diagnostics
import { logger } from './modules/extensionLogger.js';
import { pageMonitor } from './modules/pageMonitor.js';
import { 
  parseUrl, 
  createFolderStructure, 
  blobToDataUrl, 
  ensureContentScript 
} from './modules/utils.js';

// Diagnostic Capture Testing Function
async function runCaptureDiagnostics() {
  try {
    logger.info('🔍 Starting Capture Diagnostics');
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      logger.error('❌ No active tab found for diagnostics');
      return false;
    }
    
    logger.info(`🌐 Diagnostic Tab: ${tab.url}`);
    
    // Ensure content script is loaded
    try {
      await ensureContentScript(tab.id);
      logger.info('✅ Content Script Injection Successful');
    } catch (injectionError) {
      logger.error('❌ Content Script Injection Failed', injectionError);
      return false;
    }
    
    // Test various capture mechanisms
    const captureTests = [
      {
        name: 'Visible Screenshot',
        test: async () => {
          try {
            const dataUrl = await chrome.tabs.captureVisibleTab();
            logger.info('📸 Visible Screenshot Capture Successful');
            return dataUrl;
          } catch (error) {
            logger.error('❌ Visible Screenshot Capture Failed', error);
            throw error;
          }
        }
      },
      {
        name: 'Page Dimensions',
        test: async () => {
          try {
            const dimensions = await chrome.tabs.sendMessage(tab.id, { action: 'getPageDimensions' });
            logger.info('📏 Page Dimensions Retrieved:', dimensions);
            return dimensions;
          } catch (error) {
            logger.error('❌ Page Dimensions Retrieval Failed', error);
            throw error;
          }
        }
      },
      {
        name: 'HTML Capture',
        test: async () => {
          try {
            const html = await chrome.tabs.sendMessage(tab.id, { action: 'getHTML' });
            logger.info(`📄 HTML Capture Successful (Length: ${html.length} chars)`);
            return html;
          } catch (error) {
            logger.error('❌ HTML Capture Failed', error);
            throw error;
          }
        }
      }
    ];
    
    // Run all tests
    const testResults = {};
    for (const captureTest of captureTests) {
      try {
        testResults[captureTest.name] = await captureTest.test();
      } catch (testError) {
        testResults[captureTest.name] = { error: testError.message };
      }
    }
    
    // Log comprehensive test report
    logger.info('📋 Capture Diagnostics Report:', testResults);
    
    return testResults;
  } catch (globalError) {
    logger.error('🚨 Global Diagnostic Error', globalError);
    return false;
  }
}

// Add diagnostic command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'run_diagnostics') {
    await runCaptureDiagnostics();
  }
});

// Import the fetchScriptContent function from the scriptFetcher module
import { fetchScriptContent } from './modules/scriptFetcher.js';

// Add page monitoring state
import { pageMonitor } from './modules/pageMonitor.js';

import { recentCaptures, MAX_RECENT_CAPTURES, CAPTURE_FORMATS, screenshotRateLimit } from './modules/captureManager.js';

// Enhanced Logging for Capture Process
async function logCaptureDetails(captures) {
  logger.log('🔍 Capture Configuration:', {
    totalCaptures: captures.length,
    captureTypes: captures.map(c => c.type)
  });

  for (const capture of captures) {
    try {
      logger.log(`📸 Preparing Capture: ${capture.type}`, {
        filename: capture.filename,
        hasCaptureMethod: !!capture.capture,
        hasDirectData: !!capture.data
      });
    } catch (logError) {
      logger.error(`❌ Logging Error for ${capture.type}:`, logError);
    }
  }
}

// Main capture function
async function captureWebsite(tabId, url) {
  try {
    logger.info(`🌐 Initiating Website Capture`, { 
      tabId, 
      url, 
      timestamp: new Date().toISOString() 
    });

    logger.info(`🔍 Starting capture for tab ${tabId}, URL: ${url}`);
    
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
    logger.log('📋 Capture Settings:', JSON.stringify(settings, null, 2));

    // Check if tab is accessible
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        logger.log('Skipping restricted page:', tab.url);
        return;
      }
    } catch (error) {
      logger.error('Tab access error:', error);
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
        logger.warn(`Content script injection attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Add more detailed logging for content script injection
    if (!contentScriptLoaded) {
      logger.error('❌ CRITICAL: Failed to inject content script after multiple attempts');
      logger.error(`Details: tabId=${tabId}, url=${url}`);
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
    logger.log('📦 Page Data Received:', {
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
        logger.error('MHTML capture error:', error);
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
        logger.log(`${capture.type} saved successfully`);
        } catch (error) {
        logger.error(`${capture.type} capture failed:`, error);
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
    logger.error('🚨 Global Capture Error:', {
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
          logger.log(`Starting render check for tab ${tabId}...`);
          const significantChanges = await pageMonitor.renderPage(tabId);
          if (significantChanges) {
             // Re-fetch tab info as it might have changed
             const currentTab = await chrome.tabs.get(tabId);
             if (currentTab?.url && currentTab.url.startsWith('http')) {
                logger.log(`Significant changes detected after render in tab ${tabId}, capturing ${currentTab.url}...`);
                await captureWebsite(tabId, currentTab.url);
             } else {
                logger.warn(`Tab ${tabId} URL changed or inaccessible after render, skipping capture.`);
             }
          } else {
            logger.log(`No significant changes detected after render in tab ${tabId}.`);
          }
        } catch (error) {
          // Handle potential errors during renderPage or captureWebsite
          logger.error(`Error during post-load render/capture for tab ${tabId}:`, error);
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
  logger.log('🔍 Background Script Received Message:', {
    action: request.action,
    sender: sender.tab ? sender.tab.id : 'No Tab',
    timestamp: new Date().toISOString()
  });

  if (request.action === 'connectionTest') {
    logger.log('✅ Connection Test Received from Content Script');
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
      logger.log('Content script ready in tab:', tabId);
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
      logger.log('Content script ready in tab:', tabId);
      sendResponse({ status: 'received' });
      break
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
  logger.error('🛑 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for potential external use
export { 
  captureWebsite, 
  runCaptureDiagnostics 
};

const ContentScriptManager = {
  async ensureContentScript(tabId) {
    logger.log(`🔍 Attempting to ensure content script in tab ${tabId}`);
    
    const MAX_ATTEMPTS = 3;
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        logger.log(`📡 Content script injection attempt ${attempt} for tab ${tabId}`);
        
        try {
          const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
            
            setTimeout(() => reject(new Error('Message timeout')), 1000);
          });
          
          if (response === 'pong') {
            logger.log('✅ Content script already loaded in tab', tabId);
            return true;
          }
        } catch (checkError) {
          logger.log('🕵️ Content script not detected, will inject:', checkError.message);
        }
        
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        
        logger.log('⏳ Waiting for content script to initialize...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const verifyResponse = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
          setTimeout(() => reject(new Error('Verification timeout')), 1000);
        });
        
        if (verifyResponse === 'pong') {
          logger.log('🎉 Content script successfully injected and verified');
          return true;
        }
        
      } catch (error) {
        logger.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < MAX_ATTEMPTS) {
          logger.log(`⏰ Waiting before retry attempt ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    logger.error('🚫 Failed to inject content script after multiple attempts');
    return false;
  },

  async captureWebsite(tabId, url) {
    try {
      logger.info(`🌐 Starting capture for tab ${tabId}, URL: ${url}`);
      
      const tab = await chrome.tabs.get(tabId);
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        logger.log('🚫 Skipping restricted page:', tab.url);
        return;
      }
      
      const contentScriptReady = await this.ensureContentScript(tabId);
      if (!contentScriptReady) {
        logger.error('❌ Cannot proceed with capture: content script not loaded');
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Capture Failed',
          message: 'Could not initialize page capture. Please refresh the page and try again.'
        });
        
        return;
      }
      
      logger.log('✅ Content script ready, proceeding with capture');
      
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
      logger.log('📋 Capture Settings:', JSON.stringify(settings, null, 2));

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

      logger.log('📦 Page Data Received:', {
        contentLength: pageData.content ? pageData.content.length : 'No content',
        metadataKeys: pageData.metadata ? Object.keys(pageData.metadata) : 'No metadata'
      });

      const urlComponents = parseUrl(url);
      urlComponents.fullUrl = url;
      const { folderPath, metadata } = createFolderStructure(urlComponents, pageData.metadata);
      
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
          logger.error('MHTML capture error:', error);
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

      const enabledCaptures = captures.filter(capture => {
        if (capture.type === 'metadata' || capture.type === 'script_data') return true; 
        if (capture.type.startsWith('screenshot') && settings.captureFormats.screenshot) return true;
        return settings.captureFormats[capture.type];
      });

      await logCaptureDetails(enabledCaptures);

      for (const capture of enabledCaptures) {
        try {
          const data = capture.data || await capture.capture();
          const dataUrl = capture.type === 'screenshot' ? data : await blobToDataUrl(data);
          await chrome.downloads.download({
            url: dataUrl,
            filename: `${folderPath}/${capture.filename}`,
            saveAs: false
          });
          logger.log(`${capture.type} saved successfully`);
          } catch (error) {
          logger.error(`${capture.type} capture failed:`, error);
          }
        }

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

        await chrome.storage.local.set({ recentCaptures });
        chrome.runtime.sendMessage({ action: 'captureComplete', capture: captureRecord });

      } catch (globalCaptureError) {
      logger.error('🚨 Global Capture Error:', {
        message: globalCaptureError.message,
        stack: globalCaptureError.stack,
        url,
        tabId
      });
      // Consider adding more robust error handling or reporting mechanism
    }
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    chrome.storage.sync.get({ autoCaptureEnabled: true }, async (data) => {
      if (!data.autoCaptureEnabled) return;
      
      if (captureTimeouts.has(tabId)) {
        clearTimeout(captureTimeouts.get(tabId));
        captureTimeouts.delete(tabId);
      }

      await pageMonitor.startMonitoring(tabId, tab.url);
      
      const timeoutId = setTimeout(async () => {
        try {
          logger.log(`Starting render check for tab ${tabId}...`);
          const significantChanges = await pageMonitor.renderPage(tabId);
          if (significantChanges) {
             const currentTab = await chrome.tabs.get(tabId);
             if (currentTab?.url && currentTab.url.startsWith('http')) {
                logger.log(`Significant changes detected after render in tab ${tabId}, capturing ${currentTab.url}...`);
                await ContentScriptManager.captureWebsite(tabId, currentTab.url);
             } else {
                logger.warn(`Tab ${tabId} URL changed or inaccessible after render, skipping capture.`);
             }
          } else {
            logger.log(`No significant changes detected after render in tab ${tabId}.`);
          }
        } catch (error) {
          logger.error(`Error during post-load render/capture for tab ${tabId}:`, error);
          pageMonitor.activePages.delete(tabId);
        }
        captureTimeouts.delete(tabId);
      }, 2000); 

      captureTimeouts.set(tabId, timeoutId);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('🔍 Background Script Received Message:', {
    action: request.action,
    sender: sender.tab ? sender.tab.id : 'No Tab',
    timestamp: new Date().toISOString()
  });

  if (request.action === 'connectionTest') {
    logger.log('✅ Connection Test Received from Content Script');
    sendResponse({ 
      status: 'connected', 
      timestamp: Date.now(),
      extensionVersion: chrome.runtime.getManifest().version
    });
    return true;
  }

  if (!sender.tab) {
    if (request.action === 'captureNow') {
      ContentScriptManager.captureWebsite(request.tabId, request.url);
    }
    return true;
  }
  
  const tabId = sender.tab.id;
  const page = pageMonitor.activePages.get(tabId);
  
  if (!page) {
    if (request.action === 'contentReady') {
      logger.log('Content script ready in tab:', tabId);
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
      logger.log('Content script ready in tab:', tabId);
      sendResponse({ status: 'received' });
      break
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pageMonitor.activePages.delete(tabId);
  pageMonitor.scrollStates.delete(tabId);
  pageMonitor.mutationObservers.delete(tabId);
  captureTimeouts.delete(tabId);
});

setInterval(() => {
  scriptCache.clear();
}, 30 * 60 * 1000); 

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🛑 Unhandled Rejection at:', promise, 'reason:', reason);
});

export { 
  captureWebsite, 
  runCaptureDiagnostics 
};
