// src/core/errors/types/EventError.js

import { CoreError } from '../Error.js';

/**
 * Event system related errors
 * @extends CoreError
 */
export class EventError extends CoreError {
  /**
   * Create a new EventError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`EVENT_${code}`, message, details, options);
    this.statusCode = 500;
  }
}