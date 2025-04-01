import { CoreError } from '../Error.js';

/**
 * Service related errors
 * @extends CoreError
 */
export class ServiceError extends CoreError {
  /**
   * Create a new ServiceError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`SERVICE_${code}`, message, details, options);
    this.statusCode = 503;
  }
}