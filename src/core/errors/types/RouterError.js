// src/core/errors/types/RouterError.js
import { CoreError } from '../Error.js';

/**
 * Router system related errors
 * @extends CoreError
 */
export class RouterError extends CoreError {
  /**
   * Create a new RouterError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`ROUTER_${code}`, message, details, options);
    this.statusCode = 500;
  }
}

export default RouterError;