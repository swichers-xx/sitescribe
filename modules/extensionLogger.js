// Enhanced Extension Logger Module
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class ExtensionLogger {
  constructor(logLevel = LOG_LEVELS.INFO) {
    this.logLevel = logLevel;
  }

  _log(level, message, ...args) {
    if (level >= this.logLevel) {
      const timestamp = new Date().toISOString();
      const levelName = Object.keys(LOG_LEVELS)[level];
      console.log(`[${timestamp}] [${levelName}]`, message, ...args);
    }
  }

  debug(message, ...args) {
    this._log(LOG_LEVELS.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this._log(LOG_LEVELS.INFO, message, ...args);
  }

  warn(message, ...args) {
    this._log(LOG_LEVELS.WARN, message, ...args);
  }

  error(message, ...args) {
    this._log(LOG_LEVELS.ERROR, message, ...args);
  }
}

export const logger = new ExtensionLogger();
export default logger;
