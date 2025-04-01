// src/core/errors/integrations/fastify/handler.js

import { IFrameworkIntegration } from '../IFrameworkIntegration.js';
import { CoreError, ErrorCodes } from '../../index.js';
import { ValidationError, NetworkError } from '../../types/index.js';

class FastifyErrorHandler extends IFrameworkIntegration {
  constructor() {
    super();
    this.initialized = false;
  }

  initialize(fastify, options = {}) {
    if (this.initialized) {
      return this;
    }

    if (!fastify || typeof fastify.addHook !== 'function') {
      throw new Error('Invalid fastify instance');
    }

    fastify.addHook('onRequest', async (request) => {
      if (!request) return;

      request.errorContext = {
        url: request?.url || '',
        method: request?.method || '',
        id: request?.id
      };
    });

    fastify.setErrorHandler(async (error, request, reply) => {
      if (!reply || typeof reply.status !== 'function') {
        throw new Error('Invalid reply object');
      }

      const errorContext = {
        requestId: request?.id,
        timestamp: new Date().toISOString(),
        url: request?.url || '',
        method: request?.method || ''
      };

      const mappedError = this.mapError(error);
      const serializedError = this.serializeError(mappedError, errorContext);

      reply.status(mappedError.statusCode || 500);
      return reply.send(serializedError);
    });

    this.initialized = true;
    return this;
  }

  mapError(error) {
    if (error instanceof CoreError) {
      return error;
    }

    if (error?.validation) {
      const validationError = new ValidationError(
        'FAILED',
        'Request validation failed',
        {
          validationErrors: error.validation
        }
      );
      validationError.statusCode = error.statusCode || 400;
      return validationError;
    }

    if (error?.statusCode === 404) {
      const notFoundError = new NetworkError(
        'ROUTE_NOT_FOUND',
        `Route ${error.method || ''}:${error.url || ''} not found`
      );
      notFoundError.statusCode = 404;
      return notFoundError;
    }

    const genericError = new CoreError(
      ErrorCodes.CORE.UNKNOWN,
      error?.message || 'An unexpected error occurred',
      {
        originalError: process.env.NODE_ENV === 'development' ? error : undefined
      }
    );

    genericError.statusCode = error?.statusCode || 500;
    return genericError;
  }

  serializeError(error, context = {}) {
    const safeContext = context || {};

    if (error instanceof CoreError) {
      const serialized = error.toJSON();
      return {
        ...serialized,
        context: safeContext
      };
    }

    return {
      code: ErrorCodes.CORE.UNKNOWN,
      message: error?.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      context: safeContext
    };
  }
}

// Create singleton instance
const fastifyErrorHandler = new FastifyErrorHandler();

export function setupErrorHandler(fastify, options = {}) {
  return fastifyErrorHandler.initialize(fastify, options);
}

export { fastifyErrorHandler, FastifyErrorHandler };