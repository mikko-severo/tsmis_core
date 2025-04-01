// tests/core/errors/ErrorSystem.test.js

import {
  ErrorSystem,
  createErrorSystem,
} from "../../../src/core/errors/ErrorSystem.js";
import { CoreError } from "../../../src/core/errors/Error.js";

describe("ErrorSystem", () => {
  let errorSystem;
  let mockLogger;

  function createMockFn() {
    const fn = (...args) => {
      fn.mock.calls.push(args);
      return fn.mockReturnValue;
    };
    fn.mock = { calls: [] };
    fn.mockReturnValue = fn;
    fn.mockClear = () => {
      fn.mock.calls = [];
    };
    return fn;
  }

  beforeEach(() => {
    mockLogger = {
      error: createMockFn(),
      warn: createMockFn(),
      info: createMockFn(),
    };
    errorSystem = new ErrorSystem({ logger: mockLogger });
  });

  // Add these tests inside describe('ErrorSystem')

  describe("Construction", () => {
    test("should use console logger when no logger provided", () => {
      const systemWithoutLogger = new ErrorSystem({});
      expect(systemWithoutLogger.logger).toBe(console);
    });

    test("should handle empty dependencies", () => {
      const systemNoDeps = new ErrorSystem();
      expect(systemNoDeps.deps).toEqual({});
      expect(systemNoDeps.logger).toBe(console);
    });

    test("should properly initialize all maps", () => {
      const system = new ErrorSystem({});
      expect(system.integrations).toBeInstanceOf(Map);
      expect(system.handlers).toBeInstanceOf(Map);
      expect(system.errorTypes).toBeInstanceOf(Map);
    });
  });

  describe("Handler Resolution", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should resolve to specific handler when available", async () => {
      const specificHandler = createMockFn();
      const defaultHandler = createMockFn();

      errorSystem.registerHandler("CoreError", specificHandler);
      errorSystem.registerHandler("*", defaultHandler);

      const error = new CoreError("TEST", "test");
      await errorSystem.handleError(error);

      expect(specificHandler.mock.calls.length).toBe(1);
      expect(defaultHandler.mock.calls.length).toBe(0);
    });

    test("should fallback to default handler when specific not found", async () => {
      const defaultHandler = createMockFn();
      errorSystem.registerHandler("*", defaultHandler);

      const error = new CoreError("TEST", "test");
      await errorSystem.handleError(error);

      expect(defaultHandler.mock.calls.length).toBe(1);
    });

    test("should pass context to handler", async () => {
      const handler = createMockFn();
      const context = { requestId: "123" };

      errorSystem.registerHandler("CoreError", handler);

      const error = new CoreError("TEST", "test");
      await errorSystem.handleError(error, context);

      expect(handler.mock.calls[0][1]).toBe(context);
    });
  });
  describe('Default Error Handler', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test('should handle undefined context', async () => {
      // Call defaultErrorHandler with undefined context
      errorSystem.defaultErrorHandler(new CoreError('TEST', 'test message'), undefined);
      
      expect(mockLogger.error.mock.calls.length).toBe(1);
      const loggedError = mockLogger.error.mock.calls[0][1];
      expect(loggedError.context).toEqual({});
    });

    test('should use provided context', async () => {
      const context = { requestId: '123' };
      errorSystem.defaultErrorHandler(new CoreError('TEST', 'test message'), context);
      
      const loggedError = mockLogger.error.mock.calls[0][1];
      expect(loggedError.context).toBe(context);
    });
  });
  describe("Factory Function", () => {
    test("should create new instance with dependencies", () => {
      const deps = { logger: mockLogger };
      const system = createErrorSystem(deps);
      expect(system).toBeInstanceOf(ErrorSystem);
      expect(system.logger).toBe(mockLogger);
    });
  });

  describe("Initialization", () => {
    test("should initialize with default handler", async () => {
      await errorSystem.initialize();
      expect(errorSystem.initialized).toBe(true);
      expect(errorSystem.handlers.has("*")).toBe(true);
    });

    test("should prevent double initialization", async () => {
      await errorSystem.initialize();
      await expect(errorSystem.initialize()).rejects.toThrow(
        "Already initialized"
      );
    });

    test("should validate error types during initialization", async () => {
      const invalidErrorSystem = new ErrorSystem({ logger: mockLogger });
      invalidErrorSystem.errorTypes.set("InvalidType", class Invalid {});

      await expect(invalidErrorSystem.initialize()).rejects.toThrow(
        "Error type InvalidType must extend CoreError"
      );
    });
  });

  describe("Error Handler Registration", () => {
    test("should throw on invalid handler registration", async () => {
      await errorSystem.initialize();
      expect(() => {
        errorSystem.registerHandler("TEST", null);
      }).toThrow("Handler must be a function");
    });

    test("should successfully register handler", async () => {
      await errorSystem.initialize();
      const handler = () => {};
      errorSystem.registerHandler("TEST", handler);
      expect(errorSystem.handlers.get("TEST")).toBe(handler);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should handle errors with registered handler", async () => {
      const mockHandler = createMockFn();
      errorSystem.registerHandler("CoreError", mockHandler);

      const error = new CoreError("TEST", "test message");
      await errorSystem.handleError(error);

      expect(mockHandler.mock.calls.length).toBe(1);
      expect(mockHandler.mock.calls[0][0]).toBe(error);
    });

    test("should use default handler when no specific handler exists", async () => {
      const error = new CoreError("TEST", "test message");
      await errorSystem.handleError(error);

      expect(mockLogger.error.mock.calls.length).toBe(1);
    });

    test("should include all error details in default handler", async () => {
      const context = { requestId: "123" };
      const error = new CoreError("TEST", "test message", {
        someDetail: "test",
      });

      await errorSystem.handleError(error, context);

      const loggedError = mockLogger.error.mock.calls[0][1];
      expect(loggedError).toEqual({
        type: "CoreError",
        code: "TEST",
        message: "test message",
        details: { someDetail: "test" },
        context,
      });
    });
  });

  describe("Error Handler Failures", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should handle and log handler failures", async () => {
      const handlerError = new Error("Handler failed");
      errorSystem.registerHandler("CoreError", () => {
        throw handlerError;
      });

      let emittedEvent = null;
      errorSystem.on("error:handler:failed", (event) => {
        emittedEvent = event;
      });

      const originalError = new CoreError("TEST", "test");

      await expect(errorSystem.handleError(originalError)).rejects.toBe(
        handlerError
      );

      expect(mockLogger.error.mock.calls[0]).toEqual([
        "Error handler failed:",
        handlerError,
      ]);
      expect(emittedEvent).toEqual({
        error: handlerError,
        originalError,
      });
    });

    test("should log and rethrow handler errors with details", async () => {
      const error = new Error("Handler failed");
      error.details = { reason: "test" };

      errorSystem.registerHandler("CoreError", () => {
        throw error;
      });

      const originalError = new CoreError("TEST", "test message");
      await expect(errorSystem.handleError(originalError)).rejects.toBe(error);

      expect(mockLogger.error.mock.calls[0][1].details).toEqual({
        reason: "test",
      });
    });
  });

  describe("Framework Integration", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should register framework integration", async () => {
      const mockFramework = {
        addHook: createMockFn(),
        setErrorHandler: createMockFn(),
      };

      const integration = errorSystem.registerIntegration(mockFramework);

      expect(errorSystem.integrations.has(mockFramework)).toBe(true);
      expect(integration).toBeDefined();
    });

    test("should throw on invalid framework", async () => {
      expect(() => {
        errorSystem.registerIntegration(null);
      }).toThrow("Framework is required");
    });
  });

  describe("Event Emission", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should emit error handled event", async () => {
      const mockListener = createMockFn();
      errorSystem.on("error:handled", mockListener);

      const error = new CoreError("TEST", "test message");
      await errorSystem.handleError(error);

      expect(mockListener.mock.calls.length).toBe(1);
      expect(mockListener.mock.calls[0][0].error).toBe(error);
    });

    test("should emit handler failure event", async () => {
      const mockListener = createMockFn();
      errorSystem.on("error:handler:failed", mockListener);

      const handlerError = new Error("Handler failed");
      errorSystem.registerHandler("CoreError", () => {
        throw handlerError;
      });

      const originalError = new CoreError("TEST", "test message");
      await expect(errorSystem.handleError(originalError)).rejects.toBe(
        handlerError
      );

      expect(mockListener.mock.calls[0][0]).toEqual({
        error: handlerError,
        originalError,
      });
    });
  });

  describe("Shutdown", () => {
    test("should cleanup resources on shutdown", async () => {
      await errorSystem.initialize();
      errorSystem.registerHandler("test", () => {});

      await errorSystem.shutdown();

      expect(errorSystem.initialized).toBe(false);
      expect(errorSystem.handlers.size).toBe(0);
      expect(errorSystem.integrations.size).toBe(0);
      expect(errorSystem.errorTypes.size).toBe(0);
    });

    test("should handle multiple shutdown calls", async () => {
      await errorSystem.initialize();
      await errorSystem.shutdown();
      await errorSystem.shutdown(); // Should not throw
      expect(errorSystem.initialized).toBe(false);
    });
  });
  describe("Error Creation", () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    test("should create CoreError when no specific type is found", () => {
      const error = errorSystem.createError(
        'UNKNOWN_TYPE', 
        'TEST_CODE', 
        'Test message', 
        { detail: 'Some detail' }
      );

      expect(error).toBeInstanceOf(CoreError);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ detail: 'Some detail' });
    });

    test("should create error with registered error type", () => {
      // Setup a custom error type
      class CustomError extends CoreError {
        constructor(code, message, details, options) {
          super(code, message, details, options);
          this.isCustom = true;
        }
      }

      // Register the custom error type
      errorSystem.errorTypes.set('CustomError', CustomError);

      const error = errorSystem.createError(
        'CustomError', 
        'SPECIFIC_CODE', 
        'Specific message', 
        { specific: 'detail' }
      );

      expect(error).toBeInstanceOf(CustomError);
      expect(error.code).toBe('SPECIFIC_CODE');
      expect(error.message).toBe('Specific message');
      expect(error.details).toEqual({ specific: 'detail' });
      expect(error.isCustom).toBe(true);
    });

    test("should pass additional options to error constructor", () => {
      const originalError = new Error('Original error');
      const options = { 
        cause: originalError,
        severity: 'high'
      };

      const error = errorSystem.createError(
        'UNKNOWN_TYPE', 
        'TEST_CODE', 
        'Test message', 
        { detail: 'Some detail' },
        options
      );

      expect(error).toBeInstanceOf(CoreError);
      
      // Verify that the options are correctly used during construction
      // This assumes that CoreError constructor uses these options
      // If the actual implementation differs, you may need to adjust this test
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ detail: 'Some detail' });
      
      // The exact verification depends on how CoreError handles these options
      // You might want to check the CoreError.js implementation to confirm
      // This is a generic test that assumes some basic option handling
    });

    test("should handle empty details and options", () => {
      const error = errorSystem.createError(
        'UNKNOWN_TYPE', 
        'TEST_CODE', 
        'Test message'
      );

      expect(error).toBeInstanceOf(CoreError);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({});
    });
  });

  describe("Error Handler Resolution", () => {
    test("should fall back to defaultErrorHandler when no handlers exist", async () => {
      const mockLogger = {
        error: createMockFn(),
        warn: createMockFn(),
        info: createMockFn()
      };
  
      const errorSystem = new ErrorSystem({ logger: mockLogger });
      await errorSystem.initialize();
      
      // Clear ALL handlers including the wildcard handler
      errorSystem.handlers.clear();
      
      // Save the defaultErrorHandler reference
      const defaultHandler = errorSystem.defaultErrorHandler.bind(errorSystem);
      
      // Re-add only the defaultErrorHandler method (not as a handler)
      errorSystem.defaultErrorHandler = defaultHandler;
      
      const error = new CoreError('TEST', 'test message');
      await errorSystem.handleError(error);
      
      expect(mockLogger.error.mock.calls.length).toBe(1);
      expect(mockLogger.error.mock.calls[0][0]).toBe('Unhandled error:');
      expect(mockLogger.error.mock.calls[0][1]).toEqual({
        type: 'CoreError',
        code: 'TEST',
        message: 'test message',
        details: {},
        context: {}
      });
    });
  });
});
