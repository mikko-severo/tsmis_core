import {
    ConfigError,
    ModuleError,
    ServiceError,
    ValidationError,
    NetworkError,
    AuthError,
    AccessError
  } from '../../../src/core/errors/types';
  
  import { createErrorFromResponse, ErrorCodes } from '../../../src/core/errors/index.js';
  import { CoreError } from '../../../src/core/errors/Error.js';

  describe('Error Types', () => {
    describe("Error Factory Function", () => {
      it('should fallback to CoreError when an unknown error type is encountered', () => {
        const unknownErrorData = { name: "UnknownError", code: "UNKNOWN_CODE", message: "Unknown error" };
        const error = createErrorFromResponse(unknownErrorData);
        expect(error).toBeInstanceOf(CoreError);
        expect(error.code).toBe("UNKNOWN_CODE");
      });
    
      it('should fallback to CoreError when errorData.name is undefined', () => {
        const unknownErrorData = { code: "UNKNOWN_CODE", message: "Unknown error" };
        const error = createErrorFromResponse(unknownErrorData);
        expect(error).toBeInstanceOf(CoreError);
      });
    });
    
    describe('ConfigError', () => {
      it('should create ConfigError with correct properties', () => {
        const error = new ConfigError('INVALID_CONFIG', 'Invalid configuration', { key: 'test' });
        expect(error.name).toBe('ConfigError');
        expect(error.code).toBe('CONFIG_INVALID_CONFIG');
        expect(error.statusCode).toBe(500);
      });
    });
  
    describe('ModuleError', () => {
      it('should create ModuleError with correct properties', () => {
        const error = new ModuleError('INIT_FAILED', 'Module initialization failed', { module: 'test' });
        expect(error.name).toBe('ModuleError');
        expect(error.code).toBe('MODULE_INIT_FAILED');
        expect(error.statusCode).toBe(500);
      });
    });
  
    describe('ServiceError', () => {
      it('should create ServiceError with correct properties', () => {
        const error = new ServiceError('SERVICE_DOWN', 'Service unavailable', { service: 'test' });
        expect(error.name).toBe('ServiceError');
        expect(error.code).toBe('SERVICE_SERVICE_DOWN');
        expect(error.statusCode).toBe(503);
      });
  
      it('should handle error cause properly', () => {
        const cause = new Error('Original error');
        const error = new ServiceError('TEST', 'Test error', {}, { cause });
        expect(error.cause).toBe(cause);
      });
    });
  
    describe('ValidationError', () => {
      it('should create ValidationError with correct properties', () => {
        const error = new ValidationError('INVALID_INPUT', 'Invalid input data', {
          validationErrors: [{ field: 'test', message: 'Required' }]
        });
        expect(error.name).toBe('ValidationError');
        expect(error.code).toBe('VALIDATION_INVALID_INPUT');
        expect(error.statusCode).toBe(400);
        expect(error.validationErrors).toHaveLength(1);
      });

      it('should fallback to an empty array when validationErrors is not an array', () => {
        const err1 = new ValidationError("INVALID_INPUT", "Invalid input", { validationErrors: "not an array" });
        expect(err1.validationErrors).toEqual([]);
    
        const err2 = new ValidationError("INVALID_INPUT", "Invalid input", { validationErrors: 42 });
        expect(err2.validationErrors).toEqual([]);
    
        const err3 = new ValidationError("INVALID_INPUT", "Invalid input", { validationErrors: {} });
        expect(err3.validationErrors).toEqual([]);
    
        const err4 = new ValidationError("INVALID_INPUT", "Invalid input", {});
        expect(err4.validationErrors).toEqual([]);
      });
    });
  
    describe('NetworkError', () => {
      it('should create NetworkError with correct properties', () => {
        const error = new NetworkError('REQUEST_FAILED', 'Network request failed', { 
          url: 'http://test.com',
          statusCode: 404 
        });
        expect(error.name).toBe('NetworkError');
        expect(error.code).toBe('NETWORK_REQUEST_FAILED');
        expect(error.statusCode).toBe(404);
      });
  
      it('should use default status code if not provided', () => {
        const error = new NetworkError('REQUEST_FAILED', 'Network request failed');
        expect(error.statusCode).toBe(503);
      });
    });
  
    describe('AuthError', () => {
      it('should create AuthError with correct properties', () => {
        const error = new AuthError('INVALID_TOKEN', 'Invalid authentication token');
        expect(error.name).toBe('AuthError');
        expect(error.code).toBe('AUTH_INVALID_TOKEN');
        expect(error.statusCode).toBe(401);
      });
    });
  
    describe('AccessError', () => {
      it('should create AccessError with correct properties', () => {
        const error = new AccessError('FORBIDDEN', 'Access denied', { resource: 'test' });
        expect(error.name).toBe('AccessError');
        expect(error.code).toBe('ACCESS_FORBIDDEN');
        expect(error.statusCode).toBe(403);
      });
    });
  });
  describe('Error Cause Edge Cases', () => {
    test('should handle error cause with empty name', () => {
        const causeError = new Error('test message');
        causeError.name = '';  // Empty name
        
        const error = new CoreError('TEST', 'message', {}, { cause: causeError });
        expect(error.cause.name).toBe('Error');
    });

    test('should handle error cause with whitespace name', () => {
        const causeError = new Error('test message');
        causeError.name = '   ';  // Whitespace name
        
        const error = new CoreError('TEST', 'message', {}, { cause: causeError });
        expect(error.cause.name).toBe('Error');
    });

    test('should handle error cause with null name', () => {
        const causeError = new Error('test message');
        causeError.name = null;  // Null name
        
        const error = new CoreError('TEST', 'message', {}, { cause: causeError });
        expect(error.cause.name).toBe('Error');
    });

    test('should handle error cause with undefined name', () => {
        const causeError = new Error('test message');
        causeError.name = undefined;  // Undefined name
        
        const error = new CoreError('TEST', 'message', {}, { cause: causeError });
        expect(error.cause.name).toBe('Error');
    });
  });
  // tests/core/errors/integration.test.js

describe('Error Response Creation', () => {
  // ... previous tests ...

  test('should use errorData code with empty message', () => {
      const response = {
          data: {
              code: 'CUSTOM_ERROR',
          }
      };
      const error = createErrorFromResponse(response);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('Unknown error occurred');
  });

  test('should use default code with custom message', () => {
      const response = {
          data: {
              message: 'Custom message only'
          }
      };
      const error = createErrorFromResponse(response);
      expect(error.code).toBe(ErrorCodes.CORE.UNKNOWN);
      expect(error.message).toBe('Custom message only');
  });

  test('should handle undefined error data properties', () => {
      const response = {
          data: {
              code: undefined,
              message: undefined
          }
      };
      const error = createErrorFromResponse(response);
      expect(error.code).toBe(ErrorCodes.CORE.UNKNOWN);
      expect(error.message).toBe('Unknown error occurred');
  });

  test('should handle non-object error data', () => {
      const response = {
          data: 'string data'
      };
      const error = createErrorFromResponse(response);
      expect(error.code).toBe(ErrorCodes.CORE.UNKNOWN);
      expect(error.message).toBe('Unknown error occurred');
  });
});