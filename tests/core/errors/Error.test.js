import { CoreError } from '../../../src/core/errors/Error.js';

describe('CoreError', () => {
  const originalEnv = process.env.NODE_ENV;
  
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should fallback to "Error" when cause.name is undefined', () => {
    const err = new CoreError("TEST_CODE", "Test message", {}, { cause: {} });
    expect(err.toJSON().cause.name).toBe("Error");
  });

  it('should store the correct cause name when provided', () => {
    const cause = new Error("Underlying issue");
    const err = new CoreError("TEST_CODE", "Test message", {}, { cause });
    expect(err.toJSON().cause.name).toBe("Error");
  });

  it('should store the correct cause name when cause has a custom name', () => {
    const cause = new Error("Underlying issue");
    cause.name = "CustomError";
    const err = new CoreError("TEST_CODE", "Test message", {}, { cause });
    expect(err.toJSON().cause.name).toBe("CustomError");
  });

  describe('Stack Trace Handling', () => {
    test('should handle environment without captureStackTrace', () => {
        const originalCaptureStackTrace = Error.captureStackTrace;
        Error.captureStackTrace = undefined;
        
        const error = new CoreError('TEST', 'message');
        expect(error.stack).toBeDefined(); // Default stack trace should exist
        
        Error.captureStackTrace = originalCaptureStackTrace;
    });

    test('should use captureStackTrace when available', () => {
        const error = new CoreError('TEST', 'message');
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('CoreError');
    });
});

describe('Error Cause Serialization', () => {
  test('should handle cause without name in development', () => {
      const cause = new Error('Cause message');
      delete cause.name; // Remove name property
      
      const error = new CoreError('TEST', 'message', {}, { cause });
      const json = error.toJSON();
      
      expect(json.cause.name).toBe('Error');
  });

  test('should handle cause without stack in development', () => {
      const cause = new Error('Cause message');
      delete cause.stack; // Remove stack property
      
      const error = new CoreError('TEST', 'message', {}, { cause });
      const json = error.toJSON();
      
      expect(json.cause.stack).toBeUndefined();
  });

  test('should handle complete cause properties in development', () => {
      const cause = new Error('Cause message');
      cause.stack = 'Error: Cause message\n    at Test';
      
      const error = new CoreError('TEST', 'message', {}, { cause });
      const json = error.toJSON();
      
      expect(json.cause.name).toBe('Error');
      expect(json.cause.stack).toBe(cause.stack);
  });
});

  describe('Constructor', () => {
    it('should create error with basic properties', () => {
      const error = new CoreError('TEST_ERROR', 'Test message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CoreError);
      expect(error.name).toBe('CoreError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeDefined();
    });

    it('should handle detailed error creation', () => {
      const details = { foo: 'bar' };
      const cause = new Error('Original error');
      const error = new CoreError('TEST_ERROR', 'Test message', details, { cause });

      expect(error.details).toEqual(details);
      expect(error.cause).toBe(cause);
    });

    it('should handle object cause with message', () => {
      const error = new CoreError('TEST_ERROR', 'Test message', {}, { 
        cause: { message: 'Custom error', name: 'CustomError' } 
      });

      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe('Custom error');
      expect(error.cause.name).toBe('CustomError');
    });

    it('should handle string cause', () => {
      const error = new CoreError('TEST_ERROR', 'Test message', {}, {
        cause: 'String error'
      });

      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe('String error');
    });

    it('should handle object cause without message', () => {
      const causeObj = { foo: 'bar' };
      const error = new CoreError('TEST_ERROR', 'Test message', {}, { cause: causeObj });
      
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe(JSON.stringify(causeObj));
    });

    it('should sanitize non-serializable details', () => {
      const circular = {};
      circular.self = circular;
      
      const error = new CoreError('TEST_ERROR', 'Test message', circular);
      
      expect(() => JSON.stringify(error)).not.toThrow();
      expect(error.details).toHaveProperty('error');
      expect(error.details).toHaveProperty('safeDetails');
    });

    it('should format stack trace in browser environment', () => {
      const originalWindow = global.window;
      global.window = {}; // Mock browser environment
      
      const error = new CoreError('TEST_ERROR', 'Test message');
      expect(error.stack).toBeDefined();
      
      global.window = originalWindow;
    });
  });

  describe('toJSON', () => {
    it('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new CoreError('TEST_ERROR', 'Test message');
      const json = error.toJSON();

      expect(json).toHaveProperty('stack');
    });

    it('should exclude stack trace in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new CoreError('TEST_ERROR', 'Test message');
      const json = error.toJSON();

      expect(json).not.toHaveProperty('stack');
    });

    it('should handle cause serialization in development', () => {
      process.env.NODE_ENV = 'development';
      const cause = new Error('Original error');
      const error = new CoreError('TEST_ERROR', 'Test message', {}, { cause });
      const json = error.toJSON();

      expect(json.cause).toHaveProperty('message', 'Original error');
      expect(json.cause).toHaveProperty('name', 'Error');
      expect(json.cause).toHaveProperty('stack');
    });
  });

  describe('fromJSON', () => {
    it('should recreate error from complete JSON data', () => {
      const original = new CoreError('TEST_ERROR', 'Test message', { foo: 'bar' });
      const json = original.toJSON();
      const recreated = CoreError.fromJSON(json);

      expect(recreated).toBeInstanceOf(CoreError);
      expect(recreated.code).toBe(original.code);
      expect(recreated.message).toBe(original.message);
      expect(recreated.details).toEqual(original.details);
    });

    it('should handle JSON with cause', () => {
      const json = {
        code: 'TEST_ERROR',
        message: 'Test message',
        cause: { message: 'Original error', name: 'CustomError' }
      };
      const error = CoreError.fromJSON(json);

      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe('Original error');
      expect(error.cause.name).toBe('CustomError');
    });

    it('should handle string cause in JSON', () => {
      const json = {
        code: 'TEST_ERROR',
        message: 'Test message',
        cause: 'String error'
      };
      const error = CoreError.fromJSON(json);

      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe('String error');
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const error = new CoreError('TEST_ERROR', 'Test message');
      
      expect(error.isDevEnvironment()).toBe(true);
    });

    it('should detect test environment as development', () => {
      process.env.NODE_ENV = 'test';
      const error = new CoreError('TEST_ERROR', 'Test message');
      
      expect(error.isDevEnvironment()).toBe(true);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const error = new CoreError('TEST_ERROR', 'Test message');
      
      expect(error.isDevEnvironment()).toBe(false);
    });

    it('should detect client environment', () => {
      const originalWindow = global.window;
      global.window = { ENV: 'development' };
      
      const error = new CoreError('TEST_ERROR', 'Test message');
      expect(error.isClientEnvironment()).toBe(true);
      
      global.window = originalWindow;
    });
  });

  describe('CoreError - Additional Coverage Tests', () => {
    describe('Edge Cases', () => {
      test('should handle circular references in details', () => {
        const circularObj = {};
        circularObj.self = circularObj;
        
        const error = new CoreError('TEST', 'message', circularObj);
        expect(error.details).toHaveProperty('error');
        expect(error.details.error).toContain('non-serializable');
      });
  
      test('should handle undefined stack trace', () => {
        const error = new CoreError('TEST', 'message');
        delete error.stack;
        
        expect(error.formatStackTrace(undefined)).toBeUndefined();
        expect(error.toJSON()).not.toHaveProperty('stack');
      });
    });
  
    describe('Environment Detection', () => {
      const originalWindow = global.window;
      const originalProcess = global.process;
  
      afterEach(() => {
        global.window = originalWindow;
        global.process = originalProcess;
      });
  
      test('should detect development environment in Node.js', () => {
        global.window = undefined;
        process.env.NODE_ENV = 'development';
        
        const error = new CoreError('TEST', 'message');
        expect(error.isDevEnvironment()).toBe(true);
      });
  
      test('should detect development environment in browser', () => {
        delete global.process;
        global.window = { ENV: 'development' };
        
        const error = new CoreError('TEST', 'message');
        expect(error.isDevEnvironment()).toBe(true);
      });
    });
  });

  describe('Cause Serialization Edge Cases', () => {
    test('should handle cause with missing name property', () => {
        // Create a plain object that mimics an Error
        const cause = {
            message: 'Test cause',
            stack: 'Test stack'
        };
        
        const error = new CoreError('TEST', 'Test message', {}, { cause });
        const json = error.toJSON();
        
        expect(json.cause.name).toBe('Error');
        expect(json.cause.message).toBe('Test cause');
    });

    test('should handle cause with empty name property', () => {
        // Create a plain object that mimics an Error
        const cause = {
            name: '',
            message: 'Test cause'
        };
        
        const error = new CoreError('TEST', 'Test message', {}, { cause });
        const json = error.toJSON();
        
        expect(json.cause.name).toBe('Error');
    });

    test('should handle cause with whitespace name', () => {
        // Create a plain object that mimics an Error
        const cause = {
            name: '   ',
            message: 'Test cause'
        };
        
        const error = new CoreError('TEST', 'Test message', {}, { cause });
        const json = error.toJSON();
        
        expect(json.cause.name).toBe('Error');
    });

    test('should handle non-Error cause object', () => {
        const cause = {
            customProp: 'test',
            message: 'Custom error message'
        };
        
        const error = new CoreError('TEST', 'Test message', {}, { cause });
        const json = error.toJSON();
        
        expect(json.cause.name).toBe('Error');
        expect(json.cause.message).toBe('Custom error message');
    });
});

// describe('Cause Name Edge Cases', () => {
//   test('should handle cause with undefined name property', () => {
//       // Create a cause with Object.create to avoid read-only properties
//       const cause = Object.create(Error.prototype, {
//           message: { value: 'Test cause', enumerable: true },
//           stack: { value: 'Test stack trace', enumerable: true }
//       });
//       // This ensures cause.name is actually undefined, not just empty string
//       Object.defineProperty(cause, 'name', {
//           value: undefined,
//           enumerable: true,
//           configurable: true
//       });

//       const error = new CoreError('TEST', 'Test message', {}, { cause });
//       const json = error.toJSON();

//       expect(json.cause).toBeDefined();
//       expect(json.cause.name).toBe('Error');
//       expect(json.cause.message).toBe('Test cause');
//   });

//   test('should handle cause with name explicitly set to undefined', () => {
//       const cause = {
//           message: 'Test cause',
//           name: undefined,  // Explicitly undefined name
//           stack: 'Test stack'
//       };

//       const error = new CoreError('TEST', 'Test message', {}, { cause });
//       const json = error.toJSON();

//       expect(json.cause.name).toBe('Error');
//       expect(json.cause.message).toBe('Test cause');
//   });
// });
describe('Cause Name Edge Cases', () => {
  test('should handle cause with name implicitly undefined', () => {
      // Create a plain object without name property
      const cause = {
          message: 'Test cause',
          stack: 'Test stack'
          // name property deliberately omitted
      };

      const error = new CoreError('TEST', 'Test message', {}, { cause });
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause.name).toBe('Error');
      expect(json.cause.message).toBe('Test cause');
  });

  test('should handle cause with explicit undefined name', () => {
      // Create a cause as plain object
      const cause = {
          message: 'Test cause',
          name: undefined,
          stack: 'Test stack'
      };

      const error = new CoreError('TEST', 'Test message', {}, { cause });
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause.name).toBe('Error');
      expect(json.cause.message).toBe('Test cause');
  });

  test('should handle non-Error cause object', () => {
      // Test with a completely different object structure
      const cause = {
          message: 'Test cause',
          customField: 'test'
      };

      const error = new CoreError('TEST', 'Test message', {}, { cause });
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause.name).toBe('Error');
      expect(json.cause.message).toBe('Test cause');
  });

  test('should handle cause with name as null', () => {
      const cause = {
          message: 'Test cause',
          name: null
      };

      const error = new CoreError('TEST', 'Test message', {}, { cause });
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause.name).toBe('Error');
  });
});

describe('Error Serialization Edge Cases', () => {
  test('should handle undefined cause name in toJSON', () => {
      const error = new CoreError('TEST', 'Test message');
      // Directly set cause after creation to bypass initCause
      Object.defineProperty(error, 'cause', {
          value: {
              message: 'Cause message',
              name: undefined  // This is key for line 144
          },
          configurable: true,
          writable: true
      });

      const json = error.toJSON();
      expect(json.cause.name).toBe('Error');
  });

  test('should preserve cause name when available', () => {
      const error = new CoreError('TEST', 'Test message');
      Object.defineProperty(error, 'cause', {
          value: {
              message: 'Cause message',
              name: 'CustomError'
          },
          configurable: true,
          writable: true
      });

      const json = error.toJSON();
      expect(json.cause.name).toBe('CustomError');
  });

  test('should handle missing cause name property', () => {
      const error = new CoreError('TEST', 'Test message');
      Object.defineProperty(error, 'cause', {
          value: {
              message: 'Cause message'
              // name property completely missing
          },
          configurable: true,
          writable: true
      });

      const json = error.toJSON();
      expect(json.cause.name).toBe('Error');
  });
});
});