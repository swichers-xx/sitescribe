// Default settings
const DEFAULT_SETTINGS = {
  // Language Detection
  enableLanguageDetection: true,
  minCodeLength: 10,
  detectionConfidence: 'medium',
  preferExplicitLanguage: true,
  
  // Script & Network Capture
  captureScripts: true,
  captureNetworkRequests: true,
  maxNetworkRequests: 100,
  
  // LLM Integration
  llmEnabled: false,
  llmEndpoint: 'https://api.openai.com/v1/chat/completions',
  llmApiKey: '',
  llmModel: 'gpt-3.5-turbo',
  customModel: '',
  llmPrompt: 'Summarize the main points of this content:',
  llmMaxTokens: 500,
  llmTemperature: 0.7
};

// Initialize UI
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  setupEventListeners();
});

function setupEventListeners() {
  // Model selection handling
  const modelSelect = document.getElementById('llmModel');
  const customModelInput = document.getElementById('customModel');
  
  modelSelect?.addEventListener('change', () => {
    customModelInput.style.display = 
      modelSelect.value === 'custom' ? 'block' : 'none';
  });

  // Temperature slider
  const temperatureSlider = document.getElementById('llmTemperature');
  const temperatureValue = document.getElementById('temperatureValue');
  
  temperatureSlider?.addEventListener('input', () => {
    const value = temperatureSlider.value / 100;
    temperatureValue.textContent = value.toFixed(2);
  });

  // Save settings
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  
  // Reset settings
  document.getElementById('resetSettings')?.addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
        loadSettings();
        showMessage('Settings reset to defaults');
      });
    }
  });

  // Configure shortcuts
  const shortcutsBtn = document.getElementById('configureShortcuts');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // Export data
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  // Import data
  const importBtn = document.getElementById('importData');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importData);
  }

  // Clear data
  const clearBtn = document.getElementById('clearData');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearData);
  }
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (!element) return;

      if (element.type === 'checkbox') {
        element.checked = value;
      } else if (element.type === 'range') {
        element.value = value * 100;
        document.getElementById('temperatureValue').textContent = value.toFixed(2);
      } else {
        element.value = value;
      }
    });

    // Handle custom model visibility
    const modelSelect = document.getElementById('llmModel');
    const customModelInput = document.getElementById('customModel');
    if (modelSelect && customModelInput) {
      customModelInput.style.display = 
        modelSelect.value === 'custom' ? 'block' : 'none';
    }
  });
}

function saveSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  
  // Collect form values
  Object.keys(settings).forEach(key => {
    const element = document.getElementById(key);
    if (!element) return;

    if (element.type === 'checkbox') {
      settings[key] = element.checked;
    } else if (element.type === 'range') {
      settings[key] = element.value / 100;
    } else {
      settings[key] = element.value;
    }
  });

  // Handle custom model
  if (settings.llmModel === 'custom') {
    settings.llmModel = settings.customModel;
  }

  // Validate settings
  if (settings.llmEnabled) {
    if (!settings.llmEndpoint) {
      showMessage('LLM endpoint is required when LLM is enabled', 'error');
      return;
    }
    if (!settings.llmApiKey) {
      showMessage('API key is required when LLM is enabled', 'error');
      return;
    }
  }

  // Save to storage
  chrome.storage.sync.set(settings, () => {
    showMessage('Settings saved successfully');
  });
}

function exportData() {
  chrome.storage.sync.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extension-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importData(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        chrome.storage.sync.set(settings, () => {
          loadSettings();
          showMessage('Settings imported successfully!');
        });
      } catch (error) {
        showMessage('Error importing settings: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  }
}

function clearData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    chrome.storage.sync.clear(() => {
      showMessage('All data cleared successfully');
      loadSettings();
    });
  }
}

function showMessage(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}