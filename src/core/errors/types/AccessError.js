import { CoreError } from '../Error.js';

/**
 * Authorization and access control related errors
 * @extends CoreError
 */
export class AccessError extends CoreError {
  /**
   * Create a new AccessError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`ACCESS_${code}`, message, details, options);
    this.statusCode = 403;
  }
}