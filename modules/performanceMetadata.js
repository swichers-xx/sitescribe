// Performance and Metadata Module
// NOTE: This module is intended to run in the content script context.

/**
 * Calculates the estimated reading time for the page content.
 * Assumes an average reading speed of 200 words per minute.
 * @returns {number} Estimated reading time in minutes.
 */
export function calculateReadingTime() {
  const text = document.body.innerText;
  const wordCount = countWords();
  const wordsPerMinute = 200;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Counts the number of words in the document body's text content.
 * @returns {number} The total word count.
 */
export function countWords() {
  const text = document.body.innerText;
  return text.trim().split(/\s+/).length;
}

/**
 * Retrieves performance metrics using the Navigation Timing API.
 * @returns {object} An object containing performance metrics like load time, DOM content loaded time, etc.
 */
export function getPerformanceMetrics() {
  const entries = performance.getEntriesByType('navigation');
  if (!entries || entries.length === 0) {
    return {
      loadTime: null,
      domContentLoaded: null,
      firstPaint: null,
      resourceCount: performance.getEntriesByType('resource').length
    };
  }

  const timing = entries[0]; // Use the first navigation entry

  // Get First Paint (FP) and First Contentful Paint (FCP)
  let firstPaint = null;
  let firstContentfulPaint = null;
  const paintEntries = performance.getEntriesByType('paint');
  paintEntries.forEach(entry => {
    if (entry.name === 'first-paint') {
      firstPaint = entry.startTime;
    }
    if (entry.name === 'first-contentful-paint') {
      firstContentfulPaint = entry.startTime;
    }
  });

  return {
    // Measures from the start of navigation until the load event is complete
    loadTime: timing.loadEventEnd > 0 ? timing.loadEventEnd - timing.startTime : null,
    // Measures from the start of navigation until the DOM is ready
    domInteractive: timing.domInteractive > 0 ? timing.domInteractive - timing.startTime : null,
    // Measures from the start of navigation until the DOMContentLoaded event is complete
    domContentLoaded: timing.domContentLoadedEventEnd > 0 ? timing.domContentLoadedEventEnd - timing.startTime : null,
    // Measures from the start of navigation until the page is fully loaded (including resources)
    pageLoadComplete: timing.loadEventEnd > 0 ? timing.loadEventEnd - timing.startTime : null,
    // Time To First Byte: Measures the time from navigation start to when the first byte of the response is received
    ttfb: timing.responseStart > 0 ? timing.responseStart - timing.startTime : null,
    firstPaint: firstPaint,
    firstContentfulPaint: firstContentfulPaint,
    resourceCount: performance.getEntriesByType('resource').length
  };
}

/**
 * Extracts comprehensive metadata from the current page.
 * Includes basic meta tags, OG/Twitter tags, calculated metrics, and calls functions 
 * to get code snippets, page structure, resource info, and performance data.
 * Assumes getCodeSnippets, getPageStructure, getResourceInfo are available in the scope.
 * @returns {object} An object containing various page metadata.
 */
export function getPageMetadata() {
  const wordCount = countWords(); // Calculate once
  const basicMetadata = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
    author: document.querySelector('meta[name="author"]')?.content || '',
    publishedTime: document.querySelector('meta[property="article:published_time"]')?.content || '',
    modifiedTime: document.querySelector('meta[property="article:modified_time"]')?.content || '',
    language: document.documentElement.lang || '',
    canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || '',
    readingTime: calculateReadingTime(), // This will reuse the wordCount calculation implicitly via its own call
    wordCount: wordCount, // Use the calculated value
    ogTags: {
      title: document.querySelector('meta[property="og:title"]')?.content || '',
      type: document.querySelector('meta[property="og:type"]')?.content || '',
      image: document.querySelector('meta[property="og:image"]')?.content || '',
      description: document.querySelector('meta[property="og:description"]')?.content || ''
    },
    twitterTags: {
      card: document.querySelector('meta[name="twitter:card"]')?.content || '',
      title: document.querySelector('meta[name="twitter:title"]')?.content || '',
      description: document.querySelector('meta[name="twitter:description"]')?.content || '',
      image: document.querySelector('meta[name="twitter:image"]')?.content || ''
    }
  };

  return {
    ...basicMetadata,
    codeSnippets: getCodeSnippets(),
    pageStructure: getPageStructure(),
    resourceInfo: getResourceInfo(),
    performance: getPerformanceMetrics()
  };
}