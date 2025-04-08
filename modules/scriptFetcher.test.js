import { fetchScriptContent, _resetCacheForTests } from './scriptFetcher';

// We need to manage the cache within the test.
// A cleaner approach might be to export a resetCache function from the module,
// but for now, we'll test its behavior as is.

describe('Script Fetcher Module', () => {
  let fetchSpy;
  const mockUrl = 'https://example.com/test.js';
  const mockContent = 'console.log("test");';
  const mockError = new Error('Network Failed');

  beforeEach(() => {
    // Reset fetch spy before each test
    fetchSpy = jest.spyOn(window, 'fetch');
    // Reset the internal module cache before each test
    _resetCacheForTests();
  });

  afterEach(() => {
    // Restore fetch
    fetchSpy.mockRestore();
  });

  test('fetchScriptContent should fetch and return content on first call', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(mockContent, { status: 200, statusText: 'OK' })
    );

    const content = await fetchScriptContent(mockUrl);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(mockUrl);
    expect(content).toBe(mockContent);
  });

  test('fetchScriptContent should return null and log error on fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(mockError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error during test

    const content = await fetchScriptContent('https://example.com/fail.js');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(content).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch script: https://example.com/fail.js', 
      mockError
    );

    consoleErrorSpy.mockRestore();
  });
  
  test('fetchScriptContent should use cache on subsequent calls to the same URL', async () => {
    // First call (populates cache)
    fetchSpy.mockResolvedValueOnce(
      new Response(mockContent, { status: 200, statusText: 'OK' })
    );
    await fetchScriptContent(mockUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call (should hit cache)
    const content = await fetchScriptContent(mockUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1 call, cache was used
    expect(content).toBe(mockContent);
    
    // Third call (different URL, should fetch)
    const anotherUrl = 'https://example.com/another.js';
    const anotherContent = 'console.log("another");';
    fetchSpy.mockResolvedValueOnce(
        new Response(anotherContent, { status: 200, statusText: 'OK' })
      );
    const content2 = await fetchScriptContent(anotherUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // Fetch called again
    expect(fetchSpy).toHaveBeenNthCalledWith(2, anotherUrl);
    expect(content2).toBe(anotherContent);
  });

  // Note: A test for cache clearing (done via interval in background.js)
  // would be more complex, potentially requiring module mocking or 
  // exposing the cache/clear function from scriptFetcher.js.
}); 