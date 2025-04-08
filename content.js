// Import network requests from the networkMonitor module
import { networkRequests } from './modules/networkMonitor.js';

import { initReadability } from './modules/readabilityInit.js';

import { getPageDimensions, getHTML, getText, getReadableContent } from './modules/pageContent.js';

import { calculateReadingTime, countWords, getPerformanceMetrics, getPageMetadata } from './modules/performanceMetadata.js';

import { getCodeSnippets, detectLanguage, getSnippetContext } from './modules/codeSnippets.js';

// Get page structure information
function getPageStructure() {
  return {
    headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim(),
        id: h.id || null
      })),
    sections: Array.from(document.querySelectorAll('section, article, main, div[role="main"]'))
      .map(s => ({
        role: s.getAttribute('role') || s.tagName.toLowerCase(),
        id: s.id || null,
        className: s.className
      }))
  };
}

// Get resource information
function getResourceInfo() {
  return {
    images: Array.from(document.images).map(img => ({
      src: img.src,
      alt: img.alt,
      dimensions: `${img.naturalWidth}x${img.naturalHeight}`
    })),
    links: Array.from(document.links).map(link => ({
      href: link.href,
      text: link.textContent.trim(),
      isExternal: link.hostname !== window.location.hostname
    })),
    scripts: Array.from(document.scripts).map(script => ({
      src: script.src || 'inline',
      type: script.type || 'text/javascript',
      async: script.async,
      defer: script.defer
    }))
  };
}

// Function to get script contents
function getScriptContents() {
  return Array.from(document.scripts).map(script => {
    if (script.src) {
      return {
        type: 'external',
        src: script.src,
        async: script.async,
        defer: script.defer,
        type: script.type || 'text/javascript',
        content: null // External script content will be fetched by background script
      };
    } else {
      return {
        type: 'inline',
        content: script.textContent,
        type: script.type || 'text/javascript'
      };
    }
  });
}

// Function to get API endpoints
function getAPIEndpoints() {
  const endpoints = new Set();
  
  // Analyze network requests
  networkRequests.forEach(request => {
    try {
      const url = new URL(request.url);
      if (url.pathname.includes('/api/') || 
        url.pathname.match(/\/(v1|v2|v3)\//) ||
        url.pathname.match(/\.(json|xml)$/)) {
        endpoints.add({
          url: request.url,
          method: request.method,
          type: request.type
        });
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
    }
  });
  
  return Array.from(endpoints);
}

// Process content with LLM
async function processWithLLM(content, options = {}) {
  const settings = await chrome.storage.sync.get({
    llmEnabled: false,
    llmEndpoint: '',
    llmApiKey: '',
    llmModel: 'gpt-3.5-turbo',
    llmPrompt: 'Summarize the main points of this content:'
  });

  if (!settings.llmEnabled || !settings.llmEndpoint || !settings.llmApiKey) {
    return null;
  }

  try {
    const response = await fetch(settings.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.llmApiKey}`
      },
      body: JSON.stringify({
        model: settings.llmModel,
        messages: [{
          role: 'system',
          content: settings.llmPrompt
        }, {
          role: 'user',
          content: content
        }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const result = await response.json();
    return {
      summary: result.choices[0].message.content,
      model: settings.llmModel,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('LLM processing error:', error);
    return null;
  }
}

// Function to get full page content with enhanced structure
async function getPageContent() {
  try {
    console.log('Extracting page content');
    const metadata = getPageMetadata();
    const mainContent = document.querySelector('main') || 
                         document.querySelector('article') || 
                         document.querySelector('.content') || 
                         document.body;
    
    const content = [];
    
    // Add metadata section
    content.push('# ' + metadata.title + '\n');
    content.push('## Metadata\n');
    content.push('- **URL**: ' + window.location.href);
    content.push('- **Language**: ' + metadata.language);
    if (metadata.description) content.push('- **Description**: ' + metadata.description);
    if (metadata.author) content.push('- **Author**: ' + metadata.author);
    if (metadata.publishedTime) content.push('- **Published**: ' + metadata.publishedTime);
    if (metadata.modifiedTime) content.push('- **Modified**: ' + metadata.modifiedTime);
    content.push('\n');

    // Extract headings and content structure
    const headings = mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const sections = new Map();
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      const sectionContent = [];
      let nextElement = heading.nextElementSibling;
      
      while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
        if (nextElement.matches('p')) {
          sectionContent.push(nextElement.textContent.trim());
        }
        nextElement = nextElement.nextElementSibling;
      }
      
      content.push('\n' + '#'.repeat(level) + ' ' + heading.textContent.trim() + '\n');
      sectionContent.forEach(text => content.push(text + '\n'));
    });

    // Extract links
    const links = mainContent.querySelectorAll('a[href]');
    if (links.length > 0) {
      content.push('\n## Referenced Links\n');
      const uniqueLinks = new Map();
      links.forEach(link => {
        const text = link.textContent.trim();
        const href = link.href;
        if (text && href && !uniqueLinks.has(href)) {
          uniqueLinks.set(href, text);
          content.push(`- [${text}](${href})`);
        }
      });
    }

    // Add images section
    const images = mainContent.querySelectorAll('img[src]');
    if (images.length > 0) {
      content.push('\n## Images\n');
      const uniqueImages = new Set();
      images.forEach(img => {
        const src = img.src;
        const alt = img.alt || 'No description available';
        if (src && !uniqueImages.has(src)) {
          uniqueImages.add(src);
          content.push(`![${alt}](${src})`);
        }
      });
    }

    const extractedContent = content.join('\n');
    const llmAnalysis = await processWithLLM(extractedContent);
    
    return {
      content: extractedContent,
      metadata: metadata,
      llmAnalysis
    };
  } catch (error) {
    console.error('Content extraction failed:', error);
    return {
      content: `Error extracting content: ${error.message}`,
      metadata: {}
    };
  }
}

// Add scroll handling functions
function scrollTo(position) {
  window.scrollTo({
    top: position,
    behavior: 'smooth'
  });
  return new Promise(resolve => setTimeout(resolve, 100));
}

// Add mutation observer for dynamic content
let pageObserver = null;
let lastMutationTime = Date.now();
let significantChanges = false;

function setupMutationObserver() {
  if (pageObserver) return;

  pageObserver = new MutationObserver((mutations) => {
    const hasSignificantChanges = mutations.some(mutation => {
      // Check for content changes
      if (mutation.type === 'childList' && 
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
        return true;
      }
      // Check for attribute changes on important elements
      if (mutation.type === 'attributes' && 
          mutation.target.matches('img, video, iframe, article, section')) {
        return true;
      }
      return false;
    });

    if (hasSignificantChanges) {
      lastMutationTime = Date.now();
      significantChanges = true;
      chrome.runtime.sendMessage({ 
        action: 'contentChanged',
        timestamp: lastMutationTime
      });
    }
  });

  pageObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
}

// Message handler with async support
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const asyncHandler = async () => {
    console.log('Message received in content script:', request);
    try {
      switch (request.action) {
        case 'scrollTo':
          await scrollTo(request.position);
          return { success: true };
        case 'getContent':
          return {
            content: await getPageContent(),
            metadata: await getPageMetadata()
          };
        case 'getPageDimensions':
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
            ),
            viewportHeight: window.innerHeight,
            scrollY: window.scrollY
          };
        case 'getHTML':
          return getHTML();
        case 'getText':
          return getText();
        case 'getReadableContent':
          // Ensure Readability is loaded before trying to use it
          await initReadability(); 
          return getReadableContent();
        case 'getCodeSnippets':
          return getCodeSnippets();
        default:
          throw new Error('Unknown action');
      }
    } catch (error) {
      console.error(`Error handling ${request.action}:`, error);
      throw error;
    }
  };

  asyncHandler()
    .then(result => sendResponse(result))
    .catch(error => {
      // Ensure a serializable error object is sent back
      sendResponse({ 
        error: { 
          message: error.message, 
          name: error.name, 
          stack: error.stack 
        } 
      });
    });

  return true;
});

// Initialize observers
setupMutationObserver();
console.log('Enhanced content script initialized with page monitoring');