import { CoreError } from '../Error.js';

/**
 * Network related errors
 * @extends CoreError
 */
export class NetworkError extends CoreError {
  /**
   * Create a new NetworkError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`NETWORK_${code}`, message, details, options);
    // Use provided status code or default to 503
    this.statusCode = details.statusCode || 503;
  }
}