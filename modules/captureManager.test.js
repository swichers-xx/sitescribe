import { 
  recentCaptures, 
  MAX_RECENT_CAPTURES, 
  CAPTURE_FORMATS, 
  screenshotRateLimit 
} from './captureManager';

// Mock chrome APIs used by screenshotRateLimit
global.chrome = {
  tabs: {
    captureVisibleTab: jest.fn(),
  },
};

describe('Capture Manager Module', () => {

  beforeEach(() => {
    // Reset mocks and rate limiter state before each test
    jest.clearAllMocks();
    screenshotRateLimit.queue = [];
    screenshotRateLimit.processing = false;
    screenshotRateLimit.lastCapture = 0;
    // Use fake timers for rate limit testing
    jest.useFakeTimers(); 
  });

  afterEach(() => {
    // Restore real timers after each test
    jest.useRealTimers();
  });

  test('MAX_RECENT_CAPTURES should be defined and be a number', () => {
    expect(MAX_RECENT_CAPTURES).toBeDefined();
    expect(typeof MAX_RECENT_CAPTURES).toBe('number');
    expect(MAX_RECENT_CAPTURES).toBeGreaterThan(0);
  });

  test('CAPTURE_FORMATS should define expected formats', () => {
    expect(CAPTURE_FORMATS).toBeDefined();
    expect(CAPTURE_FORMATS.PDF).toBeDefined();
    expect(CAPTURE_FORMATS.MHTML).toBeDefined();
    expect(CAPTURE_FORMATS.HTML).toBeDefined();
    expect(CAPTURE_FORMATS.SCREENSHOT_FULL).toBeDefined();
    expect(CAPTURE_FORMATS.SCREENSHOT_VISIBLE).toBeDefined();
    expect(CAPTURE_FORMATS.MARKDOWN).toBeDefined();
    expect(CAPTURE_FORMATS.TEXT).toBeDefined();

    // Check a sample format
    expect(CAPTURE_FORMATS.PDF).toEqual({
      type: 'pdf',
      mimeType: 'application/pdf',
      extension: '.pdf'
    });
  });

  test('recentCaptures should be initialized as an empty array', () => {
    // Note: This test assumes the module state isn't persisted across tests in a way that affects this.
    // Depending on Jest config/ESM behavior, more robust reset might be needed if tests interfere.
    expect(recentCaptures).toEqual([]);
  });

  describe('screenshotRateLimit', () => {
    const mockScreenshotDataUrl = 'data:image/png;base64,mock';

    test('should capture immediately if delay has passed', async () => {
      chrome.tabs.captureVisibleTab.mockResolvedValue(mockScreenshotDataUrl);

      const capturePromise = screenshotRateLimit.capture();
      
      // Should start processing immediately
      expect(screenshotRateLimit.processing).toBe(true);

      // Advance timers just enough to ensure no delay is needed
      jest.advanceTimersByTime(0); 

      await expect(capturePromise).resolves.toBe(mockScreenshotDataUrl);
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
      expect(screenshotRateLimit.queue).toHaveLength(0);
      expect(screenshotRateLimit.processing).toBe(false); // Should reset after completion
      expect(screenshotRateLimit.lastCapture).toBeGreaterThan(0);
    });

    test('should delay capture if minimum delay has not passed', async () => {
      chrome.tabs.captureVisibleTab.mockResolvedValue(mockScreenshotDataUrl);
      const minDelay = screenshotRateLimit.minDelay;

      // Simulate a capture just happened
      screenshotRateLimit.lastCapture = Date.now(); 

      const capturePromise = screenshotRateLimit.capture();

      // Should be processing, but captureVisibleTab shouldn't be called yet
      expect(screenshotRateLimit.processing).toBe(true);
      expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();

      // Advance time by slightly less than the minimum delay
      jest.advanceTimersByTime(minDelay - 10);
      // Still shouldn't have been called
      expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();

      // Advance time past the minimum delay
      jest.advanceTimersByTime(10); 

      await expect(capturePromise).resolves.toBe(mockScreenshotDataUrl);
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
      expect(screenshotRateLimit.queue).toHaveLength(0);
      expect(screenshotRateLimit.processing).toBe(false);
    });

    test('should queue multiple captures and process sequentially with delay', async () => {
      chrome.tabs.captureVisibleTab.mockResolvedValue(mockScreenshotDataUrl);
      // Note: minDelay is not explicitly used here, as runAllTimers handles it.

      const promise1 = screenshotRateLimit.capture();
      const promise2 = screenshotRateLimit.capture();
      const promise3 = screenshotRateLimit.capture();

      // 1. Initial check
      expect(screenshotRateLimit.queue).toHaveLength(2);
      expect(screenshotRateLimit.processing).toBe(true);

      // 2. Process first capture
      jest.runAllTimers(); // Runs capture 1 (0 delay) and queues delay for capture 2
      await Promise.resolve(); // Flush microtasks
      await promise1; // Wait for promise 1 to resolve
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
      // Queue state check might be tricky here, depends on loop internals

      // 3. Process second capture
      jest.runAllTimers(); // Runs delay timer for capture 2, runs capture 2, queues delay for capture 3
      await Promise.resolve(); // Flush microtasks
      await promise2; // Wait for promise 2 to resolve
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(2);

      // 4. Process third capture
      jest.runAllTimers(); // Runs delay timer for capture 3, runs capture 3
      await Promise.resolve(); // Flush microtasks
      await promise3; // Wait for promise 3 to resolve
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(3);

      // 5. Final state check
      // Run timers and flush again to ensure loop finishes and processing flag is reset
      jest.runAllTimers();
      await Promise.resolve();
      expect(screenshotRateLimit.queue).toHaveLength(0);
      expect(screenshotRateLimit.processing).toBe(false);
    });

    test('should handle captureVisibleTab errors', async () => {
      const mockError = new Error('Capture Failed');
      chrome.tabs.captureVisibleTab.mockRejectedValue(mockError);

      const capturePromise = screenshotRateLimit.capture();

      // Advance timers
      jest.advanceTimersByTime(0);

      await expect(capturePromise).rejects.toThrow('Capture Failed');
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
      expect(screenshotRateLimit.queue).toHaveLength(0);
      expect(screenshotRateLimit.processing).toBe(false); // Should reset even on error
    });
  });
}); 