// tests/core/container/Container.test.js

/**
 * TESTS
 *
 * The tests are organized into the following sections:
 * - Basic Registration: Tests for component and manifest registration.
 * - Component Resolution: Tests for resolving components with and without dependencies.
 * - Dependency Management: Tests for dependency validation and ordering.
 * - Lifecycle Management: Tests for initialization and shutdown.
 * - Event Handling: Tests for event emission during lifecycle events.
 * - Component Discovery: Tests for component discovery functionality.
 * - Error Handling: Tests for various error scenarios.
 * - Edge Cases: Tests for uncommon scenarios and edge cases.
 */


import { CoreContainer } from "../../../src/core/container/Container.js";
import { ConfigError, ServiceError } from "../../../src/core/errors/index.js";

describe("CoreContainer", () => {
  let container;

  // Utility function for tracking function calls instead of using jest.fn()
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
    container = new CoreContainer();
  });

  describe("Basic Registration", () => {
    describe("Component Registration", () => {
      test("should register component successfully", () => {
        class TestComponent {}
        container.register("test", TestComponent);
        expect(container.components.has("test")).toBe(true);
      });

      test("should throw on duplicate registration", () => {
        class TestComponent {}
        container.register("test", TestComponent);
        expect(() => container.register("test", TestComponent)).toThrow(ConfigError);
        expect(() => container.register("test", TestComponent)).toThrow("Component test is already registered");
      });

      test("should store component dependencies", () => {
        class TestComponent {
          static dependencies = ["dep1", "dep2"];
        }
        container.register("test", TestComponent);
        expect(container.dependencies.get("test")).toEqual(["dep1", "dep2"]);
      });
    });

    describe("Manifest Registration", () => {
      test("should register manifest successfully", () => {
        const manifest = { configSchema: {} };
        container.registerManifest("test", manifest);
        expect(container.manifests.has("test")).toBe(true);
      });

      test("should throw on duplicate manifest", () => {
        const manifest = { configSchema: {} };
        container.registerManifest("test", manifest);
        expect(() => container.registerManifest("test", manifest)).toThrow(ConfigError);
        expect(() => container.registerManifest("test", manifest)).toThrow("Manifest already registered for type: test");
      });
    });
  });

  describe("Component Resolution", () => {
    test("should resolve component without dependencies", async () => {
      class TestComponent {}
      container.register("test", TestComponent);
      const instance = await container.resolve("test");
      expect(instance).toBeInstanceOf(TestComponent);
    });

    test("should resolve dependencies", async () => {
      class Dependency {}
      class TestComponent {
        static dependencies = ["dep"];
        constructor(deps) {
          this.deps = deps;
        }
      }

      container.register("dep", Dependency);
      container.register("test", TestComponent);

      const instance = await container.resolve("test");
      expect(instance.deps.dep).toBeInstanceOf(Dependency);
    });

    test("should maintain singleton instances", async () => {
      class TestComponent {}
      container.register("test", TestComponent);

      const instance1 = await container.resolve("test");
      const instance2 = await container.resolve("test");
      expect(instance1).toBe(instance2);
    });

    test("should create new instance for non-singleton components", async () => {
      class TestComponent {
        constructor() {
          this.id = Math.random(); // Unique identifier
        }
      }

      container.register("test", TestComponent, { singleton: false });

      const instance1 = await container.resolve("test");
      const instance2 = await container.resolve("test");
      expect(instance1).not.toBe(instance2);
    });

    test("should throw on unknown component", async () => {
      await expect(container.resolve("unknown")).rejects.toThrow(ServiceError);
      await expect(container.resolve("unknown")).rejects.toThrow("Component unknown is not registered");
    });

    test("should initialize newly resolved component when container is initialized", async () => {
      const initialized = [];

      class TestComponent {
        async initialize() {
          initialized.push("test");
        }
      }

      container.register("test", TestComponent);
      await container.initialize();

      // Resolve after initialization
      await container.resolve("test");
      expect(initialized).toContain("test");
    });
    
    // Test for line 172 - initialize component when container is already initialized
    test("should initialize component if container is already initialized (line 172)", async () => {
      let componentInitialized = false;
      
      // Create a component with initialize method
      class LazyComponent {
        async initialize() {
          componentInitialized = true;
        }
      }
      
      // Initialize the container first
      await container.initialize();
      
      // Register and resolve component after container initialization
      container.register("lazy", LazyComponent);
      const instance = await container.resolve("lazy");
      
      // Verify initialize was called on the component
      expect(componentInitialized).toBe(true);
    });
    
    // Test for line 149 - component with undefined dependencies
    test("should handle components with no dependency information (line 149)", async () => {
      // Create a component with no static dependencies property
      class NoDepInfoComponent {
        constructor(deps) {
          this.deps = deps;
        }
      }
      
      // Remove the dependencies entry completely for this component
      container.register("noDeps", NoDepInfoComponent);
      container.dependencies.delete("noDeps");
      
      // Resolve the component
      const instance = await container.resolve("noDeps");
      
      // Verify component was resolved and received empty dependencies
      expect(instance).toBeInstanceOf(NoDepInfoComponent);
      expect(instance.deps).toEqual({});
    });

    test("should handle factory functions", async () => {
      // Factory function that returns an object
      const factory = (deps) => {
        return { type: "factory", deps };
      };

      container.register("factory", factory);
      const instance = await container.resolve("factory");
      expect(instance.type).toBe("factory");
    });

    test("should handle zero-parameter factory functions", async () => {
      // Factory function with no parameters
      const zeroParamFactory = function() { 
        return { type: 'zero' }; 
      };
      // Make it look like a factory rather than a constructor
      Object.setPrototypeOf(zeroParamFactory, Function.prototype);
      zeroParamFactory.prototype = undefined;
      
      container.register('zeroParam', zeroParamFactory);
      const instance = await container.resolve('zeroParam');
      expect(instance.type).toBe('zero');
    });

    test("should handle non-function components", async () => {
      // Object instance component
      const objectComponent = { type: "object" };
      container.register("object", objectComponent);
      
      const resolved = await container.resolve("object");
      expect(resolved).toBe(objectComponent);
    });
  });

  describe("Dependency Management", () => {
    test("should detect circular dependencies", () => {
      class A {
        static dependencies = ["b"];
      }
      class B {
        static dependencies = ["a"];
      }

      container.register("a", A);
      container.register("b", B);

      expect(() => container.resolveDependencyOrder()).toThrow(ConfigError);
      expect(() => container.resolveDependencyOrder()).toThrow("Circular dependency detected: a");
    });

    test("should resolve dependencies in correct order", () => {
      class A {
        static dependencies = ["b"];
      }
      class B {
        static dependencies = ["c"];
      }
      class C {}

      container.register("a", A);
      container.register("b", B);
      container.register("c", C);

      const order = container.resolveDependencyOrder();
      expect(order).toEqual(["c", "b", "a"]);
    });

    test("should throw error for missing dependency", () => {
      class ComponentA {
        static dependencies = ["missingComponent"];
      }

      container.register("componentA", ComponentA);

      expect(() => container.resolveDependencyOrder()).toThrow(ConfigError);
      expect(() => container.resolveDependencyOrder()).toThrow(
        "Dependency missingComponent required by componentA is not registered"
      );
    });

    test("should handle modules with no explicit dependencies", () => {
      class ComponentA {}
      class ComponentB {}
      class ComponentC {
        static dependencies = ["componentA"];
      }

      container.register("componentA", ComponentA);
      container.register("componentB", ComponentB);
      container.register("componentC", ComponentC);

      const order = container.resolveDependencyOrder();
      
      expect(order).toContain("componentA");
      expect(order).toContain("componentB");
      expect(order).toContain("componentC");
      
      // ComponentA must come before ComponentC
      expect(order.indexOf("componentA")).toBeLessThan(order.indexOf("componentC"));
    });

    test("should handle explicit empty dependencies array", () => {
      class ComponentA {
        static dependencies = []; // Empty array explicitly
      }

      container.register("componentA", ComponentA);
      const order = container.resolveDependencyOrder();
      expect(order).toContain("componentA");
    });
    
    // Test for line 259 - handling core systems initialization order
    test("should prioritize core systems in dependency resolution (line 259)", () => {
      // Define mock components
      class ErrorSystem {}
      class ConfigSystem {}
      class EventBusSystem {
        static dependencies = ["errorSystem"]; // Depends on errorSystem
      }
      class ModuleSystem {
        static dependencies = ["eventBusSystem"]; // Depends on eventBusSystem
      }
      class RegularComponent {
        static dependencies = ["errorSystem"]; // Also depends on errorSystem
      }
      
      // Register components in random order
      container.register("moduleSystem", ModuleSystem);
      container.register("regularComponent", RegularComponent);
      container.register("eventBusSystem", EventBusSystem);
      container.register("errorSystem", ErrorSystem);
      container.register("config", ConfigSystem);
      
      // Get dependency order
      const order = container.resolveDependencyOrder();
      
      // Core systems should be initialized in the correct order
      const errorSystemIndex = order.indexOf("errorSystem");
      const configIndex = order.indexOf("config");
      const eventBusIndex = order.indexOf("eventBusSystem");
      const moduleSystemIndex = order.indexOf("moduleSystem");
      
      // Verify core systems appear in dependency order
      expect(errorSystemIndex).toBeLessThan(eventBusIndex);
      expect(eventBusIndex).toBeLessThan(moduleSystemIndex);
      
      // All core systems should be present
      expect(order).toContain("errorSystem");
      expect(order).toContain("config");
      expect(order).toContain("eventBusSystem");
      expect(order).toContain("moduleSystem");
      expect(order).toContain("regularComponent");
    });
    
    // Test for line 232 - component with no dependency information during resolution
    test("should handle component with no dependency entry during resolution (line 232)", () => {
      // Create components with no dependency info
      class ComponentA {}
      class ComponentB {
        static dependencies = ["componentA"];
      }
      
      // Register components
      container.register("componentA", ComponentA);
      container.register("componentB", ComponentB);
      
      // Delete dependency entry for componentA to trigger fallback code
      container.dependencies.delete("componentA");
      
      // Resolve dependencies - this should use the fallback empty array
      const order = container.resolveDependencyOrder();
      
      // Verify ordering is still correct
      expect(order).toContain("componentA");
      expect(order).toContain("componentB");
      expect(order.indexOf("componentA")).toBeLessThan(order.indexOf("componentB"));
    });
  });

  describe("Lifecycle Management", () => {
    describe("Initialization", () => {
      test("should initialize components in dependency order", async () => {
        const initialized = [];

        class A {
          static dependencies = ["b"];
          async initialize() {
            initialized.push("a");
          }
        }
        class B {
          async initialize() {
            initialized.push("b");
          }
        }

        container.register("a", A);
        container.register("b", B);
        await container.initialize();

        expect(initialized).toEqual(["b", "a"]);
      });

      test("should throw error when already initialized", async () => {
        await container.initialize();
        await expect(container.initialize()).rejects.toThrow(ServiceError);
        await expect(container.initialize()).rejects.toThrow("Container is already initialized");
      });

      test("should prevent re-initialization", async () => {
        class TestComponent {
          static initCount = 0;
          async initialize() {
            TestComponent.initCount++;
          }
        }

        container.register("test", TestComponent);
        await container.initialize();
        
        const initialCount = TestComponent.initCount;
        
        // Try to initialize again
        try {
          await container.initialize();
        } catch (error) {
          // Expected to throw
        }
        
        // Count should not have increased
        expect(TestComponent.initCount).toBe(initialCount);
      });
    });

    describe("Shutdown", () => {
      test("should shutdown components in reverse order", async () => {
        const shutdown = [];

        class A {
          static dependencies = ["b"];
          async shutdown() {
            shutdown.push("a");
          }
        }
        class B {
          async shutdown() {
            shutdown.push("b");
          }
        }

        container.register("a", A);
        container.register("b", B);
        await container.initialize();
        await container.shutdown();

        expect(shutdown).toEqual(["a", "b"]);
      });

      test("should handle errors during component shutdown", async () => {
        let shutdownEventEmitted = false;

        class FailingComponent {
          async shutdown() {
            throw new Error("Shutdown failed");
          }
        }
        
        container.register("failing", FailingComponent);
        await container.initialize();
        
        // Listen for shutdown:error events
        container.on("shutdown:error", () => {
          shutdownEventEmitted = true;
        });
        
        // Should complete shutdown despite errors
        await container.shutdown();
        
        expect(shutdownEventEmitted).toBe(true);
        expect(container.initialized).toBe(false);
        expect(container.instances.size).toBe(0);
      });

      test("should clear instances after shutdown", async () => {
        class TestComponent {}
        
        container.register("test", TestComponent);
        await container.initialize();
        await container.resolve("test");
        
        expect(container.instances.size).toBe(1);
        
        await container.shutdown();
        
        expect(container.instances.size).toBe(0);
        expect(container.initialized).toBe(false);
      });
    });
  });

  describe("Event Handling", () => {
    test("should emit events on component registration", (done) => {
      container.once("component:registered", ({ name }) => {
        expect(name).toBe("test");
        done();
      });

      class TestComponent {}
      container.register("test", TestComponent);
    });

    test("should emit events on component resolution", async () => {
      const mockListener = createMockFn();
      container.on("component:resolved", mockListener);

      class TestComponent {}
      container.register("test", TestComponent);
      await container.resolve("test");

      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should emit initialization events", async () => {
      const mockListener = createMockFn();
      container.on("initialized", mockListener);

      await container.initialize();
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should emit shutdown events", async () => {
      const mockListener = createMockFn();
      container.on("shutdown", mockListener);

      await container.initialize();
      await container.shutdown();
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should emit manifest registration events", (done) => {
      container.once("manifest:registered", ({ type }) => {
        expect(type).toBe("test");
        done();
      });

      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);
    });
  });

  describe("Component Discovery", () => {
    test("should throw error when discovering unknown type", async () => {
      await expect(container.discover("unknown", "/some/path")).rejects.toThrow(
        ConfigError
      );
      await expect(container.discover("unknown", "/some/path")).rejects.toThrow(
        "No manifest registered for type: unknown"
      );
    });

    test("should handle discovery errors", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock scanDirectory to simulate error
      container.scanDirectory = async () => {
        throw new Error("Scan failed");
      };

      await expect(container.discover("test", "/some/path")).rejects.toThrow(
        ServiceError
      );
      await expect(container.discover("test", "/some/path")).rejects.toThrow(
        "Failed to discover test components"
      );
    });

    test("should handle component loading errors", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock methods to test error paths
      container.scanDirectory = async () => ["/path/component"];
      container.loadComponent = async () => {
        throw new Error("Load failed");
      };

      const mockListener = createMockFn();
      container.on("discovery:error", mockListener);

      await container.discover("test", "/some/path");
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should skip disabled components", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock methods to test disabled component
      container.scanDirectory = async () => ["/path/component"];
      container.loadConfig = async () => ({ enabled: false });

      const discovered = await container.discover("test", "/some/path");
      expect(discovered.size).toBe(0);
    });

    test("should emit discovery completed event", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock successful component loading
      container.scanDirectory = async () => ["/path/component"];
      container.loadComponent = async () => ({
        name: "test",
        config: { enabled: true },
        implementation: class Test {}
      });

      const mockListener = createMockFn();
      container.on("discovery:completed", mockListener);

      await container.discover("test", "/some/path");
      expect(mockListener.mock.calls.length).toBe(1);
    });
  });

  describe("Error Handling", () => {
    test("should handle validation errors during component loading", async () => {
      const manifest = {
        configSchema: {
          required: ["name"]
        }
      };

      container.registerManifest("test", manifest);
      container.loadConfig = async () => ({ enabled: true });

      await expect(container.loadComponent("/some/path", manifest)).rejects.toThrow(ConfigError);
    });

    test("should handle component implementation loading error", async () => {
      const manifest = {
        configSchema: {}
      };

      // Mock methods to simulate implementation loading error
      container.loadConfig = async () => ({ enabled: true, name: "test" });
      container.loadImplementation = async () => {
        throw new Error("Implementation load failed");
      };

      await expect(container.loadComponent("/path", manifest)).rejects.toThrow(ConfigError);
      await expect(container.loadComponent("/path", manifest)).rejects.toThrow("Failed to load component from /path");
    });

    test("should handle errors during dependency resolution", async () => {
      // Create a component with a dependency that fails to resolve
      class FailingDependencyComponent {
        static dependencies = ["failingDep"];
        constructor(deps) {
          this.deps = deps;
        }
      }

      // Create a mock dependency that will cause an error when resolved
      class FailingDependency {
        constructor() {
          // Intentionally throw an error during instantiation
          throw new Error("Dependency resolution failed");
        }
      }

      // Register the components
      container.register("mainComponent", FailingDependencyComponent);
      container.register("failingDep", FailingDependency);

      // Force initialized state
      container.initialized = true;

      // Expect an error to be thrown during resolution
      await expect(container.resolve("mainComponent")).rejects.toThrow("Dependency resolution failed");
    });
  });

  describe("Edge Cases", () => {
    test("should successfully load complete component", async () => {
      const manifest = {
        configSchema: {} // Schema for validation
      };

      // Mock all required methods to test successful path
      container.loadConfig = async () => ({
        enabled: true,
        name: "test-component"
      });

      container.validateConfig = async () => true; // Validation passes

      container.loadImplementation = async () => {
        return class TestComponent {};
      };

      const component = await container.loadComponent("/test/path", manifest);

      // Verify full component object is returned
      expect(component).toEqual({
        name: "test-component",
        config: { enabled: true, name: "test-component" },
        implementation: expect.any(Function)
      });
    });

    test("should handle components with complex dependency graphs", () => {
      class ComponentA {
        static dependencies = ["componentB", "componentC"];
      }
      class ComponentB {
        static dependencies = ["componentD"];
      }
      class ComponentC {
        static dependencies = ["componentD"];
      }
      class ComponentD {
        // No dependencies
      }

      container.register("componentA", ComponentA);
      container.register("componentB", ComponentB);
      container.register("componentC", ComponentC);
      container.register("componentD", ComponentD);

      // Resolve dependency order
      const order = container.resolveDependencyOrder();

      // Verify order maintains dependencies
      const indexD = order.indexOf("componentD");
      const indexB = order.indexOf("componentB");
      const indexC = order.indexOf("componentC");
      const indexA = order.indexOf("componentA");

      expect(indexD).toBeLessThan(indexB);
      expect(indexD).toBeLessThan(indexC);
      expect(indexB).toBeLessThan(indexA);
      expect(indexC).toBeLessThan(indexA);
    });

    test("should handle async component initialization", async () => {
      let initializationCompleted = false;
      
      class AsyncComponent {
        async initialize() {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          initializationCompleted = true;
        }
      }
      
      container.register("async", AsyncComponent);
      await container.initialize();
      
      expect(initializationCompleted).toBe(true);
    });

    test("should handle transient (non-singleton) components", async () => {
      class TransientComponent {
        constructor() {
          this.id = Math.random();
        }
      }
      
      container.register("transient", TransientComponent, { singleton: false });
      
      const instance1 = await container.resolve("transient");
      const instance2 = await container.resolve("transient");
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });
});