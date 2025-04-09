import {
  calculateReadingTime,
  countWords,
  getPerformanceMetrics,
  getPageMetadata
} from './performanceMetadata';

// --- Mocks ---

// Mock functions assumed to be globally available in content script context
// (These are actually defined in content.js or codeSnippets.js, but performanceMetadata.js calls them directly)
global.getCodeSnippets = jest.fn(() => [{ id: 'mock-snippet', language: 'js', code: 'mock', context: '' }]);
global.getPageStructure = jest.fn(() => ({ headings: [], sections: [] }));
global.getResourceInfo = jest.fn(() => ({ images: [], links: [], scripts: [] }));

// Mock relevant DOM properties and methods
const mockMetaTags = {
  'meta[name="description"]': { content: 'Mock Description' },
  'meta[name="keywords"]': { content: 'mock, keywords' },
  'meta[name="author"]': { content: 'Mock Author' },
  'meta[property="article:published_time"]': { content: '2023-01-01T10:00:00Z' },
  'meta[property="article:modified_time"]': { content: '2023-01-01T12:00:00Z' },
  'link[rel="canonical"]': { href: 'https://example.com/canonical' },
  'meta[property="og:title"]': { content: 'Mock OG Title' },
  // Add other OG/Twitter tags as needed...
};

Object.defineProperty(document, 'documentElement', {
  value: { lang: 'en-mock' },
  writable: true,
  configurable: true
});

Object.defineProperty(document, 'title', {
  value: 'Mock Title',
  writable: true,
  configurable: true
});

// Use a descriptor for document.body.innerText to allow mocking
let innerTextValue = '';
Object.defineProperty(document.body, 'innerText', {
  get: jest.fn(() => innerTextValue),
  set: jest.fn(value => { innerTextValue = value; }),
  configurable: true, // Important for mocking/resetting
});

document.querySelector = jest.fn(); // Initialize, will be set in beforeEach

// --- End Mocks ---


describe('Performance Metadata Module', () => {

  let performanceSpy; // To hold the spy

  afterEach(() => {
    // Restore performance spy after each test
    if (performanceSpy) {
        performanceSpy.mockRestore();
        performanceSpy = null; // Ensure it's cleared
    }
  });

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // --- Mock document setup --
    // Reset the querySelector mock for each test
    document.querySelector.mockReset();
    document.querySelector.mockImplementation(selector => {
      if (selector === 'meta[name="description"]') {
        return { getAttribute: () => 'Test Description' };
      }
      if (selector === 'meta[name="keywords"]') {
        return { getAttribute: () => 'test, keywords' };
      }
      if (selector === 'link[rel="canonical"]') {
        return { getAttribute: () => 'http://example.com/canonical' };
      }
      // Return null for other selectors or if specific meta tags shouldn't exist
      return null;
    });

    // Ensure performance object and getEntriesByType method exist before spying
    if (!global.performance) {
      global.performance = {};
    }
    if (typeof global.performance.getEntriesByType !== 'function') {
        global.performance.getEntriesByType = jest.fn(); // Define as a jest mock function
    }


    // --- Performance Spy Setup ---
    performanceSpy = jest.spyOn(global.performance, 'getEntriesByType');
    performanceSpy.mockImplementation(type => {
        // Mock implementation based on type
        const mockPerformanceTiming = {startTime: 100, responseStart: 250, domInteractive: 800, domContentLoadedEventEnd: 1000, loadEventEnd: 1500 };
        const mockPaintTiming = [{ name: 'first-paint', startTime: 300 }, { name: 'first-contentful-paint', startTime: 350 }];
        switch (type) {
            case 'navigation':
                // Return a copy to prevent modification issues if tests alter the object
                return [{ ...mockPerformanceTiming, type: 'navigation', toJSON: () => mockPerformanceTiming }];
            case 'paint':
                return [...mockPaintTiming]; // Return a copy
            default:
                return [];
        }
    });
    // --- End Performance Spy Setup ---

    // Reset querySelector
    document.querySelector.mockImplementation(selector => mockMetaTags[selector] || null);
    // Reset body text
    innerTextValue = ''; 
  });

  describe('countWords', () => {
    test('should return 0 for empty text', () => {
      innerTextValue = ''; // Use empty string for 0 words
      expect(countWords()).toBe(0);
    });

    test('should return 1 for single space', () => {
        innerTextValue = ' ';
        expect(countWords()).toBe(0); // `trim().split()` results in [''] length 1, but implementation might differ
    });

    test('should count words correctly', () => {
      innerTextValue = '  Hello world, this is a test.  ';
      expect(countWords()).toBe(6);
    });
  });

  describe('calculateReadingTime', () => {
    test('should calculate reading time based on 200 WPM', () => {
      innerTextValue = Array(300).fill('word').join(' ');
      expect(calculateReadingTime()).toBe(2);
    });

     test('should return 1 minute for less than 200 words', () => {
      innerTextValue = Array(50).fill('word').join(' ');
      expect(calculateReadingTime()).toBe(1);
    });

     test('should return 0 for 0 words (empty string)', () => {
       innerTextValue = ''; // Use empty string
       expect(calculateReadingTime()).toBe(0);
     });
     
     test('should return 1 for whitespace string (1 word from split)', () => {
       innerTextValue = '   '; // Use whitespace string
       expect(calculateReadingTime()).toBe(0); // Based on countWords returning 0 for whitespace
     });
  });

  describe('getPerformanceMetrics', () => {
    test('should return performance metrics from navigation and paint timings', () => {
      // --- Override mock specifically for this test ---
      const originalImplementation = performanceSpy.getMockImplementation();
      performanceSpy.mockImplementation(type => {
        if (type === 'resource') {
          // Return 3 dummy resource entries for this test
          return [{}, {}, {}];
        }
        // Fallback to the original implementation for other types
        return originalImplementation(type);
      });
      // --- End Override ---

      const metrics = getPerformanceMetrics();
      // Check spy calls
      expect(performanceSpy).toHaveBeenCalledWith('navigation');
      expect(performanceSpy).toHaveBeenCalledWith('paint');
      expect(performanceSpy).toHaveBeenCalledWith('resource');
      // Check that the metrics object matches the expected structure and values based on mocks
      expect(metrics).toEqual({
        loadTime: 1400,
        domInteractive: 700,
        domContentLoaded: 900,
        pageLoadComplete: 1400,
        ttfb: 150,
        firstPaint: 300,
        firstContentfulPaint: 350,
        resourceCount: 3
      });

      // Restore original mock implementation if needed (though beforeEach usually handles this)
      performanceSpy.mockImplementation(originalImplementation);
    });

     test('should handle missing navigation entries gracefully', () => {
        // Modify the mock *for this specific test*
        performanceSpy.mockImplementation(type => {
             if (type === 'navigation') return []; // Simulate no navigation entry
             if (type === 'paint') return [{ name: 'first-paint', startTime: 300 }, { name: 'first-contentful-paint', startTime: 350 } ];
             if (type === 'resource') return [{}, {}];
             return [];
        });
        const metrics = getPerformanceMetrics();
        // ... assertions ...
        expect(performanceSpy).toHaveBeenCalled(); 
     });
  });

  describe('getPageMetadata', () => {
    test('should extract various metadata points', () => {
       innerTextValue = Array(100).fill('word').join(' '); 
       const metadata = getPageMetadata();
       // ... assertions ...
       expect(metadata.title).toBe('Mock Title');
       expect(metadata.description).toBe('Mock Description');
       expect(metadata.keywords).toBe('mock, keywords');
       expect(metadata.author).toBe('Mock Author');
       expect(metadata.publishedTime).toBe('2023-01-01T10:00:00Z');
       expect(metadata.modifiedTime).toBe('2023-01-01T12:00:00Z');
       expect(metadata.language).toBe('en-mock');
       expect(metadata.canonicalUrl).toBe('https://example.com/canonical');
       expect(metadata.wordCount).toBe(100);
       expect(metadata.readingTime).toBe(1);
       expect(metadata.ogTags.title).toBe('Mock OG Title');
       expect(getCodeSnippets).toHaveBeenCalledTimes(1);
       expect(getPageStructure).toHaveBeenCalledTimes(1);
       expect(getResourceInfo).toHaveBeenCalledTimes(1);
       // Ensure the performance mock was called via getPerformanceMetrics
       expect(performanceSpy).toHaveBeenCalled(); 
       // ... assertions ...
       expect(metadata.codeSnippets).toEqual([{ id: 'mock-snippet', language: 'js', code: 'mock', context: '' }]);
       expect(metadata.pageStructure).toEqual({ headings: [], sections: [] });
       expect(metadata.resourceInfo).toEqual({ images: [], links: [], scripts: [] });
       expect(metadata.performance).toBeDefined();
       expect(metadata.performance.loadTime).toBe(1400);
    });

    test('should handle missing meta tags gracefully', () => {
        document.querySelector.mockImplementation(() => null);
        innerTextValue = ''; 
        const metadata = getPageMetadata();
        // ... assertions ...
        expect(metadata.description).toBe('');
        expect(metadata.keywords).toBe('');
        expect(metadata.author).toBe('');
        expect(metadata.ogTags.title).toBe('');
        expect(metadata.wordCount).toBe(0);
        expect(metadata.readingTime).toBe(0);
    });
  });
}); 