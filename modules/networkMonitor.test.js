import {
  startNetworkMonitoring,
  stopNetworkMonitoring,
  getNetworkRequests,
} from './networkMonitor';

// --- Mock XMLHttpRequest --- 
// Basic mock for XHR to test interception logic
global.XMLHttpRequest = class MockXMLHttpRequest {
  constructor() {
    this._requestData = {};
    this._listeners = {};
  }

  open(method, url) {
    // This method will be replaced by the patched version during the test
    this._originalOpenCalled = true; // Flag to check if original logic was reached
    this._requestData = { method, url }; // Store args for verification
  }

  addEventListener(type, listener) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(l => l !== listener);
    }
  }

  // Methods to simulate events for testing
  _simulateLoad(status = 200, statusText = 'OK') {
    this.status = status;
    this.statusText = statusText;
    if (this._listeners.load) {
      this._listeners.load.forEach(l => l());
    }
  }

  _simulateError(errorMessage = 'XHR Error') {
    this.status = 0; // Typically 0 on network error
    if (this._listeners.error) {
      this._listeners.error.forEach(l => l({ message: errorMessage }));
    }
  }
};
// --- End Mock XMLHttpRequest ---

describe('Network Monitor Module', () => {
  let originalFetch;
  let originalXHROpen;

  // Store original implementations before any tests run
  beforeAll(() => {
    originalFetch = window.fetch;
    originalXHROpen = window.XMLHttpRequest.prototype.open;
  });

  // Ensure monitoring is stopped and originals restored after each test
  afterEach(() => {
    stopNetworkMonitoring(); // Ensure cleanup
    window.fetch = originalFetch; // Force restore originals
    window.XMLHttpRequest.prototype.open = originalXHROpen;
  });

  test('should not be monitoring initially', () => {
    expect(window.fetch).toBe(originalFetch);
    expect(window.XMLHttpRequest.prototype.open).toBe(originalXHROpen);
  });

  test('startNetworkMonitoring should patch fetch and XHR open', () => {
    startNetworkMonitoring();
    expect(window.fetch).not.toBe(originalFetch);
    expect(window.XMLHttpRequest.prototype.open).not.toBe(originalXHROpen);
  });

  test('stopNetworkMonitoring should restore fetch and XHR open', () => {
    startNetworkMonitoring();
    stopNetworkMonitoring();
    expect(window.fetch).toBe(originalFetch);
    expect(window.XMLHttpRequest.prototype.open).toBe(originalXHROpen);
  });

  test('should not patch multiple times if start is called again', () => {
    startNetworkMonitoring();
    const patchedFetch1 = window.fetch;
    const patchedXHROpen1 = window.XMLHttpRequest.prototype.open;
    startNetworkMonitoring(); // Call again
    expect(window.fetch).toBe(patchedFetch1); // Should be the same patched function
    expect(window.XMLHttpRequest.prototype.open).toBe(patchedXHROpen1);
  });

  test('should not unpatch multiple times if stop is called again', () => {
    startNetworkMonitoring();
    stopNetworkMonitoring();
    const restoredFetch = window.fetch;
    const restoredXHROpen = window.XMLHttpRequest.prototype.open;
    stopNetworkMonitoring(); // Call again
    expect(window.fetch).toBe(restoredFetch);
    expect(window.XMLHttpRequest.prototype.open).toBe(restoredXHROpen);
  });

  test('getNetworkRequests should return collected requests', () => {
    expect(getNetworkRequests()).toEqual([]); // Initially empty
    // More detailed tests below will verify content
  });

  describe('Fetch Interception', () => {
    const mockUrl = 'https://example.com/api/data';
    const mockData = { message: 'success' };

    test('should intercept and log successful fetch calls', async () => {
      // Mock the *original* fetch that the patch will call
      global.fetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200, statusText: 'OK' })
      );
      startNetworkMonitoring(); // Patches fetch

      const response = await window.fetch(mockUrl, { method: 'POST' });
      const data = await response.json();

      expect(data).toEqual(mockData);
      const requests = getNetworkRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        type: 'fetch',
        url: mockUrl,
        method: 'POST',
        status: 200,
        statusText: 'OK',
      });
      expect(requests[0].timestamp).toBeDefined();
    });

    test('should intercept and log failed fetch calls', async () => {
      const error = new Error('Network Error');
      global.fetch = jest.fn().mockRejectedValue(error);
      startNetworkMonitoring();

      await expect(window.fetch(mockUrl)).rejects.toThrow('Network Error');

      const requests = getNetworkRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        type: 'fetch',
        url: mockUrl,
        method: 'GET', // Default method
        error: 'Network Error',
      });
    });
  });

  describe('XHR Interception', () => {
    const mockUrl = 'https://example.com/api/xhr';

    test('should intercept and log successful XHR calls', () => {
        // Mock the original open method (which our patch should call)
        XMLHttpRequest.prototype.open = jest.fn(originalXHROpen);
        startNetworkMonitoring(); // Applies the patch over the jest.fn mock

        const xhr = new window.XMLHttpRequest();
        xhr.open('GET', mockUrl);
        
        // Simulate the load event occurring *after* open is called
        xhr._simulateLoad(201, 'Created');

        const requests = getNetworkRequests();
        expect(requests).toHaveLength(1);
        expect(requests[0]).toMatchObject({
            type: 'xhr',
            url: mockUrl,
            method: 'GET',
            status: 201,
            statusText: 'Created',
        });
        expect(requests[0].timestamp).toBeDefined();
        // Verify our *original* mock (before patching) wasn't called directly
        // Instead, the patched version should have called the original (which is now the jest.fn)
        // This part is tricky; let's ensure the patch structure ran
        // expect(XMLHttpRequest.prototype.open).toHaveBeenCalled(); // Check if the outer mock was hit
    });

    test('should intercept and log failed XHR calls', () => {
        XMLHttpRequest.prototype.open = jest.fn(originalXHROpen);
        startNetworkMonitoring();

        const xhr = new window.XMLHttpRequest();
        xhr.open('PUT', mockUrl);
        xhr._simulateError('Connection Failed');

        const requests = getNetworkRequests();
        expect(requests).toHaveLength(1);
        expect(requests[0]).toMatchObject({
            type: 'xhr',
            url: mockUrl,
            method: 'PUT',
            error: 'Connection Failed',
        });
    });
  });
}); 