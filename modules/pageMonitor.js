// Page Monitoring Module
import { logger } from './extensionLogger.js';

/**
 * Manages the monitoring of web pages for changes and triggers captures.
 * Handles DOM mutations, scroll positions, and attempts to render full pages.
 */
export const pageMonitor = {
  /** @type {Map<number, {url: string, lastCapture: number, contentHash: string, isRendering: boolean, significantChanges: boolean}>} - Maps tabId to its monitoring state. */
  activePages: new Map(), // tabId -> monitoring state
  /** @type {Map<number, number>} - Maps tabId to its last known scroll position. */
  scrollStates: new Map(), // tabId -> scroll position
  /** @type {Map<number, number>} - Maps tabId to the timestamp of the last detected DOM mutation. */
  mutationObservers: new Map(), // tabId -> last mutation time
  /** @type {number} - Time in milliseconds to wait after the last mutation before considering the page stable for capture. */
  renderTimeout: 5000, // Wait 5s after last mutation
  /** @type {number} - Interval in milliseconds between scroll steps during page rendering. */
  scrollInterval: 500, // Scroll every 500ms
  /** @type {number} - Minimum number of pixels to scroll in each step during page rendering. */
  minScrollStep: 200, // Minimum pixels to scroll
  
  /**
   * Starts monitoring a specific tab for changes.
   * Injects a content script to observe DOM mutations and scroll events.
   * @param {number} tabId - The ID of the tab to monitor.
   * @param {string} url - The URL of the page in the tab.
   */
  async startMonitoring(tabId, url) {
    if (this.activePages.has(tabId)) {
      logger.info(`Already monitoring tab ${tabId}`);
      return;
    }
    
    logger.debug(`Starting monitoring for tab ${tabId}, URL: ${url}`, { tabId, url });
    
    this.activePages.set(tabId, {
      url,
      lastCapture: Date.now(),
      contentHash: '',
      isRendering: false,
      significantChanges: false
    });

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        function: this.setupPageMonitoring,
      });
      logger.info(`Monitoring script injected successfully for tab ${tabId}`);
    } catch (error) {
      logger.error(`Failed to inject monitoring script for tab ${tabId}`, error);
    }
  },

  /**
   * Sets up monitoring within the content script context.
   * Observes DOM changes and scroll events, sending messages back to the background script.
   * @private - This function is intended to be executed via chrome.scripting.executeScript.
   */
  setupPageMonitoring() {
    // This runs in the context of the page
    let lastMutationTime = Date.now();
    let scrollPosition = 0;
    let pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );

    // Monitor DOM mutations
    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
      const newHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      
      if (newHeight !== pageHeight) {
        pageHeight = newHeight;
        chrome.runtime.sendMessage({
          action: 'pageHeightChanged',
          height: pageHeight
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Monitor scroll position
    window.addEventListener('scroll', () => {
      scrollPosition = window.scrollY;
      chrome.runtime.sendMessage({
        action: 'scrollPositionChanged',
        position: scrollPosition
      });
    });
  },

  /**
   * Attempts to render the full page content by scrolling through it.
   * Designed to trigger lazy-loaded elements.
   * Potentially triggers a capture via captureWebsite (needs refactoring).
   * @param {number} tabId - The ID of the tab to render.
   * @returns {Promise<boolean>} A promise that resolves to true if significant changes were detected, false otherwise.
   */
  async renderPage(tabId) {
    const page = this.activePages.get(tabId);
    if (!page || page.isRendering) {
      logger.debug(`Tab ${tabId} already rendering or not monitored`);
      return false;
    }

    page.isRendering = true;
    let lastScrollPosition = 0;
    let significantChangesDetected = false;

    try {
      // Verify tab exists and is accessible
      const tab = await chrome.tabs.get(tabId);
      if (!tab || tab.status !== 'complete') {
        logger.warn(`Tab ${tabId} not ready for rendering`);
        return false;
      }

      logger.info(`Starting page render for tab ${tabId}`, { url: tab.url });

      // Verify content script is injected
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      } catch (injectionError) {
        logger.error(`Content script injection failed for tab ${tabId}:`, injectionError);
        
        // Attempt to re-inject content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
        } catch (reinjectError) {
          logger.error(`Failed to re-inject content script:`, reinjectError);
          return false;
        }
      }

      // Get page dimensions with timeout and error handling
      let pageHeight;
      try {
        const dimensionsResponse = await Promise.race([
          chrome.tabs.sendMessage(tabId, { action: 'getPageDimensions' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Dimensions request timed out')), 5000))
        ]);
        pageHeight = dimensionsResponse.height;
      } catch (dimensionsError) {
        logger.error(`Failed to get page dimensions for tab ${tabId}:`, dimensionsError);
        pageHeight = 5000; // Fallback to a default scroll height
      }

      logger.info(`Page height for tab ${tabId}: ${pageHeight}`);

      // Scroll through the page with enhanced error handling
      while (lastScrollPosition < pageHeight) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'scrollTo',
            position: lastScrollPosition
          });
        } catch (scrollError) {
          logger.warn(`Scroll failed at position ${lastScrollPosition}:`, scrollError);
          // Continue scrolling even if one scroll fails
        }

        await new Promise(resolve => setTimeout(resolve, this.scrollInterval));
        lastScrollPosition += this.minScrollStep;
      }

      // Wait for final renders with logging
      logger.info(`Waiting for final renders on tab ${tabId}`);
      await new Promise(resolve => setTimeout(resolve, this.renderTimeout));

      // Check if significant changes were detected
      if (page.significantChanges) {
        significantChangesDetected = true;
        page.significantChanges = false;
        page.lastCapture = Date.now();
        logger.info(`Significant changes detected for tab ${tabId}`);
      } else {
        logger.info(`No significant changes detected for tab ${tabId}`);
      }

    } catch (error) {
      logger.error(`Comprehensive render error for tab ${tabId}`, {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    } finally {
      page.isRendering = false;
    }

    return significantChangesDetected;
  }
};

export default pageMonitor;