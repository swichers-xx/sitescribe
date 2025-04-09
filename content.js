(function() {
  // Defensive wrapper to ensure chrome.runtime exists
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome runtime not available');
    return;
  }

  // Robust Content Script Communication Module
  const ContentScriptCommunication = {
    // Safe message listener setup
    setupPingHandler() {
      try {
        // Defensive check for onMessage
        if (!chrome.runtime || !chrome.runtime.onMessage) {
          console.error('chrome.runtime.onMessage is undefined');
          return;
        }

        // Wrap message listener with error handling
        const messageHandler = (request, sender, sendResponse) => {
          try {
            console.log('📨 Content Script Received Message:', request);
            
            switch(request.action) {
              case 'ping':
                console.log('🏓 Ping received, responding with pong');
                sendResponse('pong');
                return true;
              
              case 'getPageDimensions':
                try {
                  const dimensions = this.getPageDimensions();
                  sendResponse(dimensions);
                } catch (error) {
                  console.error('❌ Page Dimensions Error:', error);
                  sendResponse({ error: error.message });
                }
                return true;
              
              case 'getHTML':
                try {
                  const html = this.getCleanHTML();
                  sendResponse(html);
                } catch (error) {
                  console.error('❌ HTML Capture Error:', error);
                  sendResponse({ error: error.message });
                }
                return true;
              
              default:
                console.warn('❓ Unhandled message action:', request.action);
                sendResponse({ error: 'Unhandled action' });
                return false;
            }
          } catch (handlerError) {
            console.error('🌍 Message Handler Global Error:', handlerError);
            sendResponse({ error: 'Unexpected error in message handling' });
            return false;
          }
        };

        // Add message listener with fallback
        chrome.runtime.onMessage.addListener(messageHandler);
      } catch (setupError) {
        console.error('🚨 Message Listener Setup Error:', setupError);
      }
    },

    // Periodic status reporting
    setupStatusReporting() {
      function reportStatus() {
        try {
          if (!chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Cannot send status message');
            return;
          }

          chrome.runtime.sendMessage({
            action: 'logContentScriptStatus',
            status: 'active',
            url: window.location.href,
            timestamp: new Date().toISOString()
          }, response => {
            if (chrome.runtime.lastError) {
              console.error('Status report failed:', chrome.runtime.lastError);
            }
          });
        } catch (error) {
          console.error('Failed to report status:', error);
        }
      }

      // Report immediately and then every 30 seconds
      reportStatus();
      setInterval(reportStatus, 30000);
    },

    // Page Dimensions Calculation
    getPageDimensions() {
      return {
        width: Math.max(
          document.body.scrollWidth, 
          document.documentElement.scrollWidth,
          document.body.offsetWidth, 
          document.documentElement.offsetWidth,
          document.body.clientWidth, 
          document.documentElement.clientWidth
        ),
        height: Math.max(
          document.body.scrollHeight, 
          document.documentElement.scrollHeight,
          document.body.offsetHeight, 
          document.documentElement.offsetHeight,
          document.body.clientHeight, 
          document.documentElement.clientHeight
        ),
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY
      };
    },

    // Clean HTML Extraction
    getCleanHTML() {
      const clone = document.documentElement.cloneNode(true);
      
      // Remove potentially problematic elements
      const elementsToRemove = clone.querySelectorAll(
        'script, style, link[rel="stylesheet"], meta[http-equiv], meta[name="viewport"]'
      );
      elementsToRemove.forEach(el => el.remove());
      
      return clone.outerHTML;
    },

    // Initialize Communication
    init() {
      // Global flag to indicate content script is loaded
      window.contentScriptInjected = true;
      
      // Set up communication handlers with error handling
      try {
        this.setupPingHandler();
        this.setupStatusReporting();
      } catch (initError) {
        console.error('🚨 Content Script Initialization Error:', initError);
      }
      
      console.log('✨ Content Script Initialized and Ready');
    }
  };

  // Global Error Handling
  window.addEventListener('error', (event) => {
    console.error('🚨 Unhandled Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });

  // Initialize when DOM is fully loaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContentScriptCommunication.init());
  } else {
    ContentScriptCommunication.init();
  }
})();