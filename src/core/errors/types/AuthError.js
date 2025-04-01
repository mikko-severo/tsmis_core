import { CoreError } from '../Error.js';

/**
 * Authentication related errors
 * @extends CoreError
 */
export class AuthError extends CoreError {
  /**
   * Create a new AuthError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`AUTH_${code}`, message, details, options);
    this.statusCode = 401;
  }
}