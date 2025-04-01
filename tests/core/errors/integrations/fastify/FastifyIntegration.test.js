// tests/core/errors/integrations/fastify/FastifyIntegration.test.js

import { FastifyIntegration } from '../../../../../src/core/errors/integrations/fastify/FastifyIntegration.js';
import { CoreError, ValidationError, NetworkError } from '../../../../../src/core/errors/index.js';
import { ErrorCodes } from '../../../../../src/core/errors/index.js';

describe('FastifyIntegration', () => {
  let integration;
  let mockFastify;
  let mockRequest;
  let mockReply;

  function createMockFn() {
    const fn = (...args) => {
      fn.mock.calls.push(args);
      return fn.mockReturnValue;
    };
    fn.mock = { calls: [] };
    fn.mockReturnValue = fn;
    fn.mockReturnThis = () => {
      fn.mockReturnValue = mockReply;
      return fn;
    };
    fn.mockClear = () => {
      fn.mock.calls = [];
    };
    return fn;
  }

  beforeEach(() => {
    integration = new FastifyIntegration();
    
    mockRequest = {
      url: '/test',
      method: 'GET'
    };

    mockReply = {
      status: createMockFn(),
      send: createMockFn()
    };
    mockReply.status.mockReturnValue = mockReply;
    mockReply.send.mockReturnValue = mockReply;

    mockFastify = {
      addHook: createMockFn(),
      setErrorHandler: createMockFn()
    };
  });

  describe('initialize', () => {
    test('should handle early return if already initialized', () => {
      integration.initialized = true;
      integration.initialize(mockFastify);
      expect(mockFastify.addHook.mock.calls.length).toBe(0);
    });

    test('should set up request hook and error handler', () => {
      integration.initialize(mockFastify);
      expect(mockFastify.addHook.mock.calls.length).toBe(1);
      expect(mockFastify.setErrorHandler.mock.calls.length).toBe(1);
    });

    test('should handle undefined request properties in hook', async () => {
      integration.initialize(mockFastify);
      const hookFn = mockFastify.addHook.mock.calls[0][1];
      
      const undefinedRequest = {
        url: undefined,
        method: undefined,
        id: undefined
      };
      
      await hookFn(undefinedRequest);
      expect(undefinedRequest.errorContext).toBeDefined();
      expect(undefinedRequest.errorContext.url).toBe('');
      expect(undefinedRequest.errorContext.method).toBe('');
    });

    test('should handle null request in hook', async () => {
      integration.initialize(mockFastify);
      const hookFn = mockFastify.addHook.mock.calls[0][1];
      await hookFn(null);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle undefined error properties in mapError', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const undefinedError = undefined;
      await errorHandler(undefinedError, mockRequest, mockReply);
      
      expect(mockReply.status.mock.calls[0][0]).toBe(500);
      expect(mockReply.send.mock.calls[0][0].code).toBe('UNKNOWN_ERROR');
    });

    test('should handle validation errors', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const validationError = {
        validation: [{ message: 'Invalid input' }],
        statusCode: 400
      };
      
      await errorHandler(validationError, mockRequest, mockReply);
      
      expect(mockReply.status.mock.calls[0][0]).toBe(400);
      expect(mockReply.send.mock.calls[0][0].code).toBe('VALIDATION_FAILED');
    });

    test('should handle validation error without statusCode', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const validationError = {
        validation: [{ message: 'Invalid input' }]
      };
      
      await errorHandler(validationError, mockRequest, mockReply);
      expect(mockReply.status.mock.calls[0][0]).toBe(400);
    });

    test('should handle 404 errors', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const notFoundError = {
        statusCode: 404,
        method: 'GET',
        url: '/not-found'
      };
      
      await errorHandler(notFoundError, mockRequest, mockReply);
      
      expect(mockReply.status.mock.calls[0][0]).toBe(404);
      expect(mockReply.send.mock.calls[0][0].code).toBe('NETWORK_ROUTE_NOT_FOUND');
    });

    test('should handle 404 error without method and url', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const notFoundError = {
        statusCode: 404
      };
      
      await errorHandler(notFoundError, mockRequest, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.message).toBe('Route : not found');
      expect(mockReply.status.mock.calls[0][0]).toBe(404);
    });

    test('should handle standard errors', async () => {
      process.env.NODE_ENV = 'development';
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const standardError = new Error('Standard error');
      await errorHandler(standardError, mockRequest, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.details.originalError).toBeDefined();
    });

    test('should handle errors with undefined context', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      await errorHandler(new Error(), undefined, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.context.url).toBe('');
      expect(response.context.method).toBe('');
    });
  });

  describe('error serialization', () => {
    test('should handle CoreError instances', async () => {
      integration.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const error = new CoreError('TEST', 'Test error');
      await errorHandler(error, mockRequest, mockReply);
      
      expect(mockReply.send.mock.calls[0][0].code).toBe('TEST');
    });

    test('should handle all error serialization paths', () => {
      const serialized = integration.serializeError(undefined);
      expect(serialized.code).toBe('UNKNOWN_ERROR');
      expect(serialized.message).toBe('Unknown error occurred');
      
      const withContext = integration.serializeError(new Error(), null);
      expect(withContext.context).toEqual({});
    });
  });
});