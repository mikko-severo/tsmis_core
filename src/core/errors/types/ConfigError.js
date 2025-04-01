import { CoreError } from '../Error.js';

/**
 * Configuration related errors
 * @extends CoreError
 */
export class ConfigError extends CoreError {
  /**
   * Create a new ConfigError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`CONFIG_${code}`, message, details, options);
    this.statusCode = 500;
  }
}