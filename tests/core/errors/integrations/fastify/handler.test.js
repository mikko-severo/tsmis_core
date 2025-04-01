// tests/core/errors/integrations/fastify/handler.test.js

import { FastifyErrorHandler } from '../../../../../src/core/errors/integrations/fastify/handler.js';
import { CoreError } from '../../../../../src/core/errors/Error.js';

describe('Fastify Error Handler', () => {
  let handler;
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
    handler = new FastifyErrorHandler();
    
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

  describe('Setup', () => {
    test('should handle early return if already initialized', () => {
      handler.initialized = true;
      handler.initialize(mockFastify);
      expect(mockFastify.addHook.mock.calls.length).toBe(0);
    });

    test('should set up request hook and error handler', () => {
      handler.initialize(mockFastify);
      expect(mockFastify.addHook.mock.calls.length).toBe(1);
      expect(mockFastify.setErrorHandler.mock.calls.length).toBe(1);
    });

    test('should handle invalid fastify instance', () => {
      expect(() => handler.initialize({})).toThrow('Invalid fastify instance');
    });
  });

  describe('Error Handling', () => {

    test('should handle undefined error properties in mapError', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const undefinedError = undefined;
      await errorHandler(undefinedError, mockRequest, mockReply);
      
      expect(mockReply.status.mock.calls[0][0]).toBe(500);
      expect(mockReply.send.mock.calls[0][0].code).toBe('UNKNOWN_ERROR');
    });

    test('should handle validation errors', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const validationError = {
        validation: [{ message: 'Invalid input' }],
        statusCode: 400
      };
      
      await errorHandler(validationError, mockRequest, mockReply);
      
      expect(mockReply.status.mock.calls[0][0]).toBe(400);
      expect(mockReply.send.mock.calls[0][0].code).toBe('VALIDATION_FAILED');
    });

    test('should handle 404 errors', async () => {
      handler.initialize(mockFastify);
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

    test('should handle generic errors in development mode', async () => {
      process.env.NODE_ENV = 'development';
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const genericError = new Error('Generic error');
      await errorHandler(genericError, mockRequest, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.details.originalError).toBeDefined();
    });

    test('should handle errors with undefined context', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      await errorHandler(new Error(), undefined, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.context.url).toBe('');
      expect(response.context.method).toBe('');
    });

    test('should handle all error serialization paths', () => {
      const serialized = handler.serializeError(undefined);
      expect(serialized.code).toBe('UNKNOWN_ERROR');
      expect(serialized.message).toBe('Unknown error occurred');
      
      const withContext = handler.serializeError(new Error(), null);
      expect(withContext.context).toEqual({});
    });
    test('should handle missing reply methods', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const invalidReply = {};
      await expect(errorHandler(new Error(), mockRequest, invalidReply))
        .rejects.toThrow('Invalid reply object');
    });

    test('should handle null request', async () => {
      handler.initialize(mockFastify);
      const hookFn = mockFastify.addHook.mock.calls[0][1];
      await hookFn(null);
      expect(true).toBe(true); // Should not throw
    });

    test('should handle CoreError instances', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      const error = new CoreError('TEST', 'Test error');
      await errorHandler(error, mockRequest, mockReply);
      
      expect(mockReply.send.mock.calls[0][0].code).toBe('TEST');
    });
  });
  describe('Edge Cases', () => {
    test('should handle request hook with undefined values', async () => {
      handler.initialize(mockFastify);
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

    test('should handle validation error without statusCode', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      // Test line 68: validation error without statusCode
      const validationError = {
        validation: [{ message: 'Invalid input' }]
        // statusCode intentionally omitted
      };
      
      await errorHandler(validationError, mockRequest, mockReply);
      expect(mockReply.status.mock.calls[0][0]).toBe(400); // Default validation error status
    });

    test('should handle 404 error without method and url', async () => {
      handler.initialize(mockFastify);
      const errorHandler = mockFastify.setErrorHandler.mock.calls[0][0];
      
      // Test line 75: 404 error without method and url
      const notFoundError = {
        statusCode: 404
        // method and url intentionally omitted
      };
      
      await errorHandler(notFoundError, mockRequest, mockReply);
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response.message).toBe('Route : not found'); // Empty method/url handling
      expect(mockReply.status.mock.calls[0][0]).toBe(404);
    });
  });

  describe('Singleton Instance', () => {
    test('should properly set up error handler through setupErrorHandler', async () => {
      const { setupErrorHandler } = await import('../../../../../src/core/errors/integrations/fastify/handler.js');
      
      const result = setupErrorHandler(mockFastify);
      expect(result.initialized).toBe(true);
    });
  });
});