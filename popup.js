// Import diagnostics module
import { runDiagnostics } from './modules/debugDiagnostics.js';

// Popup functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize UI elements
  initializeUI();
  
  // Load saved settings
  loadSettings();
  
  // Load dynamic content based on permissions
  loadDynamicContent();
  
  // Add event listeners
  addEventListeners();
  
  // Add debug diagnostics button
  const debugButton = document.getElementById('debugDiagnosticsBtn');
  if (debugButton) {
    debugButton.addEventListener('click', async () => {
      try {
        const diagnostics = await runDiagnostics();
        console.log(' SiteScribe Diagnostics:', diagnostics);
        
        // Optional: Display diagnostics in popup
        const diagnosticOutput = document.getElementById('diagnosticOutput');
        if (diagnosticOutput) {
          diagnosticOutput.textContent = JSON.stringify(diagnostics, null, 2);
        }
      } catch (error) {
        console.error(' Diagnostic Error:', error);
      }
    });
  }
});

function initializeUI() {
  // Initialize any UI components that need setup
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function loadSettings() {
  // Load saved settings from storage
  chrome.storage.sync.get(null, (data) => {
    // Update toggle states
    const contextMenuToggle = document.getElementById('contextMenuToggle');
    if (contextMenuToggle) {
      contextMenuToggle.checked = data.contextMenuEnabled ?? true;
    }

    const notificationsToggle = document.getElementById('notificationsToggle');
    if (notificationsToggle) {
      notificationsToggle.checked = data.notificationsEnabled ?? true;
    }
  });
}

function loadDynamicContent() {
  // Load tabs if permission exists
  const tabsList = document.getElementById('tabsList');
  if (tabsList) {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      tabsList.innerHTML = tabs.map(tab => `
        <div class="list-item">
          <img src="${tab.favIconUrl || 'icon128.png'}" alt="Tab icon">
          <span>${tab.title}</span>
        </div>
      `).join('');
    });
  }

  // Load history if permission exists
  const historyList = document.getElementById('historyList');
  if (historyList) {
    chrome.history.search({ text: '', maxResults: 5 }, (results) => {
      historyList.innerHTML = results.map(item => `
        <div class="list-item">
          <span>${item.title}</span>
        </div>
      `).join('');
    });
  }

  // Load bookmarks if permission exists
  const bookmarksList = document.getElementById('bookmarksList');
  if (bookmarksList) {
    chrome.bookmarks.getRecent(5, (bookmarks) => {
      bookmarksList.innerHTML = bookmarks.map(bookmark => `
        <div class="list-item">
          <span>${bookmark.title}</span>
        </div>
      `).join('');
    });
  }
}

function addEventListeners() {
  // Add listeners for toggles and buttons
  const contextMenuToggle = document.getElementById('contextMenuToggle');
  if (contextMenuToggle) {
    contextMenuToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({ contextMenuEnabled: e.target.checked });
      chrome.runtime.sendMessage({ 
        action: 'updateContextMenu',
        enabled: e.target.checked 
      });
    });
  }

  const notificationsToggle = document.getElementById('notificationsToggle');
  if (notificationsToggle) {
    notificationsToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({ notificationsEnabled: e.target.checked });
    });
  }

  const refreshData = document.getElementById('refreshData');
  if (refreshData) {
    refreshData.addEventListener('click', () => {
      loadDynamicContent();
    });
  }

  const openOptions = document.getElementById('openOptions');
  if (openOptions) {
    openOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  const shortcutsBtn = document.getElementById('shortcutsBtn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
}