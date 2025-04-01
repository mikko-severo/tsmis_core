// tests/core/module/ModuleSystem.test.js

/**
 * TESTS
 *
 * - Basic Functionality: Tests for basic methods like register, resolve, unregister.
 * - Dependency Validation: Tests for dependency validation logic.
 * - Registration: Tests for module registration and unregistration.
 * - Event Emission: Tests for event emission functionality.
 * - Dependency Resolution: Tests for dependency resolution logic.
 * - Error Handling: Tests for error handling, including console.error fallback.
 * - Initialization: Tests for system initialization process.
 * - Health Monitoring: Tests for health monitoring functionality.
 * - Shutdown: Tests for system shutdown process.
 * - Factory Function: Tests for factory function.
 */

import {
  ModuleSystem,
  createModuleSystem,
} from "../../../src/core/module/ModuleSystem.js";
import { CoreModule } from "../../../src/core/module/Module.js";
import {
  ModuleError,
  ValidationError,
} from "../../../src/core/errors/index.js";
import { EventEmitter } from "events";

describe("ModuleSystem Basic Functionality", () => {
  let moduleSystem;
  let originalSetInterval;
  let originalClearInterval;

  beforeEach(() => {
    // Save original functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Replace with no-op functions
    global.setInterval = function () {
      return 123;
    };
    global.clearInterval = function () {};

    // Create the most basic mocks possible
    const eventBus = new EventEmitter();

    const errorSystem = {
      handleError: async () => {},
    };

    const eventBusSystem = {
      getEventBus: () => eventBus,
    };

    moduleSystem = new ModuleSystem({
      errorSystem,
      eventBusSystem,
      config: {},
    });
  });

  afterEach(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  test("should initialize with default state", () => {
    expect(moduleSystem.initialized).toBe(false);
    expect(moduleSystem.state.status).toBe("created");
    expect(moduleSystem.modules.size).toBe(0);
  });

  test("should register a module", async () => {
    // Define the simplest possible module
    class SimpleModule extends CoreModule {}

    const module = await moduleSystem.register("simple", SimpleModule);

    expect(module instanceof SimpleModule).toBe(true);
    expect(moduleSystem.modules.has("simple")).toBe(true);
  });

  test("should resolve a module", async () => {
    class SimpleModule extends CoreModule {}

    const registeredModule = await moduleSystem.register(
      "simple",
      SimpleModule
    );
    const resolvedModule = await moduleSystem.resolve("simple");

    expect(resolvedModule).toBe(registeredModule);
  });

  test("should unregister a module", async () => {
    class SimpleModule extends CoreModule {}

    await moduleSystem.register("simple", SimpleModule);
    expect(moduleSystem.modules.has("simple")).toBe(true);

    await moduleSystem.unregister("simple");
    expect(moduleSystem.modules.has("simple")).toBe(false);
  });

  test("should validate module is a proper CoreModule subclass", async () => {
    // Define something that's not a proper CoreModule
    function NotACoreModule() {}
    NotACoreModule.prototype = {
      /* not CoreModule */
    };

    // This should trigger the instanceof check
    let error;
    try {
      await moduleSystem.register("invalid", NotACoreModule);
    } catch (e) {
      error = e;
    }

    // Verify error type and message
    expect(error instanceof ValidationError).toBe(true);
    expect(error.message).toContain("Module must extend CoreModule");
  });

  test("should handle unregistering a non-existent module", async () => {
    // This should return silently for a non-existent module
    const result = await moduleSystem.unregister("non-existent");

    // Should return undefined and not throw
    expect(result).toBeUndefined();
  });

  test("should throw ModuleError when resolving a non-existent module", async () => {
    // Attempt to resolve non-existent module
    let error;
    try {
      await moduleSystem.resolve("non-existent");
    } catch (e) {
      error = e;
    }

    // Verify error type and message
    expect(error instanceof ModuleError).toBe(true);
    expect(error.message).toContain("Module non-existent is not registered");
  });
});

describe("ModuleSystem Dependency Validation", () => {
  let originalSetInterval;
  let originalClearInterval;

  beforeEach(() => {
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    global.setInterval = function () {
      return 123;
    };
    global.clearInterval = function () {};
  });

  afterEach(() => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  test("should throw ModuleError when dependencies are missing", () => {
    // Create deps missing config
    const missingConfig = {
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      // config is missing
    };

    expect(() => {
      new ModuleSystem(missingConfig);
    }).toThrow(ModuleError);
  });

  test("should throw ModuleError when eventBusSystem is invalid", () => {
    // First create a valid ModuleSystem
    const validDeps = {
      errorSystem: { handleError: () => {} },
      eventBusSystem: {
        getEventBus: () => new EventEmitter(),
      },
      config: {},
    };

    const system = new ModuleSystem(validDeps);

    // Now manually make eventBusSystem invalid for testing validateDependencies
    system.deps.eventBusSystem.getEventBus = undefined;

    expect(() => {
      system.validateDependencies();
    }).toThrow(ModuleError);

    // Test with null eventBusSystem
    system.deps.eventBusSystem = null;

    expect(() => {
      system.validateDependencies();
    }).toThrow(ModuleError);
  });

  test("should throw ModuleError when errorSystem is invalid", () => {
    const invalidErrorSystem = {
      errorSystem: {}, // Missing handleError method
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    };

    expect(() => {
      new ModuleSystem(invalidErrorSystem);
    }).toThrow(ModuleError);

    // Test with null errorSystem
    const nullErrorSystem = {
      errorSystem: null,
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    };

    expect(() => {
      new ModuleSystem(nullErrorSystem);
    }).toThrow(ModuleError);
  });
});

describe("ModuleSystem Registration", () => {
  let moduleSystem;
  let originalSetInterval;
  let originalClearInterval;

  beforeEach(() => {
    // Save original functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Replace with no-op functions
    global.setInterval = function () {
      return 123;
    };
    global.clearInterval = function () {};

    // Create a basic moduleSystem
    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    });
  });

  afterEach(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  test("should throw ModuleError when module name is already registered", async () => {
    class TestModule extends CoreModule {}

    // First registration should succeed
    await moduleSystem.register("duplicate", TestModule);

    // Second registration should fail
    let error;
    try {
      await moduleSystem.register("duplicate", TestModule);
    } catch (e) {
      error = e;
    }

    expect(error instanceof ModuleError).toBe(true);
    expect(error.message).toContain("already registered");
  });

  test("should merge config when registering module", async () => {
    // Create system with base config
    const systemWithConfig = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {
        configTest: { base: "value" },
      },
    });

    class ConfigModule extends CoreModule {
      constructor(deps) {
        super(deps);
      }
    }

    // Register with additional config
    const module = await systemWithConfig.register("configTest", ConfigModule, {
      extra: "value",
    });

    // Verify configs were merged correctly
    expect(module.config).toEqual({
      base: "value",
      extra: "value",
    });

    expect(module instanceof ConfigModule).toBe(true);
    expect(systemWithConfig.modules.get("configTest")).toBe(module);
  });

  test("should throw ModuleError when module creation fails", async () => {
    // Create a module class that throws during construction
    class FailingModule extends CoreModule {
      constructor() {
        // Throw before calling super() to ensure the error happens
        // during module creation in the register method
        throw new Error("Module creation failed");
      }
    }

    // Try registering the failing module
    let error;
    try {
      await moduleSystem.register("failing-module", FailingModule);
    } catch (e) {
      error = e;
    }

    // Verify the error
    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_REGISTRATION_FAILED");
    expect(error.message).toContain("Failed to register module failing-module");
  });

  test("should throw ModuleError when unregister operation fails", async () => {
    // Create a module that will throw during shutdown
    class FailingModule extends CoreModule {
      async shutdown() {
        throw new Error("Shutdown failed");
      }
    }

    // Register the module
    await moduleSystem.register("failing", FailingModule);

    // Make it initialized so shutdown will be called
    const module = moduleSystem.modules.get("failing");
    module.initialized = true;

    // Test unregistering
    let error;
    try {
      await moduleSystem.unregister("failing");
    } catch (e) {
      error = e;
    }

    // Verify error
    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_UNREGISTER_FAILED");
    expect(error.message).toContain("Failed to unregister module failing");
  });

  test("should setup event handler for module errors", async () => {
    // Track handleModuleError calls
    let handleModuleErrorCalled = false;
    let moduleName = null;
    let errorPassed = null;

    moduleSystem.handleModuleError = async (name, error) => {
      handleModuleErrorCalled = true;
      moduleName = name;
      errorPassed = error;
    };

    // Register a module
    class TestModule extends CoreModule {}
    const module = await moduleSystem.register("test-module", TestModule);

    // Create test error
    const testError = new ModuleError("TEST_ERROR", "Test module error");

    // Emit module:error event - this should trigger the event handler
    module.emit("module:error", testError);

    // Verify handleModuleError was called
    expect(handleModuleErrorCalled).toBe(true);
    expect(moduleName).toBe("test-module");
    expect(errorPassed).toBe(testError);
  });
});

describe("ModuleSystem Event Emission", () => {
  let moduleSystem;
  let eventBus;
  let eventBusEmitted;
  let localEmitted;

  beforeEach(() => {
    eventBusEmitted = false;
    localEmitted = false;

    // Create an EventEmitter with tracking
    eventBus = new EventEmitter();
    eventBus.emit = function (eventName, ...args) {
      eventBusEmitted = true;
      return EventEmitter.prototype.emit.call(this, eventName, ...args);
    };

    const eventBusSystem = {
      getEventBus: () => eventBus,
    };

    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: eventBusSystem,
      config: {},
    });

    // Set up local event listener
    moduleSystem.on("test-event", () => {
      localEmitted = true;
    });
  });

  test("should emit events through both local emitter and eventBus", async () => {
    // Emit the event
    await moduleSystem.emit("test-event", { data: "test" });

    // Verify both emission methods were called
    expect(localEmitted).toBe(true);
    expect(eventBusEmitted).toBe(true);
  });

  test("should handle error during eventBus emit", async () => {
    // Track handleModuleError calls
    let handleModuleErrorCalled = false;
    let errorPassed = null;

    // Make eventBus.emit throw an error
    eventBus.emit = function () {
      throw new Error("EventBus emit error");
    };

    // Override handleModuleError to track calls
    moduleSystem.handleModuleError = async (moduleName, error) => {
      handleModuleErrorCalled = true;
      errorPassed = error;
    };

    // Call emit to trigger the try/catch block
    await moduleSystem.emit("test-event", { data: "test" });

    // Verify handleModuleError was called correctly
    expect(handleModuleErrorCalled).toBe(true);
    expect(errorPassed instanceof Error).toBe(true);
    expect(errorPassed.message).toBe("EventBus emit error");

    // Local event should still be emitted
    expect(localEmitted).toBe(true);
  });

  test("handles missing event bus emit method", async () => {
    // Create an eventBus without an emit method
    moduleSystem.eventBus = {};

    // Track local event emission
    let localEventEmitted = false;
    moduleSystem.on("test-event", () => {
      localEventEmitted = true;
    });

    // Emit an event
    await moduleSystem.emit("test-event", { data: "test" });

    // Verify local event was emitted
    expect(localEventEmitted).toBe(true);
  });
});

describe("ModuleSystem Dependency Resolution", () => {
  let moduleSystem;

  beforeEach(() => {
    // Create basic module system for testing
    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    });
  });

  // Helper function to create mock modules with dependencies
  function createMockModule(name, dependencies = []) {
    class MockModule extends CoreModule {
      static dependencies = dependencies;

      constructor(deps) {
        super({
          ...deps,
          config: deps.config || {},
          errorSystem: deps.errorSystem || { handleError: async () => {} },
          eventBusSystem: deps.eventBusSystem || {
            getEventBus: () => new EventEmitter(),
          },
        });
      }

      // Override validateDependencies to prevent validation errors
      validateDependencies() {}
    }

    MockModule.prototype.name = name;
    return MockModule;
  }

  test("should resolve dependencies in correct order", () => {
    // Set up modules with dependencies
    const CoreMockModule = createMockModule("core");
    const UtilsMockModule = createMockModule("utils");
    const ModuleAMockModule = createMockModule("moduleA", ["core", "utils"]);
    const ModuleBMockModule = createMockModule("moduleB", ["core"]);

    // Set up modules with dependencies
    moduleSystem.modules = new Map([
      ["core", new CoreMockModule({})],
      ["utils", new UtilsMockModule({})],
      ["moduleA", new ModuleAMockModule({})],
      ["moduleB", new ModuleBMockModule({})],
    ]);

    const order = moduleSystem.resolveDependencyOrder();

    // Verify correct ordering
    expect(order).toContain("core");
    expect(order).toContain("utils");
    expect(order).toContain("moduleA");
    expect(order).toContain("moduleB");

    // Verify dependencies come before dependents
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("moduleA"));
    expect(order.indexOf("utils")).toBeLessThan(order.indexOf("moduleA"));
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("moduleB"));
  });

  test("should detect circular dependencies", () => {
    // Set up circular dependencies
    const ModuleXMockModule = createMockModule("moduleX", ["moduleY"]);
    const ModuleYMockModule = createMockModule("moduleY", ["moduleX"]);

    moduleSystem.modules = new Map([
      ["moduleX", new ModuleXMockModule({})],
      ["moduleY", new ModuleYMockModule({})],
    ]);

    // Should throw with specific error
    let error;
    try {
      moduleSystem.resolveDependencyOrder();
    } catch (e) {
      error = e;
    }

    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_CIRCULAR_DEPENDENCY");
  });

  test("should detect missing dependencies", () => {
    // Set up module with missing dependency
    const ModuleMockModule = createMockModule("module", ["nonexistent"]);

    moduleSystem.modules = new Map([["module", new ModuleMockModule({})]]);

    // Should throw with specific error
    let error;
    try {
      moduleSystem.resolveDependencyOrder();
    } catch (e) {
      error = e;
    }

    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_MISSING_DEPENDENCY");
  });

  test("should handle static dependencies fallback", () => {
    // Create a module class where dependencies is undefined
    class UndefinedDepsModule extends CoreModule {
      static dependencies = undefined;

      constructor(deps) {
        super(deps);
      }

      validateDependencies() {}
    }

    moduleSystem.modules = new Map([
      ["undefinedDeps", new UndefinedDepsModule({})],
    ]);

    // Should not throw and should include the module
    const order = moduleSystem.resolveDependencyOrder();
    expect(order).toContain("undefinedDeps");
  });

  test("should handle complex dependency graphs", () => {
    // Create modules with complex dependencies
    const CoreMockModule = createMockModule("core");
    const LoggingMockModule = createMockModule("logging", ["core"]);
    const DataMockModule = createMockModule("data", ["core"]);
    const UIMockModule = createMockModule("ui", ["core", "logging"]);
    const ReportingMockModule = createMockModule("reporting", [
      "data",
      "logging",
    ]);

    moduleSystem.modules = new Map([
      ["core", new CoreMockModule({})],
      ["logging", new LoggingMockModule({})],
      ["data", new DataMockModule({})],
      ["ui", new UIMockModule({})],
      ["reporting", new ReportingMockModule({})],
    ]);

    const order = moduleSystem.resolveDependencyOrder();

    // Verify all modules are included
    expect(order).toContain("core");
    expect(order).toContain("logging");
    expect(order).toContain("data");
    expect(order).toContain("ui");
    expect(order).toContain("reporting");

    // Verify dependencies come before dependents
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("logging"));
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("data"));
    expect(order.indexOf("logging")).toBeLessThan(order.indexOf("ui"));
    expect(order.indexOf("data")).toBeLessThan(order.indexOf("reporting"));
    expect(order.indexOf("logging")).toBeLessThan(order.indexOf("reporting"));
  });
});

describe("ModuleSystem Initialization", () => {
  let moduleSystem;
  let originalSetInterval;
  let originalClearInterval;
  let originalDateNow;
  let mockedNow;

  beforeEach(() => {
    // Save original functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    originalDateNow = Date.now;

    // Mock timer functions
    mockedNow = 1000000000000;
    Date.now = () => mockedNow;

    // Create setInterval that returns unique IDs
    let intervalId = 0;
    global.setInterval = () => {
      return ++intervalId;
    };

    global.clearInterval = () => {};

    // Create basic ModuleSystem
    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    });
  });

  afterEach(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    Date.now = originalDateNow;
  });

  test("should throw ModuleError when already initialized", async () => {
    // Initialize once
    moduleSystem.initialized = true;

    // Try to initialize again
    let error;
    try {
      await moduleSystem.initialize();
    } catch (e) {
      error = e;
    }

    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_ALREADY_INITIALIZED");
  });

  test("should initialize system properly", async () => {
    // Mock resolveDependencyOrder to return empty array (no modules)
    moduleSystem.resolveDependencyOrder = () => [];

    // Initialize the system
    await moduleSystem.initialize();

    // Check initialization state
    expect(moduleSystem.initialized).toBe(true);
    expect(moduleSystem.state.status).toBe("running");
    expect(moduleSystem.state.startTime).toBe(mockedNow);
  });

  test("should handle errors during initialization", async () => {
    // Force an error during initialization
    moduleSystem.resolveDependencyOrder = () => {
      throw new Error("Initialization failed");
    };

    // Initialize should fail
    let error;
    try {
      await moduleSystem.initialize();
    } catch (e) {
      error = e;
    }

    // Verify error and system state
    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_INITIALIZATION_FAILED");
    expect(moduleSystem.state.status).toBe("error");
  });

  test("should initialize modules and start health monitoring", async () => {
    // Create a mock module
    let initializeCalled = false;
    const mockModule = {
      initialize: async function () {
        initializeCalled = true;
        this.initialized = true;
        return this;
      },
      initialized: false,
      checkHealth: async () => ({ status: "healthy" }),
    };

    // Add the mock module to the system
    moduleSystem.modules.set("test-module", mockModule);

    // Spy on startModuleHealthMonitoring to check if it's called
    let monitoringStartedForModule = null;
    const originalStartMonitoring = moduleSystem.startModuleHealthMonitoring;
    moduleSystem.startModuleHealthMonitoring = async function (name) {
      monitoringStartedForModule = name;
      return originalStartMonitoring.call(this, name);
    };

    // Mock resolveDependencyOrder to return our test module
    moduleSystem.resolveDependencyOrder = function () {
      return ["test-module"];
    };

    // Initialize the system
    await moduleSystem.initialize();

    // Verify module initialization was called
    expect(initializeCalled).toBe(true);

    // Verify health monitoring was started for the module
    expect(monitoringStartedForModule).toBe("test-module");

    // Verify the system was initialized properly
    expect(moduleSystem.initialized).toBe(true);
    expect(moduleSystem.state.status).toBe("running");

    // Restore original method
    moduleSystem.startModuleHealthMonitoring = originalStartMonitoring;
  });

  test("should emit system:initialized event with modules list", async () => {
    // Track event emission
    let eventEmitted = false;
    let eventData = null;

    moduleSystem.on("system:initialized", (data) => {
      eventEmitted = true;
      eventData = data;
    });

    // Add mock modules
    moduleSystem.modules.set("module1", {
      initialize: async () => {},
      checkHealth: async () => {},
    });
    moduleSystem.modules.set("module2", {
      initialize: async () => {},
      checkHealth: async () => {},
    });

    // Mock resolveDependencyOrder
    moduleSystem.resolveDependencyOrder = () => ["module1", "module2"];

    // Mock startModuleHealthMonitoring to prevent errors
    moduleSystem.startModuleHealthMonitoring = async () => {};

    // Initialize
    await moduleSystem.initialize();

    // Verify event emission
    expect(eventEmitted).toBe(true);
    expect(eventData.timestamp).toBeTruthy();
    expect(eventData.modules).toEqual(["module1", "module2"]);
  });
});

describe("ModuleSystem Health Monitoring", () => {
  let moduleSystem;
  let originalSetInterval;
  let originalClearInterval;
  let intervalCallbacks;

  beforeEach(() => {
    // Save original functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Track interval callbacks
    intervalCallbacks = new Map();
    let nextIntervalId = 1;

    // Replace setInterval to capture callbacks
    global.setInterval = (callback, ms) => {
      const id = nextIntervalId++;
      intervalCallbacks.set(id, callback);
      return id;
    };

    // Replace clearInterval
    global.clearInterval = (id) => {
      intervalCallbacks.delete(id);
    };

    // Create basic ModuleSystem
    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    });
  });

  afterEach(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  test("should set up health monitoring for modules", async () => {
    // Create a minimal module mock
    const moduleMock = {
      checkHealth: async () => ({ status: "healthy" }),
    };

    // Set up moduleSystem with the mock
    moduleSystem.modules.set("health-module", moduleMock);

    // Track clearInterval calls
    let intervalCleared = false;
    let clearedId = null;

    moduleSystem.state.healthCheckIntervals.set("health-module", 999);

    const originalClearInterval = global.clearInterval;
    global.clearInterval = (id) => {
      intervalCleared = true;
      clearedId = id;
      originalClearInterval(id);
    };

    // Start monitoring
    await moduleSystem.startModuleHealthMonitoring("health-module");

    // Verify interval was cleared
    expect(intervalCleared).toBe(true);
    expect(clearedId).toBe(999);

    // Verify new interval was set
    expect(moduleSystem.state.healthCheckIntervals.has("health-module")).toBe(
      true
    );
    expect(
      moduleSystem.state.healthCheckIntervals.get("health-module")
    ).not.toBe(999);
  });

  test("should do nothing when monitoring non-existent module", async () => {
    let setIntervalCalled = false;
    global.setInterval = () => {
      setIntervalCalled = true;
      return 123;
    };

    // Try to monitor non-existent module
    await moduleSystem.startModuleHealthMonitoring("non-existent");

    // Should return early without setting up interval
    expect(setIntervalCalled).toBe(false);
  });

  test("should handle healthy module state in health check", async () => {
    // Create a module mock with healthy state
    const moduleMock = {
      checkHealth: async () => ({ status: "healthy" }),
    };

    // Add to module system
    moduleSystem.modules.set("healthy-module", moduleMock);

    // Track handleModuleError calls
    let errorHandled = false;
    moduleSystem.handleModuleError = async () => {
      errorHandled = true;
    };

    // Start monitoring
    await moduleSystem.startModuleHealthMonitoring("healthy-module");

    // Get the interval ID and callback
    const intervalId =
      moduleSystem.state.healthCheckIntervals.get("healthy-module");
    const callback = intervalCallbacks.get(intervalId);

    // Manually trigger the health check
    await callback();

    // Verify error was not handled (module was healthy)
    expect(errorHandled).toBe(false);

    // Verify health status was recorded
    expect(moduleSystem.state.moduleHealth.has("healthy-module")).toBe(true);
    expect(moduleSystem.state.moduleHealth.get("healthy-module").status).toBe(
      "healthy"
    );
  });

  test("should handle unhealthy module state in health check", async () => {
    // Create a module mock with unhealthy state
    const moduleMock = {
      checkHealth: async () => ({ status: "unhealthy" }),
    };

    // Add to module system
    moduleSystem.modules.set("unhealthy-module", moduleMock);

    // Track handleModuleError calls
    let errorHandled = false;
    let errorReceived = null;

    moduleSystem.handleModuleError = async (name, error) => {
      errorHandled = true;
      errorReceived = error;
    };

    // Start monitoring
    await moduleSystem.startModuleHealthMonitoring("unhealthy-module");

    // Get the interval ID and callback
    const intervalId =
      moduleSystem.state.healthCheckIntervals.get("unhealthy-module");
    const callback = intervalCallbacks.get(intervalId);

    // Manually trigger the health check
    await callback();

    // Verify error was handled
    expect(errorHandled).toBe(true);
    expect(errorReceived instanceof ModuleError).toBe(true);
    expect(errorReceived.code).toBe("MODULE_UNHEALTHY_MODULE");

    // Verify health status was recorded
    expect(moduleSystem.state.moduleHealth.has("unhealthy-module")).toBe(true);
    expect(moduleSystem.state.moduleHealth.get("unhealthy-module").status).toBe(
      "unhealthy"
    );
  });

  test("should handle errors during health check", async () => {
    // Create a module mock that throws
    const moduleMock = {
      checkHealth: async () => {
        throw new Error("Health check failed");
      },
    };

    // Add to module system
    moduleSystem.modules.set("error-module", moduleMock);

    // Track handleModuleError calls
    let errorHandled = false;
    let errorMessage = null;

    moduleSystem.handleModuleError = async (name, error) => {
      errorHandled = true;
      errorMessage = error.message;
    };

    // Start monitoring
    await moduleSystem.startModuleHealthMonitoring("error-module");

    // Get the interval ID and callback
    const intervalId =
      moduleSystem.state.healthCheckIntervals.get("error-module");
    const callback = intervalCallbacks.get(intervalId);

    // Manually trigger the health check
    await callback();

    // Verify error handling
    expect(errorHandled).toBe(true);
    expect(errorMessage).toBe("Health check failed");
  });

  test("should get system health status across all modules", async () => {
    // Create modules with mixed health statuses
    moduleSystem.modules = new Map([
      [
        "healthy1",
        {
          checkHealth: async () => ({ status: "healthy", details: "all good" }),
        },
      ],
      [
        "healthy2",
        {
          checkHealth: async () => ({
            status: "healthy",
            details: "running well",
          }),
        },
      ],
      [
        "unhealthy",
        {
          checkHealth: async () => ({
            status: "unhealthy",
            details: "resource issue",
          }),
        },
      ],
    ]);

    // Set system start time for uptime calculation
    moduleSystem.state.startTime = Date.now() - 60000; // started 1 minute ago

    // Get system health
    const health = await moduleSystem.getSystemHealth();

    // System status should be 'degraded' due to the unhealthy module
    expect(health.status).toBe("degraded");

    // Should have timestamp and uptime
    expect(health.timestamp).toBeTruthy();
    expect(health.uptime).toBeGreaterThanOrEqual(60000);

    // Should have module health data
    expect(health.modules.healthy1.status).toBe("healthy");
    expect(health.modules.healthy2.status).toBe("healthy");
    expect(health.modules.unhealthy.status).toBe("unhealthy");
  });

  test("should handle errors during getSystemHealth", async () => {
    // Create modules with one that throws during health check
    moduleSystem.modules = new Map([
      [
        "healthy",
        {
          checkHealth: async () => ({ status: "healthy" }),
        },
      ],
      [
        "error",
        {
          checkHealth: async () => {
            throw new Error("Health check error");
          },
        },
      ],
    ]);

    // Get system health
    const health = await moduleSystem.getSystemHealth();

    // System status should be 'unhealthy' due to the module with error
    expect(health.status).toBe("unhealthy");

    // Healthy module should still report correctly
    expect(health.modules.healthy.status).toBe("healthy");

    // Error module should have error status
    expect(health.modules.error.status).toBe("error");
    expect(health.modules.error.error).toBe("Health check error");
  });
});

describe("ModuleSystem Shutdown", () => {
  let moduleSystem;
  let originalClearInterval;
  let clearedIntervals;

  beforeEach(() => {
    // Save original functions
    originalClearInterval = global.clearInterval;
    clearedIntervals = [];

    // Replace clearInterval with tracking function
    global.clearInterval = function (id) {
      clearedIntervals.push(id);
    };

    // Create moduleSystem
    moduleSystem = new ModuleSystem({
      errorSystem: { handleError: () => {} },
      eventBusSystem: { getEventBus: () => new EventEmitter() },
      config: {},
    });

    // Set up state for testing
    moduleSystem.state.startTime = Date.now() - 1000; // started 1 second ago
  });

  afterEach(() => {
    // Restore original functions
    global.clearInterval = originalClearInterval;
  });

  test("should return early when not initialized", async () => {
    // Ensure not initialized
    moduleSystem.initialized = false;

    // Shutdown should return without doing anything
    const result = await moduleSystem.shutdown();

    expect(result).toBeUndefined();
    // clearInterval should not be called
    expect(clearedIntervals.length).toBe(0);
  });

  test("should clear intervals and shutdown modules", async () => {
    // Set up moduleSystem
    moduleSystem.initialized = true;

    // Add health check intervals
    moduleSystem.state.healthCheckIntervals.set("moduleA", 123);
    moduleSystem.state.healthCheckIntervals.set("moduleB", 456);

    // Mock modules with shutdown method
    let moduleAShutdownCalled = false;
    let moduleBShutdownCalled = false;

    moduleSystem.modules = new Map([
      [
        "moduleA",
        {
          shutdown: async () => {
            moduleAShutdownCalled = true;
          },
        },
      ],
      [
        "moduleB",
        {
          shutdown: async () => {
            moduleBShutdownCalled = true;
          },
        },
      ],
    ]);

    // Mock resolveDependencyOrder
    moduleSystem.resolveDependencyOrder = () => ["moduleA", "moduleB"];

    // Track emit calls
    let shutdownEventEmitted = false;
    moduleSystem.on("system:shutdown", () => {
      shutdownEventEmitted = true;
    });

    // Shutdown
    await moduleSystem.shutdown();

    // Verify intervals were cleared
    expect(clearedIntervals).toContain(123);
    expect(clearedIntervals).toContain(456);
    expect(clearedIntervals.length).toBe(2);

    // Verify modules were shut down
    expect(moduleAShutdownCalled).toBe(true);
    expect(moduleBShutdownCalled).toBe(true);

    // Verify system state
    expect(moduleSystem.initialized).toBe(false);
    expect(moduleSystem.state.status).toBe("shutdown");
    expect(moduleSystem.modules.size).toBe(0);

    // Verify shutdown event was emitted
    expect(shutdownEventEmitted).toBe(true);
  });

  test("should shutdown modules in reverse dependency order", async () => {
    // Set up moduleSystem
    moduleSystem.initialized = true;

    // Track shutdown order
    const shutdownOrder = [];

    // Mock modules with shutdown method
    moduleSystem.modules = new Map([
      [
        "moduleA",
        {
          shutdown: async () => {
            shutdownOrder.push("moduleA");
          },
        },
      ],
      [
        "moduleB",
        {
          shutdown: async () => {
            shutdownOrder.push("moduleB");
          },
        },
      ],
      [
        "moduleC",
        {
          shutdown: async () => {
            shutdownOrder.push("moduleC");
          },
        },
      ],
    ]);

    // Mock resolveDependencyOrder to return modules in dependency order
    // When reversed for shutdown, it should be C, B, A
    moduleSystem.resolveDependencyOrder = () => [
      "moduleA",
      "moduleB",
      "moduleC",
    ];

    // Shutdown
    await moduleSystem.shutdown();

    // Verify shutdown order is reversed from dependency order
    expect(shutdownOrder).toEqual(["moduleC", "moduleB", "moduleA"]);
  });

  test("should handle errors during shutdown", async () => {
    // Set up moduleSystem
    moduleSystem.initialized = true;

    // Create a module that will fail during shutdown
    moduleSystem.modules = new Map([
      [
        "failingModule",
        {
          shutdown: async () => {
            throw new Error("Shutdown failed");
          },
        },
      ],
    ]);

    // Mock resolveDependencyOrder
    moduleSystem.resolveDependencyOrder = () => ["failingModule"];

    // Attempt shutdown
    let error;
    try {
      await moduleSystem.shutdown();
    } catch (e) {
      error = e;
    }

    // Verify error and status
    expect(error instanceof ModuleError).toBe(true);
    expect(error.code).toBe("MODULE_SHUTDOWN_FAILED");
    expect(moduleSystem.state.status).toBe("error");
  });

  test("should clear health check intervals map during shutdown", async () => {
    // Set up moduleSystem
    moduleSystem.initialized = true;

    // Add health check intervals
    moduleSystem.state.healthCheckIntervals.set("moduleA", 123);
    moduleSystem.state.healthCheckIntervals.set("moduleB", 456);

    // Mock empty modules list with dependency order
    moduleSystem.modules = new Map();
    moduleSystem.resolveDependencyOrder = () => [];

    // Shutdown
    await moduleSystem.shutdown();

    // Verify intervals were cleared from the map
    expect(moduleSystem.state.healthCheckIntervals.size).toBe(0);

    // Verify both interval IDs were cleared
    expect(clearedIntervals).toContain(123);
    expect(clearedIntervals).toContain(456);
  });
});

describe("ModuleSystem Factory Function", () => {
  describe("createModuleSystem", () => {
    test("should create ModuleSystem with default dependencies", () => {
      const moduleSystem = createModuleSystem();

      // Verify default errorSystem
      expect(moduleSystem.deps.errorSystem).toBeDefined();
      expect(typeof moduleSystem.deps.errorSystem.handleError).toBe("function");

      // Verify default eventBusSystem
      expect(moduleSystem.deps.eventBusSystem).toBeDefined();
      expect(typeof moduleSystem.deps.eventBusSystem.getEventBus).toBe(
        "function"
      );

      // Verify default config
      expect(moduleSystem.deps.config).toBeDefined();
      expect(typeof moduleSystem.deps.config).toBe("object");
    });

    test("should merge custom dependencies with defaults", () => {
      const customErrorSystem = {
        handleError: async (error) => {},
      };

      const customEventBusSystem = {
        getEventBus: () => new EventEmitter(),
      };

      const customConfig = {
        testKey: "testValue",
      };

      const moduleSystem = createModuleSystem({
        errorSystem: customErrorSystem,
        eventBusSystem: customEventBusSystem,
        config: customConfig,
      });

      // Custom dependencies should override defaults
      expect(moduleSystem.deps.errorSystem).toBe(customErrorSystem);
      expect(moduleSystem.deps.eventBusSystem).toBe(customEventBusSystem);
      expect(moduleSystem.deps.config).toBe(customConfig);
    });

    test("should handle partial custom dependencies", () => {
      const customConfig = {
        testKey: "testValue",
      };

      const moduleSystem = createModuleSystem({ config: customConfig });

      // Default errorSystem should exist
      expect(moduleSystem.deps.errorSystem).toBeDefined();
      expect(typeof moduleSystem.deps.errorSystem.handleError).toBe("function");

      // Default eventBusSystem should exist
      expect(moduleSystem.deps.eventBusSystem).toBeDefined();
      expect(typeof moduleSystem.deps.eventBusSystem.getEventBus).toBe(
        "function"
      );

      // Custom config should be used
      expect(moduleSystem.deps.config).toEqual(customConfig);
    });

    test("should create a valid ModuleSystem instance", () => {
      const moduleSystem = createModuleSystem();

      // Should be a ModuleSystem instance
      expect(moduleSystem instanceof ModuleSystem).toBe(true);

      // Should have expected properties
      expect(moduleSystem.modules).toBeInstanceOf(Map);
      expect(moduleSystem.initialized).toBe(false);
      expect(moduleSystem.state.status).toBe("created");
    });
  });
});

describe("ModuleSystem Error Handling", () => {
  let moduleSystem;
  let originalConsoleError;

  beforeEach(() => {
    // Save original console.error
    originalConsoleError = console.error;

    // Create basic module system
    moduleSystem = new ModuleSystem({
      errorSystem: {
        handleError: async () => {},
      },
      eventBusSystem: {
        getEventBus: () => new EventEmitter(),
      },
      config: {},
    });
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  describe("handleModuleError", () => {
    test("should add error to state with module name and error message", async () => {
      const testError = new ModuleError("TEST_ERROR", "Test Module Error");

      await moduleSystem.handleModuleError("testModule", testError);

      expect(moduleSystem.state.errors.length).toBe(1);
      const errorEntry = moduleSystem.state.errors[0];
      expect(errorEntry.module).toBe("testModule");
      expect(errorEntry.error).toBe("Test Module Error");
      expect(errorEntry.timestamp).toBeTruthy();
    });

    test("should trim error history when exceeding 100 errors", async () => {
      // Fill the error history with 100 errors
      for (let i = 0; i < 100; i++) {
        moduleSystem.state.errors.push({
          timestamp: new Date().toISOString(),
          module: "test-module",
          error: `Error ${i}`,
        });
      }

      // Verify we have exactly 100 errors before the test
      expect(moduleSystem.state.errors.length).toBe(100);

      // Capture the first error message for comparison
      const firstErrorMessage = moduleSystem.state.errors[0].error;

      // Call handleModuleError to add one more error (should trigger trimming)
      await moduleSystem.handleModuleError(
        "test-module",
        new ModuleError("TEST_ERROR", "Trigger trim")
      );

      // Verify error count is still 100 (meaning one was removed and one was added)
      expect(moduleSystem.state.errors.length).toBe(100);

      // Verify the first error is no longer the original first error
      expect(moduleSystem.state.errors[0].error).not.toBe(firstErrorMessage);

      // Verify the last error is our new one
      const lastError =
        moduleSystem.state.errors[moduleSystem.state.errors.length - 1];
      expect(lastError.error).toBe("Trigger trim");
    });

    test("should call errorSystem.handleError with correct context", async () => {
      let handleErrorCalled = false;
      let receivedError = null;
      let receivedContext = null;

      // Override error system's handleError method
      moduleSystem.deps.errorSystem.handleError = async (error, context) => {
        handleErrorCalled = true;
        receivedError = error;
        receivedContext = context;
      };

      const testError = new ModuleError("TEST_ERROR", "Test error");

      await moduleSystem.handleModuleError("testModule", testError);

      expect(handleErrorCalled).toBe(true);
      expect(receivedError).toBe(testError);
      expect(receivedContext.source).toBe("ModuleSystem");
      expect(receivedContext.module).toBe("testModule");
      expect(receivedContext.timestamp).toBeTruthy();
    });

    test("should emit module:error event", async () => {
      let eventEmitted = false;
      let emittedData = null;

      moduleSystem.on("module:error", (data) => {
        eventEmitted = true;
        emittedData = data;
      });

      const testError = new ModuleError("TEST_ERROR", "Test error");

      await moduleSystem.handleModuleError("testModule", testError);

      expect(eventEmitted).toBe(true);
      expect(emittedData.module).toBe("testModule");
      expect(emittedData.error).toBe(testError);
      expect(emittedData.timestamp).toBeTruthy();
    });

    test("should fallback to console.error when error system fails (line 331)", async () => {
      // Capture console.error calls
      const consoleErrorCalls = [];
      console.error = function (...args) {
        consoleErrorCalls.push(args);
      };

      // Override error system to throw during handling
      moduleSystem.deps.errorSystem.handleError = async () => {
        throw new Error("Error system failure");
      };

      const testError = new ModuleError("TEST_ERROR", "Test module error");

      await moduleSystem.handleModuleError("testModule", testError);

      // Verify console.error was called with the expected message
      expect(consoleErrorCalls.length).toBeGreaterThan(0);
      expect(consoleErrorCalls[0][0]).toBe("Error System Failure:");

      // Verify the JSON string contains the expected properties
      const jsonString = consoleErrorCalls[0][1];
      const fallbackLog = JSON.parse(jsonString);

      expect(fallbackLog.source).toBe("ModuleSystem");
      expect(fallbackLog.module).toBe("testModule");
      expect(fallbackLog.originalError).toBe("Test module error");
      expect(fallbackLog.handlerError).toBe("Error system failure");
      expect(fallbackLog.timestamp).toBeTruthy();

      // Verify the error was also tracked in state
      const errorEntry = moduleSystem.state.errors.find(
        (e) => e.type === "HANDLER_FAILURE"
      );
      expect(errorEntry).toBeDefined();
      expect(errorEntry.originalError).toBe("Test module error");
      expect(errorEntry.handlerError).toBe("Error system failure");
    });

    test("should handle missing console.error function (line 331 condition)", async () => {
      // Override error system to throw during handling
      moduleSystem.deps.errorSystem.handleError = async () => {
        throw new Error("Error system failure");
      };

      // Replace console.error with undefined
      console.error = undefined;

      const testError = new ModuleError("TEST_ERROR", "Another test error");

      // This should not throw an error, even though console.error is undefined
      let threwError = false;
      try {
        await moduleSystem.handleModuleError("testModule", testError);
      } catch (e) {
        threwError = true;
      }

      // Verify no exception was thrown from the handler
      expect(threwError).toBe(false);

      // Verify error state was still updated
      expect(moduleSystem.state.errors.length).toBeGreaterThan(0);

      // Get the HANDLER_FAILURE error entry
      const errorEntry = moduleSystem.state.errors.find(
        (e) => e.type === "HANDLER_FAILURE"
      );
      expect(errorEntry).toBeDefined();
      expect(errorEntry.module).toBe("testModule");
    });

    test("should handle when errorSystem lacks handleError method", async () => {
      // Create a proper moduleSystem first
      const moduleSystem = new ModuleSystem({
        errorSystem: {
          handleError: async () => {},
        },
        eventBusSystem: {
          getEventBus: () => new EventEmitter(),
        },
        config: {},
      });

      // After creation, replace the errorSystem with one that doesn't have handleError
      moduleSystem.deps.errorSystem = {
        // No handleError method
      };

      const testError = new ModuleError("TEST_ERROR", "Test error");

      // This should not throw
      let threwError = false;
      try {
        await moduleSystem.handleModuleError("testModule", testError);
      } catch (e) {
        threwError = true;
      }

      // Verify no exception occurred
      expect(threwError).toBe(false);

      // Verify error was still added to state
      expect(moduleSystem.state.errors.length).toBe(1);
      expect(moduleSystem.state.errors[0].error).toBe("Test error");
    });

    test("createModuleSystem uses default no-op error handler if none provided", async () => {
      const moduleSystem = createModuleSystem(); // uses defaultDeps

      // Trigger the fallback error handler directly
      await moduleSystem.deps.errorSystem.handleError(new Error("test error"));

      expect(typeof moduleSystem.deps.errorSystem.handleError).toBe("function");
    });
  });
});
