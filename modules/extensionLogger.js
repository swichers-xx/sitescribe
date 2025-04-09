// Comprehensive Extension Logging Utility

class ExtensionLogger {
  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  constructor(logLevel = ExtensionLogger.LOG_LEVELS.INFO) {
    this.logLevel = logLevel;
    this.logHistory = [];
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { 
      timestamp, 
      level, 
      message, 
      data 
    };

    // Console logging
    switch(level) {
      case ExtensionLogger.LOG_LEVELS.DEBUG:
        console.debug(`🔍 [${timestamp}] ${message}`, data);
        break;
      case ExtensionLogger.LOG_LEVELS.INFO:
        console.log(`ℹ️ [${timestamp}] ${message}`, data);
        break;
      case ExtensionLogger.LOG_LEVELS.WARN:
        console.warn(`⚠️ [${timestamp}] ${message}`, data);
        break;
      case ExtensionLogger.LOG_LEVELS.ERROR:
        console.error(`❌ [${timestamp}] ${message}`, data);
        break;
    }

    // Store in history
    this.logHistory.push(logEntry);

    // Optional: Persist logs to storage
    this._persistLogs();
  }

  debug(message, data = null) {
    if (this.logLevel <= ExtensionLogger.LOG_LEVELS.DEBUG) {
      this._log(ExtensionLogger.LOG_LEVELS.DEBUG, message, data);
    }
  }

  info(message, data = null) {
    if (this.logLevel <= ExtensionLogger.LOG_LEVELS.INFO) {
      this._log(ExtensionLogger.LOG_LEVELS.INFO, message, data);
    }
  }

  warn(message, data = null) {
    if (this.logLevel <= ExtensionLogger.LOG_LEVELS.WARN) {
      this._log(ExtensionLogger.LOG_LEVELS.WARN, message, data);
    }
  }

  error(message, data = null) {
    if (this.logLevel <= ExtensionLogger.LOG_LEVELS.ERROR) {
      this._log(ExtensionLogger.LOG_LEVELS.ERROR, message, data);
    }
  }

  _persistLogs() {
    // Limit log history to last 100 entries
    if (this.logHistory.length > 100) {
      this.logHistory.shift();
    }

    // Optional: Save to chrome storage
    try {
      chrome.storage.local.set({ 
        extensionLogs: this.logHistory.slice(-50) 
      });
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  // Retrieve stored logs
  static async retrieveLogs() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get('extensionLogs', (result) => {
          resolve(result.extensionLogs || []);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Clear logs
  clearLogs() {
    this.logHistory = [];
    chrome.storage.local.remove('extensionLogs');
  }
}

// Create a global logger instance
const logger = new ExtensionLogger();

module.exports = { ExtensionLogger, logger };
