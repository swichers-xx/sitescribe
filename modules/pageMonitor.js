// Page Monitoring Module

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
      return; // Already monitoring
    }
    
    this.activePages.set(tabId, {
      url,
      lastCapture: Date.now(),
      contentHash: '',
      isRendering: false,
      significantChanges: false
    });

    // Inject monitoring script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        function: this.setupPageMonitoring,
      });
    } catch (error) {
      console.error('Failed to inject monitoring script:', error);
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
    if (!page || page.isRendering) return false; // Return false if not monitoring or already rendering

    page.isRendering = true;
    let lastScrollPosition = 0;
    let significantChangesDetected = false; // Track changes during rendering

    try {
      // Get page dimensions
      const { height } = await chrome.tabs.sendMessage(tabId, { 
        action: 'getPageDimensions' 
      });

      // Scroll through the page
      while (lastScrollPosition < height) {
        await chrome.tabs.sendMessage(tabId, {
          action: 'scrollTo',
          position: lastScrollPosition
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, this.scrollInterval));
        lastScrollPosition += this.minScrollStep;
      }

      // Wait for final renders
      await new Promise(resolve => setTimeout(resolve, this.renderTimeout));

      // Check if significant changes were detected during this render process
      if (page.significantChanges) {
        significantChangesDetected = true;
        page.significantChanges = false; // Reset flag for next time
        page.lastCapture = Date.now(); // Update last capture time conceptually
      }
    } catch (error) {
      console.error('Page rendering failed:', error);
    } finally {
      page.isRendering = false;
    }
    return significantChangesDetected; // Return the result
  }
};