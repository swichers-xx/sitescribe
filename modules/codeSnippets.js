// Code Snippet Module
// NOTE: This module is intended to run in the content script context.

/**
 * Extracts code snippets from the page, attempting language detection and context gathering.
 * @returns {Array<{id: string, language: string, code: string, context: string}>} An array of code snippet objects.
 */
export function getCodeSnippets() {
  const snippets = [];
  // Prioritize <pre><code> blocks, then <pre> without <code>, then potentially loose <code> (less common for blocks)
  const codeBlocks = document.querySelectorAll('pre > code, pre:not(:has(> code)), code'); 
  
  codeBlocks.forEach((block, index) => {
    const language = block.className.match(/language-(\w+)/)?.[1] || 
                      block.getAttribute('data-language') || 
                      detectLanguage(block.textContent) || 
                      'text';
    
    snippets.push({
      id: `snippet-${index}`,
      language,
      code: block.textContent.trim(),
      context: getSnippetContext(block)
    });
  });
  
  return snippets;
}

/**
 * Attempts to detect the programming language of a code snippet using basic regex patterns.
 * @param {string} code - The code snippet text.
 * @returns {string | null} The detected language name (lowercase) or null if no match.
 */
export function detectLanguage(code) {
  const patterns = {
    javascript: /(const|let|var|function|=>|import|export|class|async|await|Promise)/,
    python: /(def|import|class|if __name__|print|async def|yield|lambda|try:|except:)/,
    html: /(<\/?[a-z][\s\S]*>|<!DOCTYPE|<html|<head|<body)/i,
    css: /({[\s\S]*}|@media|@keyframes|@import|@font-face|:root|--[a-z])/i,
    sql: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|JOIN|WHERE|GROUP BY|ORDER BY)/i,
    bash: /(\#\!\/bin\/(?:ba)?sh|apt|yum|dnf|pacman|brew|sudo|grep|echo|export|source|\$\{|\$\(|chmod|chown)/i,
    ruby: /(def |class |module |require |gem |rails |attr_|@@\w+|\bdo\b|\bend\b)/i,
    php: /(<\?php|\$\w+|namespace|use |class |function |public |private |protected )/i,
    java: /(public class|private|protected|package|import|class|interface|extends|implements)/,
    csharp: /(using |namespace|class|public|private|protected|async|await|var|string)/
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(code)) return lang;
  }
  return null;
}

/**
 * Tries to find contextual information (e.g., a preceding heading) for a code snippet element.
 * Limited search scope (only previous siblings).
 * @param {HTMLElement} element - The code block element (e.g., <pre> or <code>).
 * @returns {string} The text content of the nearest preceding heading or element with class 'comment', or an empty string.
 */
export function getSnippetContext(element) {
  let context = '';
  let current = element;
  
  // Look for heading or comment above the code
  while (current && context.length < 200) {
    current = current.previousElementSibling;
    if (current && (current.matches('h1,h2,h3,h4,h5,h6') || current.matches('.comment'))) {
      context = current.textContent.trim();
      break;
    }
  }
  
  return context;
}