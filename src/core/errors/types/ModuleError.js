import { CoreError } from '../Error.js';

/**
 * Module system related errors
 * @extends CoreError
 */
export class ModuleError extends CoreError {
  /**
   * Create a new ModuleError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`MODULE_${code}`, message, details, options);
    this.statusCode = 500;
  }
}