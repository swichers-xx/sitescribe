import { parseUrl, createFolderStructure, blobToDataUrl, ensureContentScript } from './utils';

describe('Utils Module', () => {
  beforeAll(() => {
    global.FileReader = class {
      constructor() {
        this.result = null;
        this.onloadend = null;
        this.onerror = null;
      }
      readAsDataURL(blob) {
        this.result = 'data:text/plain;base64,SGVsbG8sIHdvcmxkIQ==';
        if (this.onloadend) this.onloadend();
      }
    };

    global.chrome = {
      scripting: {
        executeScript: jest.fn()
          .mockResolvedValueOnce([{ result: false }])
          .mockResolvedValueOnce(undefined),
      },
    };
  });

  test('parseUrl should correctly parse a URL', () => {
    const url = 'https://example.com/path?query=123';
    const result = parseUrl(url);
    expect(result).toEqual({
      fullUrl: url,
      protocol: 'https',
      domain: {
        full: 'example.com',
        main: 'example.com',
        sub: ''
      },
      path: ['path'],
      query: '?query=123',
      timestamp: expect.any(String)
    });
  });

  test('createFolderStructure should create a correct folder structure', () => {
    const urlComponents = {
      protocol: 'https',
      domain: {
        full: 'example.com',
        main: 'example.com',
        sub: ''
      },
      path: ['path'],
      query: '?query=123',
      timestamp: '2025-03-06T19:37:00.000Z'
    };
    const pageMetadata = { title: 'Example Page' };
    const result = createFolderStructure(urlComponents, pageMetadata);
    expect(result).toEqual({
      folderPath: 'webData/example.com/path',
      metadata: {
        captureTime: '2025-03-06T19-37-00-000Z',
        url: {
          full: undefined,
          domain: 'example.com',
          mainDomain: 'example.com',
          subdomain: '',
          path: 'path',
          query: '?query=123'
        },
        page: pageMetadata
      }
    });
  });

  test('blobToDataUrl should convert a blob to a data URL', async () => {
    const blob = new Blob(['Hello, world!'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
  });

  test('ensureContentScript should inject content script', async () => {
    const tabId = 1;
    await ensureContentScript(tabId);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2,
      {
        target: { tabId },
        files: ['content.js']
      }
    );
  });
});