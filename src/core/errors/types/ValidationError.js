import { CoreError } from '../Error.js';

/**
 * Validation related errors
 * @extends CoreError
 */
export class ValidationError extends CoreError {
  /**
   * Create a new ValidationError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details with validation errors
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`VALIDATION_${code}`, message, details, options);
    this.statusCode = 400;
    this.validationErrors = this.validationErrors = Array.isArray(details.validationErrors) ? details.validationErrors : [];
  }

  /**
   * Convert to JSON format with validation errors
   */
  toJSON() {
    const json = super.toJSON();
    json.validationErrors = this.validationErrors;
    return json;
  }

  /**
   * Create from JSON with validation errors
   * @param {Object} data - JSON data
   */
  static fromJSON(data) {
    const error = super.fromJSON(data);
    error.validationErrors = Array.isArray(data.validationErrors) ? data.validationErrors : [];
    return error;
  }
}