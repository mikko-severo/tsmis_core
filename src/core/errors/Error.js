/**
 * Universal base error class for both client and server environments
 * @extends Error
 */
export class CoreError extends Error {
  /**
   * Create a new CoreError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(message);
    
    // Basic properties
    this.name = this.constructor.name;
    this.code = code;
    this.details = this.sanitizeDetails(details);
    this.timestamp = new Date().toISOString();

      //Debug line 29
      // console.log('Line 29 debug:', {
      //   hasOptions: options !== undefined,
      //   hasCause: options?.cause !== undefined,
      //   causeValue: options?.cause
      // });

    // Handle error cause
    this.initCause(options?.cause);
    
    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Format stack for browser environment
    if (this.isClientEnvironment()) {
      this.stack = this.formatStackTrace(this.stack);
    }
  }

  /**
   * Initialize error cause with proper error instance
   * @private
   */
  initCause(cause) {
    const ensureValidName = (error) => {
      // Reset to 'Error' if name is empty or only whitespace
      if (!error.name || !error.name.trim()) {
        error.name = 'Error';
      }
      return error;
    };
  
    if (cause instanceof Error) {
      this.cause = ensureValidName(cause);
    } else if (cause && typeof cause === 'object') {
      const error = new Error(cause.message || JSON.stringify(cause));
      if (cause.name && typeof cause.name === 'string' && cause.name.trim()) {
        error.name = cause.name;
      }
      this.cause = error;
    } else if (typeof cause === 'string') {
      this.cause = new Error(cause);
    }
  }

  /**
   * Sanitize error details for safe serialization
   * @private
   */
  sanitizeDetails(details) {
    try {
      // Test if details can be safely serialized
      JSON.stringify(details);
      return details;
    } catch (error) {
      // If serialization fails, return safe version
      return { 
        error: 'Details contained non-serializable values',
        safeDetails: String(details)
      };
    }
  }

  /**
   * Format stack trace for better readability
   * @private
   */
  formatStackTrace(stack) {
    if (!stack) return stack;
    
    return stack
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^ {4}at /, ''))
      .join('\n');
  }

  /**
   * Check if running in client environment
   * @private
   */
  isClientEnvironment() {
    return typeof window !== 'undefined';
  }

  /**
   * Check if running in development environment
   * @private
   */
  isDevEnvironment() {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    }
    return this.isClientEnvironment() && window.ENV === 'development';
  }

  /**
   * Convert error to JSON format
   */
  toJSON() {
    const json = {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  
    // Only include stack if it exists AND we're in dev
    if (this.isDevEnvironment() && this.stack) {
      json.stack = this.stack;
    }
  
    // Include cause if present
    if (this.cause) {
      json.cause = {
        message: this.cause.message,
        name: this.cause.name || 'Error'
      };
      
      // Only include cause stack if it exists AND we're in dev
      if (this.isDevEnvironment() && this.cause.stack) {
        json.cause.stack = this.cause.stack;
      }
    }
  
    return json;
  }

  /**
   * Create error instance from JSON data
   * @static
   */
  static fromJSON(data) {
    const options = {};
    
    if (data.cause) {
      if (typeof data.cause === 'string') {
        options.cause = data.cause;
      } else {
        options.cause = {
          message: data.cause.message,
          name: data.cause.name
        };
      }
    }

    return new this(
      data.code,
      data.message,
      data.details || {},
      options
    );
  }
}