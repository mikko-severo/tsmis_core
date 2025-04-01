// tests/core/module/Module.test.js

/**
 * TESTS
 *
 * - Basic Functionality: Tests for constructor, initialization, and basic methods.
 * - Dependency Validation: Tests for dependency validation logic.
 * - Configuration Validation: Tests for validateConfig and related methods.
 * - Lifecycle Methods: Tests for lifecycle hooks (onConfigure, onInitialize, etc.).
 * - Health Monitoring: Tests for health check registration and execution.
 * - Error Handling: Tests for error handling functionality.
 * - Event Emission: Tests for event emission through both local and event bus.
 * - Metrics Recording: Tests for metrics tracking functionality.
 * - Shutdown Process: Tests for shutdown logic and error handling.
 * - Factory Function: Tests for createModule factory function.
 */

import { CoreModule, createModule } from "../../../src/core/module/Module.js";
import {
  ModuleError,
  ValidationError,
} from "../../../src/core/errors/index.js";
import { EventEmitter } from "events";

describe("CoreModule Basic Functionality", () => {
  let module;
  let errorSystem;
  let eventBus;
  let eventBusSystem;

  beforeEach(() => {
    // Create minimal mocks
    eventBus = new EventEmitter();

    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => eventBus,
    };

    // Suppress intervals for testing
    global.setInterval = function () {
      return 123;
    };
    global.clearInterval = function () {};

    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  afterEach(() => {
    module = null;
    eventBus = null;
    errorSystem = null;
    eventBusSystem = null;
  });

  test("should initialize with default state", () => {
    expect(module.initialized).toBe(false);
    expect(module.state.status).toBe("created");
    expect(module.eventBus).toBeDefined();
    expect(module.config).toEqual({});
  });

  test("should use empty object as default constructor parameter", () => {
    // Create a class that extends CoreModule but overrides validation
    class NoValidationModule extends CoreModule {
      // Override validateDependencies to disable validation for this test
      validateDependencies() {}
    }

    // Create a module without parameters
    const defaultModule = new NoValidationModule();

    // Should default to empty object
    expect(defaultModule.deps).toEqual({});
    expect(defaultModule.config).toEqual({});
  });

  test("should access eventBus from eventBusSystem", () => {
    // Verify eventBus is correctly set from eventBusSystem
    expect(module.eventBus).toBe(eventBus);
  });

  test("should set up state tracking properties", () => {
    // Verify state object has all required properties
    expect(module.state).toHaveProperty("status", "created");
    expect(module.state).toHaveProperty("startTime", null);
    expect(module.state).toHaveProperty("errors");
    expect(module.state).toHaveProperty("metrics");
    expect(module.state).toHaveProperty("healthChecks");
    expect(module.state).toHaveProperty("lastHealthCheck");

    // Verify collections are properly initialized
    expect(module.state.errors).toEqual([]);
    expect(module.state.metrics).toBeInstanceOf(Map);
    expect(module.state.healthChecks).toBeInstanceOf(Map);
  });

  test("should go through initialization and shutdown lifecycle", async () => {
    await module.initialize();

    expect(module.initialized).toBe(true);
    expect(module.state.status).toBe("running");
    expect(module.state.startTime).toBeTruthy();

    await module.shutdown();

    expect(module.initialized).toBe(false);
    expect(module.state.status).toBe("shutdown");
    expect(module.state.startTime).toBeNull();
  });
});

describe("CoreModule Dependency Validation", () => {
  let eventBus;
  let errorSystem;
  let eventBusSystem;

  beforeEach(() => {
    // Create valid dependencies
    eventBus = new EventEmitter();

    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => eventBus,
    };
  });

  test("should throw ModuleError on missing dependencies", () => {
    // Create deps missing eventBusSystem
    const missingDeps = {
      errorSystem,
      // eventBusSystem is missing
      config: {},
    };

    expect(() => {
      new CoreModule(missingDeps);
    }).toThrow(ModuleError);

    try {
      new CoreModule(missingDeps);
    } catch (error) {
      expect(error.code).toBe("MODULE_MISSING_DEPENDENCIES");
      expect(error.message).toContain("eventBusSystem");
    }
  });

  test("should throw error with invalid eventBusSystem", () => {
    // Create invalid eventBusSystem (with getEventBus that isn't a function)
    const invalidDeps = {
      errorSystem: {
        handleError: async () => {},
      },
      eventBusSystem: {
        getEventBus: "not a function", // This is a string, not a function
      },
      config: {},
    };

    // This will throw TypeError, not ModuleError
    expect(() => {
      new CoreModule(invalidDeps);
    }).toThrow(); // Just check that it throws, don't specify error type

    // For a more specific test that validates ModuleError is thrown,
    // we need to test validateDependencies directly with a properly constructed object

    // First create a valid module
    const validDeps = {
      errorSystem: {
        handleError: async () => {},
      },
      eventBusSystem: {
        getEventBus: () => new EventEmitter(),
      },
      config: {},
    };

    const module = new CoreModule(validDeps);

    // Now replace eventBusSystem with an invalid one
    module.deps.eventBusSystem = {};

    // Now calling validateDependencies directly should throw ModuleError
    expect(() => {
      module.validateDependencies();
    }).toThrow(ModuleError);

    try {
      module.validateDependencies();
    } catch (error) {
      expect(error.code).toBe("MODULE_INVALID_EVENTBUS_SYSTEM");
    }
  });
  test("should throw ModuleError on invalid errorSystem", () => {
    // Create invalid errorSystem (no handleError method)
    const invalidDeps = {
      errorSystem: {},
      eventBusSystem,
      config: {},
    };

    expect(() => {
      new CoreModule(invalidDeps);
    }).toThrow(ModuleError);

    try {
      new CoreModule(invalidDeps);
    } catch (error) {
      expect(error.code).toBe("MODULE_INVALID_ERROR_SYSTEM");
    }
  });

  test("should handle null or undefined dependencies gracefully", () => {
    // Test with null eventBusSystem
    const nullEventBusDeps = {
      errorSystem,
      eventBusSystem: null,
      config: {},
    };

    expect(() => {
      new CoreModule(nullEventBusDeps);
    }).toThrow(ModuleError);

    // Test with null errorSystem
    const nullErrorSystemDeps = {
      errorSystem: null,
      eventBusSystem,
      config: {},
    };

    expect(() => {
      new CoreModule(nullErrorSystemDeps);
    }).toThrow(ModuleError);
  });

  test("should handle getEventBus returning different values", () => {
    // Test with getEventBus returning null
    const nullEventBusDeps = {
      errorSystem,
      eventBusSystem: {
        getEventBus: () => null,
      },
      config: {},
    };

    const moduleWithNullBus = new CoreModule(nullEventBusDeps);
    expect(moduleWithNullBus.eventBus).toBeNull();

    // Test with getEventBus returning undefined
    const undefinedEventBusDeps = {
      errorSystem,
      eventBusSystem: {
        getEventBus: () => undefined,
      },
      config: {},
    };

    const moduleWithUndefinedBus = new CoreModule(undefinedEventBusDeps);
    expect(moduleWithUndefinedBus.eventBus).toBeUndefined();
  });
});

describe("CoreModule Configuration Validation", () => {
  let module;
  let errorSystem;
  let eventBusSystem;

  beforeEach(() => {
    // Create minimal dependencies
    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Create module with default config
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  test("should validate config is an object", async () => {
    // Set invalid config type
    module.config = "not an object";

    // Attempt validation
    let error;
    try {
      await module.validateConfig();
    } catch (e) {
      error = e;
    }

    // Verify error details
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_CONFIG_VALIDATION_FAILED");
    expect(error.message).toContain("Failed to validate configuration");

    // Check for original error
    const originalError = error.details?.originalError;
    expect(originalError).toBeDefined();
    expect(originalError instanceof ValidationError).toBe(true);
    expect(originalError.message).toContain("Configuration must be an object");
  });

  test("should validate with null config", async () => {
    // Set null config
    module.config = null;

    // Attempt validation
    let error;
    try {
      await module.validateConfig();
    } catch (e) {
      error = e;
    }

    // Verify error details
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_CONFIG_VALIDATION_FAILED");
  });

  test("should handle custom validation error from onValidateConfig", async () => {
    // Override onValidateConfig to throw
    module.onValidateConfig = async function () {
      throw new ValidationError("CUSTOM_ERROR", "Custom validation failed");
    };

    // Attempt validation
    let error;
    try {
      await module.validateConfig();
    } catch (e) {
      error = e;
    }

    // Verify error details
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_CONFIG_VALIDATION_FAILED");

    // Check for original error
    const originalError = error.details?.originalError;
    expect(originalError).toBeDefined();
    expect(originalError instanceof ValidationError).toBe(true);
    expect(originalError.message).toBe("Custom validation failed");
  });

  test("should pass validation with valid config", async () => {
    // Set valid config
    module.config = {
      validOption: "value",
      nestedOption: {
        subOption: true,
      },
    };

    // Should not throw
    const result = await module.validateConfig();
    expect(result).toBe(true);
  });
});

describe("CoreModule Lifecycle Methods", () => {
  let module;
  let errorSystem;
  let eventBusSystem;
  let lifecycleCallOrder;

  beforeEach(() => {
    // Create minimal dependencies
    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Track lifecycle calls
    lifecycleCallOrder = [];

    // Create extended module with tracking
    class TrackedModule extends CoreModule {
      async onValidateConfig() {
        lifecycleCallOrder.push("onValidateConfig");
        return await super.onValidateConfig();
      }

      async onConfigure() {
        lifecycleCallOrder.push("onConfigure");
        return await super.onConfigure();
      }

      async setupEventHandlers() {
        lifecycleCallOrder.push("setupEventHandlers");
        return await super.setupEventHandlers();
      }

      async onSetupHealthChecks() {
        lifecycleCallOrder.push("onSetupHealthChecks");
        return await super.onSetupHealthChecks();
      }

      async onInitialize() {
        lifecycleCallOrder.push("onInitialize");
        return await super.onInitialize();
      }

      async onShutdown() {
        lifecycleCallOrder.push("onShutdown");
        return await super.onShutdown();
      }

      // Suppress health checks for testing
      startHealthChecks() {
        lifecycleCallOrder.push("startHealthChecks");
      }
    }

    // Create module instance
    module = new TrackedModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  test("should have default implementations for lifecycle hooks", async () => {
    // Create standard module
    const standardModule = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });

    // Call all lifecycle methods and verify they don't throw
    const validateConfigResult = await standardModule.onValidateConfig();
    const configureResult = await standardModule.onConfigure();
    const setupEventHandlersResult = await standardModule.setupEventHandlers();
    const setupHealthChecksResult = await standardModule.onSetupHealthChecks();
    const initializeResult = await standardModule.onInitialize();
    const shutdownResult = await standardModule.onShutdown();

    // Verify expected default returns
    expect(validateConfigResult).toBe(true);
    expect(configureResult).toBeUndefined();
    expect(setupEventHandlersResult).toBeUndefined();
    expect(setupHealthChecksResult).toBeUndefined();
    expect(initializeResult).toBeUndefined();
    expect(shutdownResult).toBeUndefined();
  });

  test("should call lifecycle hooks in correct order during initialization", async () => {
    // Initialize module
    await module.initialize();

    // Verify call order
    expect(lifecycleCallOrder).toEqual([
      "onValidateConfig", // Called by validateConfig
      "onConfigure", // First in initialize
      "setupEventHandlers", // Second in initialize
      "onSetupHealthChecks", // Called by setupHealthChecks
      "onInitialize", // Third in initialize
      "startHealthChecks", // Last in initialize
    ]);
  });

  test("should throw when already initialized", async () => {
    // Initialize once
    await module.initialize();

    // Try to initialize again
    let error;
    try {
      await module.initialize();
    } catch (e) {
      error = e;
    }

    // Verify error
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_ALREADY_INITIALIZED");
  });

  test("should handle error during initialization", async () => {
    // Make onInitialize throw
    module.onInitialize = async function () {
      throw new Error("Initialization error");
    };

    // Try to initialize
    let error;
    try {
      await module.initialize();
    } catch (e) {
      error = e;
    }

    // Verify error
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_INITIALIZATION_FAILED");
    expect(error.details.originalError.message).toBe("Initialization error");

    // Verify state
    expect(module.state.status).toBe("error");
    expect(module.initialized).toBe(false);
    expect(module.state.errors.length).toBe(1);
  });

  test("should call onShutdown during shutdown", async () => {
    // Initialize first
    await module.initialize();

    // Clear tracking
    lifecycleCallOrder = [];

    // Shutdown
    await module.shutdown();

    // Verify onShutdown was called
    expect(lifecycleCallOrder).toContain("onShutdown");
  });

  test("should not shut down if not initialized", async () => {
    // Attempt shutdown without initializing
    await module.shutdown();

    // onShutdown should not be called
    expect(lifecycleCallOrder).not.toContain("onShutdown");
  });

  test("should handle error during shutdown", async () => {
    // Initialize first
    await module.initialize();

    // Make onShutdown throw
    module.onShutdown = async function () {
      throw new Error("Shutdown error");
    };

    // Try to shutdown
    let error;
    try {
      await module.shutdown();
    } catch (e) {
      error = e;
    }

    // Verify error
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_SHUTDOWN_FAILED");
    expect(error.details.originalError.message).toBe("Shutdown error");

    // Verify state
    expect(module.state.status).toBe("error");
    expect(module.state.errors.length).toBe(1);
    expect(module.state.errors[0].context.phase).toBe("shutdown");
  });

  test("should emit lifecycle events during initialization and shutdown", async () => {
    // Track emitted events
    const emittedEvents = [];

    // Listen for events
    module.on("module:initialized", () => {
      emittedEvents.push("module:initialized");
    });

    module.on("module:shutdown", () => {
      emittedEvents.push("module:shutdown");
    });

    // Run lifecycle
    await module.initialize();
    await module.shutdown();

    // Verify events
    expect(emittedEvents).toContain("module:initialized");
    expect(emittedEvents).toContain("module:shutdown");
  });
});

describe("CoreModule Health Monitoring", () => {
  let module;
  let errorSystem;
  let eventBusSystem;
  let originalSetInterval;
  let originalClearInterval;
  let intervalCallback;
  let errorHandleCalls;

  beforeEach(() => {
    // Save original timer functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Track interval callbacks
    intervalCallback = null;
    global.setInterval = function (callback, ms) {
      intervalCallback = callback;
      return 123; // Return dummy interval ID
    };

    global.clearInterval = function () {};

    // Track error handling calls
    errorHandleCalls = [];
    errorSystem = {
      handleError: async (error, context) => {
        errorHandleCalls.push({ error, context });
      },
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Create module
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  afterEach(() => {
    // Restore original timer functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  test("should register default health checks", async () => {
    await module.setupHealthChecks();

    // Default 'state' health check should be registered
    expect(module.state.healthChecks.has("state")).toBe(true);
  });

  test("should register custom health checks", async () => {
    // Register custom check
    module.registerHealthCheck("custom", async () => {
      return { status: "healthy" };
    });

    expect(module.state.healthChecks.has("custom")).toBe(true);
  });

  test("should throw for invalid health check function", () => {
    // Try to register non-function
    let error;
    try {
      module.registerHealthCheck("invalid", "not a function");
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_INVALID_HEALTH_CHECK");
  });

  test("should report unhealthy when status is not running", async () => {
    // Set up state health check
    await module.setupHealthChecks();

    // Set state to something other than 'running'
    module.state.status = "created";

    // Get health check function and call it
    const stateCheckFn = module.state.healthChecks.get("state");
    const result = await stateCheckFn();

    expect(result.status).toBe("unhealthy");
  });

  test("should report healthy when all checks pass", async () => {
    // Set up health checks
    await module.setupHealthChecks();

    // Add another healthy check
    module.registerHealthCheck("custom", async () => {
      return { status: "healthy" };
    });

    // Set status to 'running'
    module.state.status = "running";

    // Check health
    const health = await module.checkHealth();

    // Overall status should be healthy when all checks pass
    expect(health.status).toBe("healthy");
    expect(health.checks.state.status).toBe("healthy");
    expect(health.checks.custom.status).toBe("healthy");
    expect(health.name).toBe(module.constructor.name);
    expect(health.version).toBe(module.constructor.version);
  });

  test("should report unhealthy when any check fails", async () => {
    // Set up health checks
    await module.setupHealthChecks();

    // Add failing check
    module.registerHealthCheck("failing", async () => {
      return { status: "unhealthy" };
    });

    // Set status to 'running'
    module.state.status = "running";

    // Check health
    const health = await module.checkHealth();

    // Overall status should be unhealthy when any check fails
    expect(health.status).toBe("unhealthy");
    expect(health.checks.state.status).toBe("healthy");
    expect(health.checks.failing.status).toBe("unhealthy");
  });

  test("should handle errors during health check", async () => {
    // Set up health checks
    await module.setupHealthChecks();

    // Add check that throws
    module.registerHealthCheck("throwing", async () => {
      throw new Error("Health check failed");
    });

    // Check health
    const health = await module.checkHealth();

    // Overall status should be unhealthy
    expect(health.status).toBe("unhealthy");
    expect(health.checks.throwing.status).toBe("error");
    expect(health.checks.throwing.error).toBe("Health check failed");
  });

  test("should start health monitoring with interval", async () => {
    // Initialize health check setup
    await module.setupHealthChecks();

    // Start health checks
    module.startHealthChecks();

    // Interval should be set
    expect(module.healthCheckInterval).toBe(123);
    expect(intervalCallback).toBeInstanceOf(Function);
  });

  test("should handle health check interval callback", async () => {
    // Save original handleError method
    const originalHandleError = module.handleError;

    // Replace with tracking function
    let handleErrorCalled = false;
    module.handleError = async (error, context) => {
      handleErrorCalled = true;
      return originalHandleError.call(module, error, context);
    };

    // Initialize health check setup
    await module.setupHealthChecks();

    // Set status to running for healthy check
    module.state.status = "running";

    // Start health checks (captures callback)
    module.startHealthChecks();

    // Run the callback
    await intervalCallback();

    // Should update lastHealthCheck
    expect(module.state.lastHealthCheck).toBeDefined();

    // Error handling should not be called (health is good)
    expect(handleErrorCalled).toBe(false);

    // Restore original method
    module.handleError = originalHandleError;
  });

  test("should handle unhealthy status in interval callback", async () => {
    // Save original handleError method
    const originalHandleError = module.handleError;

    // Replace with tracking function
    let handleErrorCalled = false;
    let errorReceived = null;
    module.handleError = async (error, context) => {
      handleErrorCalled = true;
      errorReceived = error;
      return originalHandleError.call(module, error, context);
    };

    // Set up health checks
    await module.setupHealthChecks();

    // Add failing check
    module.registerHealthCheck("failing", async () => {
      return { status: "unhealthy" };
    });

    // Start health checks
    module.startHealthChecks();

    // Run the callback
    await intervalCallback();

    // Error handling should be called
    expect(handleErrorCalled).toBe(true);

    // Error should be a ModuleError with health check failure
    expect(errorReceived).toBeInstanceOf(ModuleError);
    expect(errorReceived.code).toBe("MODULE_HEALTH_CHECK_FAILED");

    // Restore original method
    module.handleError = originalHandleError;
  });

  test("should handle error during health check interval", async () => {
    // Save original methods
    const originalHandleError = module.handleError;
    const originalCheckHealth = module.checkHealth;

    // Replace with tracking/throwing function
    let handleErrorCalled = false;
    let errorReceived = null;
    module.handleError = async (error, context) => {
      handleErrorCalled = true;
      errorReceived = error;
      return originalHandleError.call(module, error, context);
    };

    // Make checkHealth throw
    module.checkHealth = async () => {
      throw new Error("Health check error");
    };

    // Start health checks
    module.startHealthChecks();

    // Run the callback
    await intervalCallback();

    // Error handling should be called
    expect(handleErrorCalled).toBe(true);

    // Error should be the thrown error
    expect(errorReceived.message).toBe("Health check error");

    // Restore original methods
    module.handleError = originalHandleError;
    module.checkHealth = originalCheckHealth;
  });
});

describe("CoreModule Error Handling", () => {
  let module;
  let errorSystem;
  let eventBusSystem;
  let originalConsoleError;
  let errorHandlerCalls;

  beforeEach(() => {
    // Save original console.error
    originalConsoleError = console.error;

    // Track error handler calls
    errorHandlerCalls = [];
    errorSystem = {
      handleError: async (error, context) => {
        errorHandlerCalls.push({ error, context });
      },
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Create module
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  test("should add error to state with context", async () => {
    const error = new ModuleError("TEST_ERROR", "Test error");
    const context = { operation: "test" };

    await module.handleError(error, context);

    // Error should be in state
    expect(module.state.errors.length).toBe(1);
    expect(module.state.errors[0].error).toBe("Test error");
    expect(module.state.errors[0].context).toBe(context);
    expect(module.state.errors[0].timestamp).toBeTruthy();
  });

  test("should handle null context", async () => {
    const error = new ModuleError("TEST_ERROR", "Test error");

    // Pass null context
    await module.handleError(error, null);

    // Error should be in state with empty object context
    expect(module.state.errors.length).toBe(1);
    expect(module.state.errors[0].error).toBe("Test error");
    expect(module.state.errors[0].context).toEqual({});
  });

  test("should trim error history when exceeding limit", async () => {
    // Add 100 errors
    for (let i = 0; i < 100; i++) {
      module.state.errors.push({
        timestamp: new Date().toISOString(),
        error: `Error ${i}`,
        context: {},
      });
    }

    // Verify we have 100 errors
    expect(module.state.errors.length).toBe(100);

    // Get first error
    const firstError = module.state.errors[0].error;

    // Add one more error
    const newError = new ModuleError("TEST_ERROR", "New error");
    await module.handleError(newError);

    // Should still have 100 errors
    expect(module.state.errors.length).toBe(100);

    // First error should be gone
    expect(module.state.errors[0].error).not.toBe(firstError);

    // Last error should be the new one
    expect(module.state.errors[module.state.errors.length - 1].error).toBe(
      "New error"
    );
  });

  test("should call errorSystem.handleError with correct context", async () => {
    const error = new ModuleError("TEST_ERROR", "Test error");
    const context = { operation: "test" };

    // Reset tracking
    errorHandlerCalls = [];

    await module.handleError(error, context);

    // errorSystem.handleError should be called
    expect(errorHandlerCalls.length).toBe(1);

    // First call should have the error
    const call = errorHandlerCalls[0];
    expect(call.error).toBe(error);

    // Context should include module name and the passed context
    expect(call.context.module).toBe(module.constructor.name);
    expect(call.context.operation).toBe("test");
  });

  test("should emit module:error event", async () => {
    const error = new ModuleError("TEST_ERROR", "Test error");
    const context = { operation: "test" };

    // Track emitted events
    let eventEmitted = false;
    let emittedData = null;

    module.on("module:error", (data) => {
      eventEmitted = true;
      emittedData = data;
    });

    await module.handleError(error, context);

    // Event should be emitted
    expect(eventEmitted).toBe(true);

    // Emitted data should include module, error, and context
    expect(emittedData.module).toBe(module.constructor.name);
    expect(emittedData.error).toBe(error);
    expect(emittedData.context).toBe(context);
  });

  test("should handle errors in errorSystem.handleError", async () => {
    // Create module with errorSystem that throws
    const throwingErrorSystem = {
      handleError: async () => {
        throw new Error("Error system failure");
      },
    };

    const moduleWithThrowingErrorSystem = new CoreModule({
      errorSystem: throwingErrorSystem,
      eventBusSystem,
      config: {},
    });

    // Track console.error calls
    const consoleErrorCalls = [];
    console.error = (...args) => {
      consoleErrorCalls.push(args);
    };

    const error = new ModuleError("TEST_ERROR", "Test error");

    // Should not throw when errorSystem throws
    await moduleWithThrowingErrorSystem.handleError(error);

    // Should log to console.error
    expect(consoleErrorCalls.length).toBeGreaterThan(0);

    // Log should contain error handling failure message
    expect(consoleErrorCalls[0][0]).toBe("Error in error handling:");
  });

  test("should still emit module:error event when errorSystem fails", async () => {
    // Create module with errorSystem that throws
    const throwingErrorSystem = {
      handleError: async () => {
        throw new Error("Error system failure");
      },
    };

    const moduleWithThrowingErrorSystem = new CoreModule({
      errorSystem: throwingErrorSystem,
      eventBusSystem,
      config: {},
    });

    // Track emitted events
    let eventEmitted = false;
    let emittedData = null;

    moduleWithThrowingErrorSystem.on("module:error", (data) => {
      eventEmitted = true;
      emittedData = data;
    });

    // Suppress console.error
    console.error = () => {};

    const error = new ModuleError("TEST_ERROR", "Test error");

    await moduleWithThrowingErrorSystem.handleError(error);

    // Event should still be emitted even though errorSystem failed
    expect(eventEmitted).toBe(true);
    expect(emittedData.error).toBe(error);
  });

  test("should handle missing errorSystem during error handling", async () => {
    // Create a proper module first
    const moduleWithoutErrorSystem = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });

    // After creation, remove the errorSystem
    moduleWithoutErrorSystem.deps.errorSystem = undefined;

    const error = new ModuleError("TEST_ERROR", "Test error");

    // Should not throw when errorSystem is missing
    let threwError = false;
    try {
      await moduleWithoutErrorSystem.handleError(error);
    } catch (e) {
      threwError = true;
    }

    // No exception should be thrown
    expect(threwError).toBe(false);

    // Error should still be added to state
    expect(moduleWithoutErrorSystem.state.errors.length).toBe(1);
    expect(moduleWithoutErrorSystem.state.errors[0].error).toBe("Test error");
  });

  test("createModule uses default no-op error handler if none provided", async () => {
    const module = createModule(); // uses defaultDeps

    // Should not throw
    await module.deps.errorSystem.handleError(new Error("test error"));

    expect(typeof module.deps.errorSystem.handleError).toBe("function");
  });
});

describe("CoreModule Event Emission", () => {
  let module;
  let errorSystem;
  let eventBus;
  let eventBusSystem;
  let localEmitted;
  let eventBusEmitted;

  beforeEach(() => {
    // Create minimal dependencies
    eventBus = new EventEmitter();

    // Track eventBus emissions
    eventBusEmitted = false;
    const originalEmit = eventBus.emit;
    eventBus.emit = function (...args) {
      eventBusEmitted = true;
      return originalEmit.apply(this, args);
    };

    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => eventBus,
    };

    // Create module
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });

    // Track local emissions
    localEmitted = false;
    module.on("test-event", () => {
      localEmitted = true;
    });
  });

  test("should emit events locally and through eventBus", async () => {
    await module.emit("test-event", { data: "test" });

    expect(localEmitted).toBe(true);
    expect(eventBusEmitted).toBe(true);
  });

  test("should handle missing eventBus", async () => {
    // Replace eventBus with undefined
    module.eventBus = undefined;

    // Should not throw
    await module.emit("test-event", { data: "test" });

    // Local event should still be emitted
    expect(localEmitted).toBe(true);
  });

  test("should handle eventBus without emit method", async () => {
    // Replace eventBus with object without emit
    module.eventBus = {};

    // Should not throw
    await module.emit("test-event", { data: "test" });

    // Local event should still be emitted
    expect(localEmitted).toBe(true);
  });

  test("should handle error during eventBus emit", async () => {
    // Make eventBus.emit throw
    eventBus.emit = function () {
      throw new Error("EventBus emit error");
    };

    // Track error handling
    let errorHandled = false;
    let errorContext = null;

    module.handleError = async (error, context) => {
      errorHandled = true;
      errorContext = context;
    };

    // Should not throw
    await module.emit("test-event", { data: "test" });

    // Local event should still be emitted
    expect(localEmitted).toBe(true);

    // Error should be handled
    expect(errorHandled).toBe(true);
    expect(errorContext.event).toBe("test-event");
  });

  test("should return local emit result", async () => {
    // Set up an event that has a listener
    module.on("has-listener", () => {});

    // Set up an event with no listeners

    // Emit with listener
    const resultWithListener = await module.emit("has-listener");

    // Emit without listener
    const resultWithoutListener = await module.emit("no-listener");

    // Should return true when event has listeners
    expect(resultWithListener).toBe(true);

    // Should return false when event has no listeners
    expect(resultWithoutListener).toBe(false);
  });
});

describe("CoreModule Metrics Recording", () => {
  let module;
  let errorSystem;
  let eventBusSystem;
  let originalDateNow;
  let mockedNow;

  beforeEach(() => {
    // Create minimal dependencies
    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Create module
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });

    // Save original Date.now
    originalDateNow = Date.now;

    // Mock Date.now
    mockedNow = 1000000000000;
    Date.now = () => mockedNow;
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  test("should record metric with value", () => {
    // Record simple metric
    module.recordMetric("test-metric", 42);

    // Metric should be in state
    expect(module.state.metrics.has("test-metric")).toBe(true);

    // Get the recorded metric
    const metric = module.state.metrics.get("test-metric");

    // Verify properties
    expect(metric.value).toBe(42);
    expect(metric.timestamp).toBe(mockedNow);
  });

  test("should record metric with tags", () => {
    // Record metric with tags
    const tags = {
      environment: "test",
      region: "us-east",
    };

    module.recordMetric("tagged-metric", 100, tags);

    // Get the recorded metric
    const metric = module.state.metrics.get("tagged-metric");

    // Verify properties
    expect(metric.value).toBe(100);
    expect(metric.timestamp).toBe(mockedNow);
    expect(metric.tags).toBe(tags);
  });

  test("should update existing metric", () => {
    // Record metric
    module.recordMetric("updated-metric", 50);

    // First value should be recorded
    expect(module.state.metrics.get("updated-metric").value).toBe(50);

    // Record new value for same metric
    module.recordMetric("updated-metric", 75);

    // Value should be updated
    expect(module.state.metrics.get("updated-metric").value).toBe(75);
  });

  test("should record multiple metrics", () => {
    // Record multiple metrics
    module.recordMetric("metric1", 10);
    module.recordMetric("metric2", 20);
    module.recordMetric("metric3", 30);

    // All metrics should be recorded
    expect(module.state.metrics.size).toBe(3);
    expect(module.state.metrics.get("metric1").value).toBe(10);
    expect(module.state.metrics.get("metric2").value).toBe(20);
    expect(module.state.metrics.get("metric3").value).toBe(30);
  });
});

describe("CoreModule Shutdown Process", () => {
  let module;
  let errorSystem;
  let eventBusSystem;
  let originalClearInterval;
  let clearedIntervals;

  beforeEach(() => {
    // Track clearInterval calls
    clearedIntervals = [];
    originalClearInterval = global.clearInterval;
    global.clearInterval = (id) => {
      clearedIntervals.push(id);
    };

    // Create minimal dependencies
    errorSystem = {
      handleError: async () => {},
    };

    eventBusSystem = {
      getEventBus: () => new EventEmitter(),
    };

    // Create module
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  afterEach(() => {
    // Restore original clearInterval
    global.clearInterval = originalClearInterval;
  });

  test("should clear health check interval during shutdown", async () => {
    // Set health check interval
    module.healthCheckInterval = 123;

    // Initialize the module
    module.initialized = true;

    // Shutdown
    await module.shutdown();

    // Interval should be cleared
    expect(clearedIntervals).toContain(123);
    expect(module.healthCheckInterval).toBeNull();
  });

  test("should reset state during shutdown", async () => {
    // Set up initialized state
    module.initialized = true;
    module.state.status = "running";
    module.state.startTime = Date.now();

    // Shutdown
    await module.shutdown();

    // State should be reset
    expect(module.initialized).toBe(false);
    expect(module.state.status).toBe("shutdown");
    expect(module.state.startTime).toBeNull();
  });

  test("should return early if not initialized", async () => {
    // Make sure not initialized
    module.initialized = false;

    // Set health check interval (should not be cleared)
    module.healthCheckInterval = 123;

    // Track onShutdown calls
    let onShutdownCalled = false;
    module.onShutdown = async () => {
      onShutdownCalled = true;
    };

    // Shutdown
    const result = await module.shutdown();

    // Should return this
    expect(result).toBe(module);

    // onShutdown should not be called
    expect(onShutdownCalled).toBe(false);

    // Interval should not be cleared
    expect(clearedIntervals).not.toContain(123);
    expect(module.healthCheckInterval).toBe(123);
  });

  test("should handle errors during shutdown", async () => {
    // Set up initialized state
    module.initialized = true;

    // Make onShutdown throw
    module.onShutdown = async () => {
      throw new Error("Shutdown error");
    };

    // Shutdown should throw
    let error;
    try {
      await module.shutdown();
    } catch (e) {
      error = e;
    }

    // Error should be ModuleError
    expect(error).toBeInstanceOf(ModuleError);
    expect(error.code).toBe("MODULE_SHUTDOWN_FAILED");

    // State should indicate error
    expect(module.state.status).toBe("error");

    // Error should be in state
    expect(module.state.errors.length).toBe(1);
    expect(module.state.errors[0].context.phase).toBe("shutdown");
  });

  test("should emit module:shutdown event", async () => {
    // Set up initialized state
    module.initialized = true;

    // Track event emission
    let eventEmitted = false;
    let eventData = null;

    module.on("module:shutdown", (data) => {
      eventEmitted = true;
      eventData = data;
    });

    // Shutdown
    await module.shutdown();

    // Event should be emitted
    expect(eventEmitted).toBe(true);
    expect(eventData.name).toBe(module.constructor.name);
    expect(eventData.timestamp).toBeTruthy();
  });
});

describe("CoreModule Factory Function", () => {
  test("should create module with default dependencies", () => {
    // Create module with no dependencies
    const module = createModule();

    // Should be a CoreModule instance
    expect(module instanceof CoreModule).toBe(true);

    // Should have default dependencies
    expect(module.deps.errorSystem).toBeDefined();
    expect(typeof module.deps.errorSystem.handleError).toBe("function");

    expect(module.deps.eventBusSystem).toBeDefined();
    expect(typeof module.deps.eventBusSystem.getEventBus).toBe("function");

    expect(module.deps.config).toBeDefined();
    expect(typeof module.deps.config).toBe("object");
  });

  test("should merge custom dependencies with defaults", () => {
    // Create custom dependencies
    const customErrorSystem = {
      handleError: async () => {},
    };

    const customConfig = {
      option1: "value1",
      option2: true,
    };

    // Create module with custom dependencies
    const module = createModule({
      errorSystem: customErrorSystem,
      config: customConfig,
    });

    // Should be a CoreModule instance
    expect(module instanceof CoreModule).toBe(true);

    // Should use provided dependencies
    expect(module.deps.errorSystem).toBe(customErrorSystem);
    expect(module.deps.config).toBe(customConfig);

    // Should still have default eventBusSystem
    expect(module.deps.eventBusSystem).toBeDefined();
    expect(typeof module.deps.eventBusSystem.getEventBus).toBe("function");
  });

  test("should create module with working eventBusSystem", () => {
    // Create module with default dependencies
    const module = createModule();

    // Default eventBusSystem should provide a working eventBus
    const eventBus = module.deps.eventBusSystem.getEventBus();

    // EventBus should have expected methods
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.on).toBe("function");
    expect(typeof eventBus.emit).toBe("function");
  });

  test("should use CoreEventBus for default eventBusSystem", () => {
    // Create module with default dependencies
    const module = createModule();

    // Default eventBusSystem should create a CoreEventBus
    const eventBus = module.deps.eventBusSystem.getEventBus();

    // CoreEventBus should have certain properties/methods
    expect(eventBus).toBeDefined();
    expect(eventBus.constructor.name).toBe("CoreEventBus");
  });

  test("should create valid module that passes validation", () => {
    // Create module with default dependencies
    const module = createModule();

    // Should pass dependency validation
    let validationPassed = true;
    try {
      module.validateDependencies();
    } catch (error) {
      validationPassed = false;
    }

    expect(validationPassed).toBe(true);
  });
});
