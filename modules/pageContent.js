// Page Content Module
// NOTE: This module is intended to run in the content script context.

/**
 * Calculates the maximum scroll width and height of the document.
 * @returns {{width: number, height: number}} The page dimensions.
 */
export function getPageDimensions() {
  return {
    width: Math.max(
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    ),
    height: Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    )
  };
}

/**
 * Gets the outer HTML of the document element after removing script and style tags.
 * Note: This is a basic cleanup; it doesn't remove inline scripts/styles or other potentially active content.
 * @returns {string} The cleaned HTML string.
 */
export function getHTML() {
  const clone = document.documentElement.cloneNode(true);
  // Remove scripts
  const scripts = clone.getElementsByTagName('script');
  while (scripts.length > 0) scripts[0].remove();
  // Remove inline styles
  const styles = clone.getElementsByTagName('style');
  while (styles.length > 0) styles[0].remove();
  return clone.outerHTML;
}

/**
 * Gets the inner text content of the <article> element, or the document body if <article> is not found.
 * Note: This captures all text, including navigation, ads, etc., if not within a specific <article>.
 * For cleaner article text, consider getReadableContent().
 * @returns {string} The extracted text content.
 */
export function getText() {
  const article = document.querySelector('article') || document.body;
  return article.innerText;
}

/**
 * Attempts to extract the main readable content (title and text) using the Readability library.
 * Requires the Readability library to be loaded globally in the content script context.
 * @returns {string} Formatted readable content (Markdown-like) or an error/fallback message.
 */
export function getReadableContent() {
  try {
    // Ensure Readability is available
    if (typeof Readability === 'undefined') {
      console.error('Readability library not found.');
      return 'Error: Readability library not available.';
    }
    const documentClone = document.cloneNode(true);
    // Readability constructor might throw if document is unsuitable
    const article = new Readability(documentClone).parse(); 
    return article ? `# ${article.title}\n\n${article.textContent}` : 'No readable content found';
  } catch (error) {
    console.error('Error using Readability:', error);
    return `Error processing content with Readability: ${error.message}`;
  }
}