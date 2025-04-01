// src/core/errors/ErrorSystem.js

import { EventEmitter } from 'events';
import { CoreError } from './Error.js';
import { ErrorTypes } from './types/index.js';
import { FastifyIntegration } from './integrations/fastify/FastifyIntegration.js';

export class ErrorSystem extends EventEmitter {
  static dependencies = ['logger'];

  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.logger = deps.logger || console;
    this.integrations = new Map();
    this.handlers = new Map();
    this.errorTypes = new Map(Object.entries(ErrorTypes));
    this.initialized = false;

      // Ensure a default handler is always present
  this.registerHandler('*', this.defaultErrorHandler.bind(this));
  }

  async initialize() {
    if (this.initialized) {
      throw new Error('Already initialized');
    }

    // Register default handler
    this.registerHandler('*', this.defaultErrorHandler.bind(this));
    
    // Validate error types
    for (const [name, ErrorType] of this.errorTypes) {
      if (!(ErrorType.prototype instanceof CoreError)) {
        throw new CoreError('INVALID_ERROR_TYPE', `Error type ${name} must extend CoreError`);
      }
    }

    this.initialized = true;
    this.emit('initialized');
  }

  registerIntegration(framework, options = {}) {
    if (!framework) {
      throw new CoreError('INVALID_FRAMEWORK', 'Framework is required');
    }

    const integration = new FastifyIntegration();
    integration.initialize(framework, options);
    
    this.integrations.set(framework, integration);
    return integration;
  }

  registerHandler(errorType, handler) {
    if (typeof handler !== 'function') {
      throw new CoreError('INVALID_HANDLER', 'Handler must be a function');
    }
    this.handlers.set(errorType, handler);
  }

  async handleError(error, context = {}) {
    // Ensure we always have a handler
    const handler = this.handlers.get(error.constructor.name) || this.handlers.get('*') || this.defaultErrorHandler;
  
    try {
      await handler(error, context);
      this.emit('error:handled', { error, context });
    } catch (handlerError) {
      this.logger.error('Error handler failed:', handlerError);
      this.emit('error:handler:failed', { error: handlerError, originalError: error });
      throw handlerError;
    }
  }

// Ensure defaultErrorHandler is always a function
defaultErrorHandler(error, context = {}) {
  this.logger.error('Unhandled error:', {
    type: error.constructor.name,
    code: error.code,
    message: error.message,
    details: error.details,
    context
  });
}

  createError(type, code, message, details = {}, options = {}) {
    const ErrorType = this.errorTypes.get(type) || CoreError;
    return new ErrorType(code, message, details, options);
  }

  async shutdown() {
    if (!this.initialized) return;
    
    this.handlers.clear();
    this.integrations.clear();
    this.errorTypes.clear();
    this.removeAllListeners();
    this.initialized = false;
    this.emit('shutdown');
  }
}

// Factory function for container
export function createErrorSystem(deps) {
  return new ErrorSystem(deps);
}