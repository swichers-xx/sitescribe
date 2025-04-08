// Capture Management Module

/**
 * Stores metadata of recent captures.
 * Managed externally (e.g., in background script).
 * @type {Array<Object>}
 */
export let recentCaptures = [];

/**
 * Maximum number of recent captures to store.
 * @type {number}
 */
export const MAX_RECENT_CAPTURES = 10;

/**
 * Defines the available capture formats, their MIME types, and file extensions.
 * @type {Object<string, {type: string, mimeType: string, extension: string}>}
 */
export const CAPTURE_FORMATS = {
  PDF: {
    type: 'pdf',
    mimeType: 'application/pdf',
    extension: '.pdf'
  },
  MHTML: {
    type: 'mhtml', 
    mimeType: 'application/mhtml',
    extension: '.mhtml'
  },
  HTML: {
    type: 'html',
    mimeType: 'text/html',
    extension: '.html'
  },
  SCREENSHOT_FULL: {
    type: 'screenshot_full',
    mimeType: 'image/png',
    extension: '.png'
  },
  SCREENSHOT_VISIBLE: {
    type: 'screenshot_visible',
    mimeType: 'image/png',
    extension: '.png'
  },
  MARKDOWN: {
    type: 'markdown',
    mimeType: 'text/markdown',
    extension: '.md'
  },
  TEXT: {
    type: 'text',
    mimeType: 'text/plain',
    extension: '.txt'
  }
};

/**
 * Manages rate limiting for capturing the visible tab content.
 * Prevents excessive calls to chrome.tabs.captureVisibleTab.
 * @type {Object}
 */
export const screenshotRateLimit = {
  /** @type {Array<{resolve: Function, reject: Function}>} */
  queue: [],
  /** @type {boolean} */
  processing: false,
  /** @type {number} */
  lastCapture: 0,
  /** Minimum delay between captures in milliseconds. */
  minDelay: 1000, 

  /**
   * Processes the screenshot capture queue one by one, ensuring minimum delay.
   * @private
   */
  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeToWait = Math.max(0, this.lastCapture + this.minDelay - now);
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      const { resolve, reject } = this.queue.shift();
      try {
        const screenshot = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
        this.lastCapture = Date.now();
        resolve(screenshot);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  },

  /**
   * Adds a capture request to the queue and starts processing if not already running.
   * Resolves with the data URL of the captured visible tab screenshot.
   * @returns {Promise<string>}
   */
  async capture() {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.process();
    });
  }
};