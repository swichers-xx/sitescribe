// Network Monitoring Module
// NOTE: This module is intended to run in the content script context.

/** @type {Array<object>} - Stores captured network request data. */
let networkRequests = [];
/** @type {Function | null} - Holds the original window.fetch implementation. */
let originalFetch = null;
/** @type {Function | null} - Holds the original XMLHttpRequest.prototype.open implementation. */
let originalXHROpen = null;
/** @type {boolean} - Tracks if monitoring is currently active. */
let isMonitoring = false;

/**
 * Intercepts fetch requests to log them.
 * @param {...any} args - Arguments passed to the original fetch.
 * @returns {Promise<Response>} The response from the original fetch.
 */
async function patchedFetch(...args) {
  const request = {
    type: 'fetch',
    url: typeof args[0] === 'string' ? args[0] : args[0]?.url,
    method: typeof args[0] === 'string' ? (args[1]?.method || 'GET') : args[0]?.method,
    headers: typeof args[0] === 'string' ? args[1]?.headers : args[0]?.headers,
    timestamp: new Date().toISOString()
  };

  try {
    // Ensure originalFetch is available before calling apply
    if (!originalFetch) throw new Error('Original fetch not captured.');
    const response = await originalFetch.apply(this, args);
    request.status = response.status;
    request.statusText = response.statusText;
    networkRequests.push(request);
    return response;
  } catch (error) {
    request.error = error instanceof Error ? error.message : String(error);
    networkRequests.push(request);
    throw error;
  }
}

/**
 * Intercepts XMLHttpRequest open calls to log them.
 * @param {string} method - The HTTP method.
 * @param {string} url - The request URL.
 */
function patchedXHROpen(method, url) {
  this._requestData = {
    type: 'xhr',
    url,
    method,
    timestamp: new Date().toISOString()
  };

  // Use arrow functions to maintain 'this' context if needed, or bind
  const handleLoad = () => {
    this._requestData.status = this.status;
    this._requestData.statusText = this.statusText;
    networkRequests.push(this._requestData);
    this.removeEventListener('load', handleLoad); // Clean up listener
    this.removeEventListener('error', handleError); // Clean up listener
  };

  const handleError = (event) => {
    this._requestData.error = event.message || 'XHR Error';
    networkRequests.push(this._requestData);
    this.removeEventListener('load', handleLoad); // Clean up listener
    this.removeEventListener('error', handleError); // Clean up listener
  };

  this.addEventListener('load', handleLoad);
  this.addEventListener('error', handleError);

  // Ensure originalXHROpen is available before calling apply
  if (!originalXHROpen) throw new Error('Original XHR open not captured.');
  return originalXHROpen.apply(this, arguments);
}

/**
 * Starts intercepting fetch and XHR requests.
 * Clears any previously collected requests.
 */
export function startNetworkMonitoring() {
  if (isMonitoring) return; // Prevent double patching

  networkRequests = []; // Clear previous requests
  originalFetch = window.fetch;
  originalXHROpen = window.XMLHttpRequest.prototype.open;

  window.fetch = patchedFetch;
  window.XMLHttpRequest.prototype.open = patchedXHROpen;

  isMonitoring = true;
  console.log('Network monitoring started.');
}

/**
 * Stops intercepting fetch and XHR requests, restoring original functions.
 */
export function stopNetworkMonitoring() {
  if (!isMonitoring) return;

  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
  if (originalXHROpen) {
    window.XMLHttpRequest.prototype.open = originalXHROpen;
    originalXHROpen = null;
  }

  isMonitoring = false;
  console.log('Network monitoring stopped.');
}

/**
 * Returns the list of captured network requests.
 * @returns {Array<object>} A copy of the captured network requests array.
 */
export function getNetworkRequests() {
  // Return a copy to prevent external modification
  return [...networkRequests];
}