import { fetchScriptContent } from './modules/scriptFetcher';
import { parseUrl, createFolderStructure } from './modules/utils';

describe('Integration Tests', () => {
  // Mock window.fetch before running tests in this suite
  let fetchSpy;
  const mockScriptContent = 'console.log("mock script");';

  beforeEach(() => {
    fetchSpy = jest.spyOn(window, 'fetch').mockImplementation(async (url) => {
      if (url === 'https://example.com/script.js') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockScriptContent),
        });
      }
      // For other URLs, return a basic failure
      return Promise.resolve({ 
          ok: false, 
          status: 404, 
          statusText: 'Not Found', 
          text: () => Promise.resolve('Not Found') 
      }); 
    });
    // Clear script cache? (Assuming scriptFetcher might cache)
    // Consider resetting module state or exposing cache clear function
  });

  afterEach(() => {
    // Restore original fetch implementation
    fetchSpy.mockRestore();
  });

  test('fetchScriptContent and parseUrl should work together', async () => {
    const url = 'https://example.com/script.js';
    const scriptContent = await fetchScriptContent(url);
    const urlComponents = parseUrl(url);

    expect(fetchSpy).toHaveBeenCalledWith(url);
    expect(scriptContent).toBe(mockScriptContent);
    expect(urlComponents).toEqual({
      fullUrl: url,
      protocol: 'https',
      domain: {
        full: 'example.com',
        main: 'example.com',
        sub: ''
      },
      path: ['script.js'],
      query: '',
      timestamp: expect.any(String)
    });
  });

  test('createFolderStructure should integrate with parseUrl', () => {
    const url = 'https://example.com/path';
    const urlComponents = parseUrl(url);
    const pageMetadata = { title: 'Example Page' };
    const folderStructure = createFolderStructure(urlComponents, pageMetadata);

    expect(folderStructure.folderPath).toBe('webData/example.com/path');
    expect(folderStructure.metadata.page.title).toBe('Example Page');
  });
});