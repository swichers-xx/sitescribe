(function() {
  // Robust Content Script Communication Module
  const ContentScriptCommunication = {
    // Ping handler to verify script is loaded
    setupPingHandler() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        }
        
        return false;
      });
    },

    // Periodic status reporting
    setupStatusReporting() {
      function reportStatus() {
        try {
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

    // Scroll Handling
    scrollTo(position) {
      return new Promise((resolve, reject) => {
        try {
          window.scrollTo({
            top: position,
            behavior: 'smooth'
          });
          setTimeout(resolve, 200); // Allow time for scroll animation
        } catch (error) {
          reject(error);
        }
      });
    },

    // Initialize Communication
    init() {
      // Global flag to indicate content script is loaded
      window.contentScriptInjected = true;
      
      // Set up communication handlers
      this.setupPingHandler();
      this.setupStatusReporting();
      
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

  // Initialize when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContentScriptCommunication.init());
  } else {
    ContentScriptCommunication.init();
  }
})();