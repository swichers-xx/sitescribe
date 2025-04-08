// Import the function to test
// We need to reset the internal state ('readabilityLoaded') for isolation.
// One way is using jest.resetModules() before each test.
let initReadability;

// Mock chrome API
global.chrome = {
  runtime: {
    getURL: jest.fn().mockImplementation(path => `chrome-extension://test-id/${path}`)
  }
};

// Mock DOM methods
let mockScriptElement;
let appendChildSpy;

document.createElement = jest.fn(tagName => {
  if (tagName === 'script') {
    mockScriptElement = {
      src: '',
      onload: null,
      onerror: null,
      _listeners: {},
      addEventListener: function(type, listener) {
        this._listeners[type] = listener;
      },
      removeEventListener: function(type) {
        delete this._listeners[type];
      },
      // Simulate load/error
      _simulateLoad: function() { if (this.onload) this.onload(); },
      _simulateError: function(err) { if (this.onerror) this.onerror(err); }
    };
    return mockScriptElement;
  }
  // Basic fallback for other elements if needed
  return { appendChild: jest.fn() }; 
});

// JSDOM provides document.head, just spy on its appendChild
appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation(() => {}); // Mock implementation to prevent actual DOM modification during test

describe('Readability Initialization Module', () => {

  beforeEach(() => {
    // Reset modules to isolate the internal `readabilityLoaded` flag
    jest.resetModules();
    // Re-require the module to get a fresh instance
    ({ initReadability } = require('./readabilityInit')); 
    // Clear mocks
    jest.clearAllMocks();
    appendChildSpy.mockClear();
  });

  test('should create and append script element on first call', async () => {
    const promise = initReadability();

    // Check script creation and properties
    expect(document.createElement).toHaveBeenCalledWith('script');
    expect(mockScriptElement.src).toBe('chrome-extension://test-id/lib/Readability.js');
    expect(chrome.runtime.getURL).toHaveBeenCalledWith('lib/Readability.js');

    // Check appending
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(mockScriptElement);

    // Simulate successful load
    mockScriptElement._simulateLoad();
    
    await expect(promise).resolves.toBeUndefined();
  });

  test('should not append script on subsequent calls', async () => {
    // First call
    const promise1 = initReadability();
    mockScriptElement._simulateLoad();
    await promise1;

    expect(appendChildSpy).toHaveBeenCalledTimes(1);

    // Second call
    const promise2 = initReadability();
    await promise2; // Should resolve immediately

    // Check that appendChild wasn't called again
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
  });

  test('should reject promise on script load error', async () => {
    const mockError = new Error('Failed to load script');
    const promise = initReadability();

    // Check script creation and appending happened
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(mockScriptElement);

    // Simulate error
    mockScriptElement._simulateError(mockError);

    await expect(promise).rejects.toThrow('Failed to load script');
  });

   test('should handle subsequent calls correctly after an error', async () => {
    // First call fails
    const error = new Error('Load Failed');
    const promise1 = initReadability();
    mockScriptElement._simulateError(error);
    await expect(promise1).rejects.toBe(error);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);

    // Second call should try again
    // Need a new mock script element for the second attempt
    document.createElement.mockClear();
    appendChildSpy.mockClear();
    
    const promise2 = initReadability();
    // Simulate success this time
    expect(document.createElement).toHaveBeenCalledWith('script');
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(mockScriptElement);
    mockScriptElement._simulateLoad();
    await expect(promise2).resolves.toBeUndefined();

    // Third call should now be cached as loaded
     appendChildSpy.mockClear();
     await initReadability();
     expect(appendChildSpy).not.toHaveBeenCalled();
   });
}); 