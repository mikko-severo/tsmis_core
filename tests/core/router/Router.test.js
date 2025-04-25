/**
 * TESTS
 *
 * - Initialization & Lifecycle: Tests for constructor, initialization, lifecycle hooks, and shutdown
 * - Route Management: Tests for route registration, retrieval, unregistration, and clearing
 * - Adapter Management: Tests for adapter registration and application
 * - Middleware Management: Tests for middleware registration and application
 * - Error Handling: Tests for error handling, propagation, and recovery
 * - Event Emission & Handling: Tests for event emission through both local and event bus
 * - Health Monitoring: Tests for health check registration and execution
 * - Metrics Recording: Tests for metrics tracking functionality
 * - OpenAPI Documentation: Tests for generating OpenAPI documentation
 */

import { EventEmitter } from "events";
import { createErrorSystem } from "../../../src/core/errors/ErrorSystem.js";
import CoreRouter from "../../../src/core/router/Router.js";
import { RouterError } from "../../../src/core/errors/types/RouterError.js";

// Dummy EventBus implementation to simulate event subscriptions
class DummyEventBus extends EventEmitter {
  subscribe(eventName, handler) {
    this.on(eventName, handler);
    // Return a simple subscription identifier
    return { eventName, handler };
  }
  unsubscribe(subscription) {
    this.removeListener(subscription.eventName, subscription.handler);
  }
}

// Factory for a dummy event bus system
const createDummyEventBusSystem = () => ({
  getEventBus: () => new DummyEventBus(),
});

describe("CoreRouter Component", () => {
  let router;
  let errorSystem;
  let eventBusSystem;
  let config;
  let deps;
  let capturedEvents = [];
  let eventBus;
  let subscriptionIds = [];

  // Basic Setup: Create real ErrorSystem and dummy EventBusSystem
  beforeEach(async () => {
    errorSystem = createErrorSystem({ logger: console });
    await errorSystem.initialize();

    eventBusSystem = createDummyEventBusSystem();
    eventBus = eventBusSystem.getEventBus();

    // Use an empty config for testing
    config = {};

    deps = { errorSystem, eventBusSystem, config };

    // Instantiate a new CoreRouter
    router = new CoreRouter(deps);

    // Setup event tracking for router events
    capturedEvents = [];
    router.on("router:initialized", (event) =>
      capturedEvents.push({ name: "router:initialized", data: event })
    );
    router.on("route:registered", (event) =>
      capturedEvents.push({ name: "route:registered", data: event })
    );
    router.on("route:unregistered", (event) =>
      capturedEvents.push({ name: "route:unregistered", data: event })
    );
    router.on("routes:cleared", (event) =>
      capturedEvents.push({ name: "routes:cleared", data: event })
    );
    router.on("router:shutdown", (event) =>
      capturedEvents.push({ name: "router:shutdown", data: event })
    );
    router.on("router:error", (event) =>
      capturedEvents.push({ name: "router:error", data: event })
    );
  });

  // Teardown: Shutdown router and error system
  afterEach(async () => {
    if (router && router.initialized) {
      await router.shutdown();
    }
    await errorSystem.shutdown();
    subscriptionIds.forEach((sub) => eventBus.unsubscribe(sub));
    subscriptionIds = [];
  });

  // --------------------------------------------------
  // - Initialization & Lifecycle
  // --------------------------------------------------
  describe("Initialization & Lifecycle", () => {
    test("should instantiate with empty routes, adapters, and middleware", () => {
      expect(router.routes.size).toEqual(0);
      expect(router.adapters.size).toEqual(0);
      expect(router.middleware.size).toEqual(0);
      expect(router.state.status).toEqual("created");
    });

    test('should initialize and emit "router:initialized" event', async () => {
      await router.initialize();
      expect(router.initialized).toEqual(true);
      expect(router.state.status).toEqual("running");
      expect(
        capturedEvents.some((e) => e.name === "router:initialized")
      ).toEqual(true);
    });

    test("should not allow double initialization", async () => {
      await router.initialize();
      await expect(router.initialize()).rejects.toThrow(RouterError);
    });

    test("should work with an empty config object", async () => {
      await router.initialize();
      expect(router.state.status).toEqual("running");
    });

    test("should clear all routes and update state on shutdown", async () => {
      await router.initialize();
      router.registerRoute("mod1", "GET", "/shutdown", () => {});
      expect(router.getRoutes().length).toBeGreaterThan(0);
      await router.shutdown();
      expect(router.getRoutes().length).toEqual(0);
      expect(router.initialized).toEqual(false);
      expect(router.state.status).toEqual("shutdown");
      expect(capturedEvents.some((e) => e.name === "router:shutdown")).toEqual(
        true
      );
    });

    test('should set state to "error" and throw RouterError with code SHUTDOWN_FAILED when shutdown fails', async () => {
      await router.initialize();
      // Force an error during shutdown by overriding routes.clear() to throw an error.
      const originalClear = router.routes.clear;
      router.routes.clear = () => {
        throw new Error("Forced shutdown error");
      };

      try {
        await router.shutdown();
        throw new Error("Shutdown should have thrown an error");
      } catch (error) {
        // Verify that the router's state is updated to 'error'
        expect(router.state.status).toEqual("error");
        // Verify that the thrown error is a RouterError with the expected code.
        expect(error).toBeInstanceOf(RouterError);
        expect(error.code).toEqual("ROUTER_SHUTDOWN_FAILED");
      } finally {
        // Restore the original routes.clear method
        router.routes.clear = originalClear;
      }
    });

    test("should create an instance of CoreRouter using new (default export)", () => {
      const newRouter = new CoreRouter(deps);
      expect(newRouter).toBeInstanceOf(CoreRouter);
      expect(newRouter.routes).toBeInstanceOf(Map);
    });

    test('should do nothing when shutdown is called on uninitialized router', async () => {
      // Create a new router but don't initialize it
      const uninitializedRouter = new CoreRouter(deps);
      
      // Call shutdown on the uninitialized router
      await uninitializedRouter.shutdown();
      
      // Since the router wasn't initialized, this should be a no-op
      // We can verify by checking that state.status is still 'created'
      expect(uninitializedRouter.state.status).toEqual('created');
    });
  });

  // --------------------------------------------------
  // - Route Management
  // --------------------------------------------------
  describe("Route Management", () => {
    beforeEach(async () => {
      // Ensure the router is initialized
      if (!router.initialized) {
        await router.initialize();
      }
    });

    test("should throw NOT_INITIALIZED error when registering route before initialization", () => {
      // Create a new uninitialized router
      const newRouter = new CoreRouter(deps);
      try {
        newRouter.registerRoute("mod1", "GET", "/error", () => {});
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        // Expecting "ROUTER_NOT_INITIALIZED" since the implementation prefixes error codes
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
      }
    });

    test("should throw error when registering route with missing parameters", async () => {
      // DO NOT initialize here - the beforeEach already initializes

      try {
        router.registerRoute("", "GET", "/error", () => {});
        // If we get here, the test should fail
        expect("Should have thrown an error").toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        // Expect "ROUTER_INVALID_MODULE_ID"
        expect(error.code).toEqual("ROUTER_INVALID_MODULE_ID");
      }

      try {
        router.registerRoute("mod1", "", "/error", () => {});
        // If we get here, the test should fail
        expect("Should have thrown an error").toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        expect(error.code).toEqual("ROUTER_INVALID_METHOD");
      }

      try {
        router.registerRoute("mod1", "GET", "", () => {});
        // If we get here, the test should fail
        expect("Should have thrown an error").toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        expect(error.code).toEqual("ROUTER_INVALID_PATH");
      }

      try {
        router.registerRoute("mod1", "GET", "/error", "not a function");
        // If we get here, the test should fail
        expect("Should have thrown an error").toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        expect(error.code).toEqual("ROUTER_INVALID_HANDLER");
      }
    });

    test("should throw ROUTE_CONFLICT error when a duplicate route is registered", async () => {
      // DO NOT initialize here - the beforeEach already initializes

      router.registerRoute("mod1", "GET", "/conflict", () => {});
      try {
        router.registerRoute("mod2", "GET", "/conflict", () => {});
        // If we get here, the test should fail
        expect("Should have thrown an error").toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        // Expect error code with prefix "ROUTER_"
        expect(error.code).toEqual("ROUTER_ROUTE_CONFLICT");
      }
    });

    test('should emit "route:registered" when a route is successfully registered', async () => {
      // DO NOT initialize here - the beforeEach already initializes

      // Clear any existing events to ensure a clean test
      capturedEvents = [];

      // Register a route which should emit an event
      router.registerRoute("mod1", "POST", "/submit", () => {});

      // Check for the event
      const regEvents = capturedEvents.filter(
        (e) => e.name === "route:registered"
      );
      expect(regEvents.length).toBeGreaterThanOrEqual(1);
      expect(regEvents[0].data).toHaveProperty("moduleId", "mod1");
      expect(regEvents[0].data).toHaveProperty("method", "POST");
      expect(regEvents[0].data).toHaveProperty("path", "/submit");
    });

    test("getRoute should return the correct route object or null if not found", () => {
      // Register a route
      router.registerRoute("mod1", "GET", "/testRoute", () => {});
      const route = router.getRoute("GET", "/testRoute");
      expect(route).toBeDefined();
      expect(route.moduleId).toEqual("mod1");

      // Check non-existent route returns null
      const nonExistent = router.getRoute("POST", "/nonexistent");
      expect(nonExistent).toBeNull();
    });

    test("getModuleRoutes should return only routes for a given module", () => {
      // Register routes for different modules
      router.registerRoute("mod1", "GET", "/route1", () => {});
      router.registerRoute("mod1", "POST", "/route2", () => {});
      router.registerRoute("mod2", "GET", "/route3", () => {});
      const mod1Routes = router.getModuleRoutes("mod1");
      expect(mod1Routes.length).toEqual(2);
      mod1Routes.forEach((route) => {
        expect(route.moduleId).toEqual("mod1");
      });
    });

    test("unregisterRoute should remove the route and return true if found, false otherwise", () => {
      // Register a route
      router.registerRoute("mod1", "GET", "/toRemove", () => {});
      const before = router.getRoute("GET", "/toRemove");
      expect(before).toBeDefined();

      const result = router.unregisterRoute("GET", "/toRemove");
      expect(result).toEqual(true);

      const after = router.getRoute("GET", "/toRemove");
      expect(after).toBeNull();

      // Test unregistering a non-existent route returns false
      const notFound = router.unregisterRoute("GET", "/nonexistent");
      expect(notFound).toEqual(false);
    });

    test("unregisterModuleRoutes should remove all routes for a given module and return the count", () => {
      // Register multiple routes for a module
      router.registerRoute("mod1", "GET", "/r1", () => {});
      router.registerRoute("mod1", "POST", "/r2", () => {});
      router.registerRoute("mod2", "GET", "/r3", () => {});
      const count = router.unregisterModuleRoutes("mod1");
      expect(count).toEqual(2);
      // Ensure routes for mod1 are gone
      const mod1Routes = router.getModuleRoutes("mod1");
      expect(mod1Routes.length).toEqual(0);
      // Routes for mod2 should remain
      const mod2Routes = router.getModuleRoutes("mod2");
      expect(mod2Routes.length).toEqual(1);
    });

    test("clearRoutes should remove all routes and record metric and emit event", () => {
      // Register some routes
      router.registerRoute("mod1", "GET", "/r1", () => {});
      router.registerRoute("mod1", "POST", "/r2", () => {});
      expect(router.getRoutes().length).toBeGreaterThan(0);
      router.clearRoutes();
      expect(router.getRoutes().length).toEqual(0);
      // Check metric for routes.cleared
      const metric = router.state.metrics.get("routes.cleared");
      expect(metric).toBeDefined();
      expect(metric.value).toEqual(2);
    });

    test("registerVersionedRoute should register a route with a versioned path", () => {
      const handler = () => {};
      router.registerVersionedRoute("mod1", 2, "GET", "/users", handler);
      const route = router.getRoute("GET", "/api/v2/users");
      expect(route).toBeDefined();
      expect(route.moduleId).toEqual("mod1");
      expect(route.options.version).toEqual(2);
    });
  
    test("should handle paths without leading slash in registerVersionedRoute", async () => {
      // Make sure the router is initialized first
      if (!router.initialized) {
        await router.initialize();
      }
  
      // Register a route with a path that doesn't start with '/'
      router.registerVersionedRoute("mod1", 1, "GET", "products", () => {});
  
      // The method should prepend a slash to the path
      const route = router.getRoute("GET", "/api/v1/products");
  
      // Verify the route was registered with the correct path
      expect(route).toBeDefined();
      expect(route.path).toEqual("/api/v1/products");
      expect(route.options.version).toEqual(1);
    });
  });

  // --------------------------------------------------
  // - Adapter Management
  // --------------------------------------------------
  describe("Adapter Management", () => {
    let capturedApplyEvents = [];
    let initializedRouter;
    let newRouter; // This router will remain uninitialized

    beforeEach(async () => {
      // Use the outer router which is re-instantiated in the outer beforeEach.
      // Initialize this router for these tests.
      await router.initialize();
      initializedRouter = router;
      // Create a new router instance that is NOT initialized, for testing the NOT_INITIALIZED error.
      newRouter = new CoreRouter(deps);

      capturedApplyEvents = [];
      initializedRouter.on("routes:applied", (event) => {
        capturedApplyEvents.push({ name: "routes:applied", data: event });
      });
    });

    test("should throw error when adapter name is missing", () => {
      expect(() => {
        router.registerAdapter("", { applyRoutes: () => Promise.resolve() });
      }).toThrow(RouterError);
      try {
        router.registerAdapter("", { applyRoutes: () => Promise.resolve() });
      } catch (error) {
        // Expect error code with prefix.
        expect(error.code).toEqual("ROUTER_INVALID_ADAPTER_NAME");
      }
    });

    test("should throw error when adapter does not implement applyRoutes", () => {
      expect(() => {
        router.registerAdapter("dummyAdapter", {});
      }).toThrow(RouterError);
      try {
        router.registerAdapter("dummyAdapter", {});
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_ADAPTER");
      }
    });

    test("should register a valid adapter and record metric and emit event", () => {
      const dummyAdapter = {
        applyRoutes: async (framework, routes) => {
          return { frameworkApplied: true, routesApplied: routes.length };
        },
      };

      let adapterEvent;
      router.once("adapter:registered", (event) => {
        adapterEvent = event;
      });

      router.registerAdapter("dummyAdapter", dummyAdapter);
      expect(router.adapters.has("dummyAdapter")).toEqual(true);

      const metric = router.state.metrics.get("adapters.registered");
      expect(metric).toBeDefined();
      expect(metric.tags.adapterName).toEqual("dummyAdapter");

      // Verify that the "adapter:registered" event was emitted.
      expect(adapterEvent).toBeDefined();
      expect(adapterEvent.name).toEqual("dummyAdapter");
    });

    test("should throw NOT_INITIALIZED error when applyRoutes is called before initialization", async () => {
      await expect(newRouter.applyRoutes({}, "dummyAdapter")).rejects.toThrow(
        RouterError
      );
      try {
        await newRouter.applyRoutes({}, "dummyAdapter");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
      }
    });

    test("should throw INVALID_FRAMEWORK error when no framework is provided", async () => {
      await expect(
        initializedRouter.applyRoutes(null, "dummyAdapter")
      ).rejects.toThrow(RouterError);
      try {
        await initializedRouter.applyRoutes(null, "dummyAdapter");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_FRAMEWORK");
      }
    });

    test("should throw ADAPTER_NOT_FOUND error when adapter is missing", async () => {
      await expect(
        initializedRouter.applyRoutes({}, "nonexistentAdapter")
      ).rejects.toThrow(RouterError);
      try {
        await initializedRouter.applyRoutes({}, "nonexistentAdapter");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_ADAPTER_NOT_FOUND");
      }
    });

    test("should successfully apply routes using a valid adapter", async () => {
      // Register a dummy adapter that applies routes and returns a result.
      const dummyAdapter = {
        applyRoutes: async (framework, routes) => {
          return { applied: true, count: routes.length };
        },
      };
      initializedRouter.registerAdapter("dummyAdapter", dummyAdapter);
      // Register a couple of routes.
      initializedRouter.registerRoute("mod1", "GET", "/test1", () => {});
      initializedRouter.registerRoute("mod1", "POST", "/test2", () => {});
      const frameworkDummy = {}; // Dummy framework object
      const result = await initializedRouter.applyRoutes(
        frameworkDummy,
        "dummyAdapter"
      );
      expect(result).toEqual({ applied: true, count: 2 });

      const metric = initializedRouter.state.metrics.get("routes.applied");
      expect(metric).toBeDefined();
      expect(metric.value).toEqual(2);

      const events = capturedApplyEvents.filter(
        (e) => e.name === "routes:applied"
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].data.adapter).toEqual("dummyAdapter");
      expect(events[0].data.count).toEqual(2);
    });

    test("should handle errors thrown by adapter.applyRoutes and throw ROUTES_APPLICATION_FAILED error", async () => {
      // Register an adapter that throws an error.
      const faultyAdapter = {
        applyRoutes: async () => {
          throw new Error("Adapter failure");
        },
      };
      initializedRouter.registerAdapter("faultyAdapter", faultyAdapter);
      initializedRouter.registerRoute("mod1", "GET", "/dummy", () => {});
      await expect(
        initializedRouter.applyRoutes({}, "faultyAdapter")
      ).rejects.toThrow(RouterError);
      try {
        await initializedRouter.applyRoutes({}, "faultyAdapter");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_ROUTES_APPLICATION_FAILED");
      }
    });
  });

  // --------------------------------------------------
  // - Middleware Management
  // --------------------------------------------------
  describe("Middleware Management", () => {
    beforeEach(async () => {
      if (!router.initialized) {
        await router.initialize();
      }
      // Clear any previously registered middleware
      router.middleware.clear();
    });

    test("should throw error when middleware name is missing", () => {
      expect(() => {
        router.registerMiddleware("", () => {});
      }).toThrow(RouterError);
      try {
        router.registerMiddleware("", () => {});
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_MIDDLEWARE_NAME");
      }
    });

    test("should throw error when middleware handler is not a function", () => {
      expect(() => {
        router.registerMiddleware("mw1", "not a function");
      }).toThrow(RouterError);
      try {
        router.registerMiddleware("mw1", "not a function");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_MIDDLEWARE");
      }
    });

    test("should register valid middleware with default order", () => {
      router.registerMiddleware("mw1", () => {});
      const mw = router.middleware.get("mw1");
      expect(mw).toBeDefined();
      expect(mw.order).toEqual(100);
    });

    test("should register valid middleware with specified order", () => {
      router.registerMiddleware("mw2", () => {}, { order: 50 });
      const mw = router.middleware.get("mw2");
      expect(mw).toBeDefined();
      expect(mw.order).toEqual(50);
    });

    test("getMiddlewareForRoute should return global and route-specific middleware, sorted by order", () => {
      // Register global middleware
      router.registerMiddleware("global1", () => {}, { order: 150 });
      router.registerMiddleware("global2", () => {}, { order: 50 });
      router.registerMiddleware("global3", () => {}, { order: 100 });
      const route = {
        method: "GET",
        path: "/test",
        options: { middleware: ["global1"] },
      };
      const middlewareArray = router.getMiddlewareForRoute(route);
      expect(middlewareArray.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < middlewareArray.length; i++) {
        expect(middlewareArray[i].order).toBeGreaterThanOrEqual(
          middlewareArray[i - 1].order
        );
      }
    });

    test("getMiddlewareForRoute should include global middleware when route.options.middleware is undefined", () => {
      // Clear any pre-registered middleware.
      router.middleware.clear();

      // Register a global middleware.
      router.registerMiddleware("globalOnly", () => {}, { order: 50 });

      // Create a route without specifying a middleware array.
      const route = {
        method: "GET",
        path: "/norange",
        options: {}, // No 'middleware' property defined.
      };

      // Call getMiddlewareForRoute, which should:
      // - Set routeMiddleware to [] (since options.middleware is undefined)
      // - Iterate over global middleware and add entries if shouldApplyMiddleware returns true.
      const mwArray = router.getMiddlewareForRoute(route);
      expect(mwArray.length).toEqual(1);
      expect(mwArray[0].name).toEqual("globalOnly");
    });

    test("should include global middleware and add route-specific middleware if present", () => {
      // Register two global middleware entries.
      router.registerMiddleware("globalA", () => {}, { order: 80 });
      router.registerMiddleware("globalB", () => {}, { order: 120 });

      // Create a route whose options specify a middleware that is registered.
      const route = {
        method: "GET",
        path: "/example",
        options: { middleware: ["globalA"] },
      };

      const mwArray = router.getMiddlewareForRoute(route);

      // Global loop: both globalA and globalB are added.
      // Route-specific loop: 'globalA' is added again since it exists.
      // Total expected count: 3 middleware entries.
      expect(mwArray.length).toEqual(3);

      const globalAEntries = mwArray.filter((mw) => mw.name === "globalA");
      expect(globalAEntries.length).toEqual(2);

      const globalBEntries = mwArray.filter((mw) => mw.name === "globalB");
      expect(globalBEntries.length).toEqual(1);
    });

    test("should not add route-specific middleware if not registered in global middleware", () => {
      // Register one global middleware.
      router.registerMiddleware("globalX", () => {}, { order: 100 });
      // Create a route with a middleware name that is not registered.
      const route = {
        method: "GET",
        path: "/test",
        options: { middleware: ["nonexistent"] },
      };
      const mwArray = router.getMiddlewareForRoute(route);
      // Expect the route-specific branch to be executed but not add an entry for 'nonexistent'.
      expect(mwArray.find((mw) => mw.name === "nonexistent")).toBeUndefined();
      // However, global middleware 'globalX' should be added if shouldApplyMiddleware returns true.
      expect(mwArray.find((mw) => mw.name === "globalX")).toBeDefined();
    });

    test("should not include global middleware when shouldApplyMiddleware returns false", () => {
      // Clear any pre-registered middleware.
      router.middleware.clear();

      // Register a global middleware with a path pattern that won't match the route.
      router.registerMiddleware("globalAdmin", () => {}, {
        paths: ["admin/*"],
      });

      // Create a route that does not match the "admin/*" pattern.
      const route = {
        method: "GET",
        path: "/user/profile",
        options: {}, // No middleware array specified.
      };

      // Call getMiddlewareForRoute; the global middleware should not be added.
      const mwArray = router.getMiddlewareForRoute(route);

      // Expect no middleware to be included since the condition (line 369) fails.
      expect(mwArray.length).toEqual(0);
    });

    test("should return true in shouldApplyMiddleware if no paths/methods specified", () => {
      const mwObj = { options: {} };
      const route = { method: "GET", path: "/any" };
      expect(router.shouldApplyMiddleware("dummy", mwObj, route)).toEqual(true);
    });

    test("should correctly match path with wildcard using pathMatchesPattern", () => {
      expect(router.pathMatchesPattern("api/test", "api/*")).toEqual(true);
      expect(router.pathMatchesPattern("apix/test", "api/*")).toEqual(false);
      expect(router.pathMatchesPattern("api/test", "api/test")).toEqual(true);
      expect(router.pathMatchesPattern("api/test2", "api/test")).toEqual(false);
    });

    test("should check middleware with paths and methods correctly", () => {
      const mwObj = { options: { paths: ["api/*"], methods: ["GET"] } };
      const routeMatching = { method: "GET", path: "api/users" };
      const routeNotMatchingPath = { method: "GET", path: "app/users" };
      const routeNotMatchingMethod = { method: "POST", path: "api/users" };
      expect(
        router.shouldApplyMiddleware("dummy", mwObj, routeMatching)
      ).toEqual(true);
      expect(
        router.shouldApplyMiddleware("dummy", mwObj, routeNotMatchingPath)
      ).toEqual(false);
      expect(
        router.shouldApplyMiddleware("dummy", mwObj, routeNotMatchingMethod)
      ).toEqual(false);
    });

    test("should check only methods when paths is falsy but methods exists", () => {
      // Create middleware with methods but no paths
      const middleware = {
        handler: () => {},
        options: {
          methods: ["GET"], // Define methods but not paths
          // paths is intentionally omitted
        },
      };

      // Create a route that matches the method
      const route = {
        method: "GET",
        path: "/any/path", // Path doesn't matter since we're testing method matching
      };

      // This should cover the false branch of if(middleware.options.paths)
      // and then continue with method checking
      const result = router.shouldApplyMiddleware(
        "test-middleware",
        middleware,
        route
      );

      // Should return true because method matches
      expect(result).toBe(true);
    });

    test("should return true when methods is falsy after path check passes", () => {
      // Create middleware with paths but no methods
      const middleware = {
        handler: () => {},
        options: {
          paths: ["/api/*"], // Define paths that will match
          // methods is intentionally omitted
        },
      };

      // Create a route that matches the path pattern
      const route = {
        method: "GET",
        path: "/api/users", // Path matches the pattern
      };

      // This should pass the paths check and then take the false branch for if(middleware.options.methods)
      const result = router.shouldApplyMiddleware(
        "test-middleware",
        middleware,
        route
      );

      // Should return true because path matches and methods condition is skipped
      expect(result).toBe(true);
    });
  });

  // --------------------------------------------------
  // - Error Handling
  // --------------------------------------------------
  describe("Error Handling", () => {
    test("should update state and record metrics on initialization failure without logging to console", async () => {
      // Create a silent logger to prevent console.error output in this test.
      const silentLogger = { error: () => {}, info: () => {}, log: () => {} };

      // Create an error system using the silent logger.
      const silentErrorSystem = createErrorSystem({ logger: silentLogger });
      await silentErrorSystem.initialize();

      // Create a dummy event bus that throws an error on subscribe.
      const faultyEventBus = {
        subscribe: () => {
          throw new Error("Subscription failed");
        },
      };
      const faultyEventBusSystem = {
        getEventBus: () => faultyEventBus,
      };

      // Use the same config.
      const faultyDeps = {
        errorSystem: silentErrorSystem,
        eventBusSystem: faultyEventBusSystem,
        config,
      };

      // Create a new CoreRouter instance with the faulty dependencies.
      const faultyRouter = new CoreRouter(faultyDeps);

      try {
        await faultyRouter.initialize();
        throw new Error("Initialization should have failed");
      } catch (error) {
        // Assert that the router's state is set to "error"
        expect(faultyRouter.state.status).toEqual("error");

        // Verify that an error is recorded with context phase "initialization"
        const recordedError = faultyRouter.state.errors.find(
          (e) => e.context && e.context.phase === "initialization"
        );
        expect(recordedError).toBeDefined();
        expect(recordedError.error).toEqual("Subscription failed");

        // Verify that the metric "router.initialization.failed" is recorded with value 1
        const metric = faultyRouter.state.metrics.get(
          "router.initialization.failed"
        );
        expect(metric).toBeDefined();
        expect(metric.value).toEqual(1);

        // Ensure the thrown error message matches the simulated error
        expect(error.message).toEqual("Subscription failed");
      } finally {
        await silentErrorSystem.shutdown();
      }
    });

    test("should trim error history to 100 entries when more than 100 errors are recorded", async () => {
      await router.initialize();
      // Replace the error system's logger with a silent logger to hide logs.
      const originalLogger = router.deps.errorSystem.logger;
      router.deps.errorSystem.logger = {
        error: () => {},
        info: () => {},
        log: () => {},
      };

      // Add 101 errors via handleError
      for (let i = 0; i < 101; i++) {
        await router.handleError(new Error(`Test error ${i}`), {
          testIndex: i,
        });
      }
      // The error history should have been trimmed to 100 entries.
      expect(router.state.errors.length).toEqual(100);
      // The first error in the history should now be "Test error 1", meaning "Test error 0" was removed.
      expect(router.state.errors[0].error).toEqual("Test error 1");

      // Restore the original logger after test.
      router.deps.errorSystem.logger = originalLogger;
    });

    test("should log error handling failure if errorSystem.handleError throws, without logging to console", async () => {
      // Create a silent logger to prevent console.error output.
      const silentLogger = { error: () => {}, info: () => {}, log: () => {} };

      // Create a dummy error system that always throws an error when handleError is called.
      const throwingErrorSystem = {
        logger: silentLogger,
        handleError: async () => {
          throw new Error("Error system failure");
        },
      };

      // Create new dependencies with the faulty error system.
      const localDeps = { ...deps, errorSystem: throwingErrorSystem };
      // Create a new CoreRouter instance using these dependencies.
      const routerWithFaultyErrorSystem = new CoreRouter(localDeps);

      // Initialize the router.
      await routerWithFaultyErrorSystem.initialize();

      // Clear any existing errors.
      routerWithFaultyErrorSystem.state.errors = [];

      // Trigger handleError by manually calling it.
      const testError = new Error("Original test error");
      await routerWithFaultyErrorSystem.handleError(testError, {
        custom: "data",
      });

      // Verify that an error was logged from the catch block.
      const loggedError = routerWithFaultyErrorSystem.state.errors.find(
        (e) => e.context && e.context.phase === "error-handling"
      );
      expect(loggedError).toBeDefined();
      expect(loggedError.error).toEqual("Error system failure");
    });

    test('should handle errors gracefully when errorSystem is missing', async () => {
      // Create a router without an errorSystem
      const routerWithoutErrorSystem = new CoreRouter({
        eventBusSystem,
        config
        // Intentionally omit errorSystem
      });
      
      await routerWithoutErrorSystem.initialize();
      
      // Clear any existing errors
      routerWithoutErrorSystem.state.errors = [];
      
      // Call handleError, which should not throw even without errorSystem
      await routerWithoutErrorSystem.handleError(new Error('Test error'), { test: true });
      
      // Verify error was added to state
      expect(routerWithoutErrorSystem.state.errors.length).toEqual(1);
      expect(routerWithoutErrorSystem.state.errors[0].error).toEqual('Test error');
      expect(routerWithoutErrorSystem.state.errors[0].context.test).toEqual(true);
      
      // Clean up
      await routerWithoutErrorSystem.shutdown();
    });
  });

  // --------------------------------------------------
  // - Event Emission & Handling
  // --------------------------------------------------
  describe("Event Emission & Handling", () => {
    beforeEach(async () => {
      // Ensure the router is initialized
      if (!router.initialized) {
        await router.initialize();
      }
    });

    describe("Event Handler Registration", () => {
      test("should register a route when event data is valid", async () => {
        const eventData = {
          moduleId: "mod1",
          method: "GET",
          path: "/reg",
          handler: () => {},
          options: {},
        };
        const event = { data: eventData };
        await router.handleRouteRegistration(event);
        const route = router.getRoute("GET", "/reg");
        expect(route).toBeDefined();
        expect(route.moduleId).toEqual("mod1");
      });

      test("should handle errors thrown during route registration", async () => {
        // Temporarily override registerRoute to force an error.
        const originalRegisterRoute = router.registerRoute;
        router.registerRoute = () => {
          throw new Error("Forced registration error");
        };

        const eventData = {
          moduleId: "mod1",
          method: "GET",
          path: "/error",
          handler: () => {},
          options: {},
        };
        const event = { data: eventData };

        // Clear any existing errors.
        router.state.errors = [];
        await router.handleRouteRegistration(event);

        // Verify that an error was logged with context handler 'handleRouteRegistration'
        const loggedError = router.state.errors.find(
          (e) => e.context && e.context.handler === "handleRouteRegistration"
        );
        expect(loggedError).toBeDefined();
        expect(loggedError.error).toEqual("Forced registration error");

        // Restore the original function.
        router.registerRoute = originalRegisterRoute;
      });
    });

    describe("Event Handler: Routes Clear", () => {
      test("should clear all routes when invoked", async () => {
        // Register a couple of routes.
        router.registerRoute("mod1", "GET", "/clear1", () => {});
        router.registerRoute("mod1", "POST", "/clear2", () => {});
        expect(router.getRoutes().length).toBeGreaterThan(0);
        await router.handleRoutesClear();
        expect(router.getRoutes().length).toEqual(0);
      });

      test("should handle errors during clearRoutes", async () => {
        // Temporarily override clearRoutes to force an error.
        const originalClearRoutes = router.clearRoutes;
        router.clearRoutes = () => {
          throw new Error("Forced clear error");
        };

        // Clear errors before test.
        router.state.errors = [];
        await router.handleRoutesClear();
        const loggedError = router.state.errors.find(
          (e) => e.context && e.context.handler === "handleRoutesClear"
        );
        expect(loggedError).toBeDefined();
        expect(loggedError.error).toEqual("Forced clear error");

        // Restore the original function.
        router.clearRoutes = originalClearRoutes;
      });
    });

    describe("Event Handler: Module Unregister", () => {
      test("should unregister all routes for a module when event data is valid", async () => {
        // Register routes for two modules.
        router.registerRoute("mod1", "GET", "/m1-route1", () => {});
        router.registerRoute("mod1", "POST", "/m1-route2", () => {});
        router.registerRoute("mod2", "GET", "/m2-route", () => {});
        expect(router.getModuleRoutes("mod1").length).toEqual(2);
        const event = { data: { moduleId: "mod1" } };
        await router.handleModuleUnregister(event);
        expect(router.getModuleRoutes("mod1").length).toEqual(0);
        // Ensure mod2 routes still exist.
        expect(router.getModuleRoutes("mod2").length).toEqual(1);
      });

      test("should handle errors during module unregister", async () => {
        // Temporarily override unregisterModuleRoutes to force an error.
        const originalUnregisterModuleRoutes = router.unregisterModuleRoutes;
        router.unregisterModuleRoutes = () => {
          throw new Error("Forced unregister error");
        };

        // Clear errors before test.
        router.state.errors = [];
        const event = { data: { moduleId: "mod1" } };
        await router.handleModuleUnregister(event);
        const loggedError = router.state.errors.find(
          (e) => e.context && e.context.handler === "handleModuleUnregister"
        );
        expect(loggedError).toBeDefined();
        expect(loggedError.error).toEqual("Forced unregister error");

        // Restore the original function.
        router.unregisterModuleRoutes = originalUnregisterModuleRoutes;
      });
    });

    test('should use empty object as context when context is falsy', async () => {
      // Create a new router for isolation
      const testRouter = new CoreRouter(deps);
      await testRouter.initialize();
      
      // Clear any existing errors
      testRouter.state.errors = [];
      
      // Call handleError with null context
      await testRouter.handleError(new Error('Test error'), null);
      
      // Verify error was added with empty object as context
      expect(testRouter.state.errors.length).toEqual(1);
      expect(testRouter.state.errors[0].error).toEqual('Test error');
      expect(testRouter.state.errors[0].context).toEqual({});
      
      await testRouter.shutdown();
    });
  
    test('should handle various ways of calling handleError', async () => {
      // Create a new router for isolation
      const testRouter = new CoreRouter(deps);
      await testRouter.initialize();
      
      // Clear any existing errors
      testRouter.state.errors = [];
      
      // Different ways to call handleError to get branching coverage
      const error = new Error('Branch test');
      
      // Call with no context (uses default parameter)
      await testRouter.handleError(error);
      
      // Call with explicit undefined
      await testRouter.handleError(error, undefined);
      
      // Call with a context
      await testRouter.handleError(error, { source: 'test' });
      
      // Verify all errors were recorded
      expect(testRouter.state.errors.length).toEqual(3);
      
      await testRouter.shutdown();
    });
  });

  // --------------------------------------------------
  // - Health Monitoring
  // --------------------------------------------------
  describe("Health Monitoring", () => {
    test("should register default health checks and return healthy status after initialization", async () => {
      await router.initialize();
      const health = await router.checkHealth();
      expect(health.name).toEqual("CoreRouter");
      expect(health.status).toEqual("healthy");
      expect(health.checks).toHaveProperty("state");
      expect(health.checks).toHaveProperty("routes");
      expect(health.checks).toHaveProperty("adapters");
    });

    test('should correctly count routes by method in the "routes" health check', async () => {
      await router.initialize();
      // Register multiple routes with different HTTP methods.
      router.registerRoute("mod1", "GET", "/route1", () => {});
      router.registerRoute("mod1", "GET", "/route2", () => {});
      router.registerRoute("mod1", "POST", "/route3", () => {});

      // Invoke the health check for routes.
      const health = await router.checkHealth();
      const routesHealth = health.checks.routes;

      // Expect total routes count to be 3.
      expect(routesHealth.count).toEqual(3);
      // Expect "GET" routes to count as 2 and "POST" as 1.
      expect(routesHealth.byMethod).toEqual({
        GET: 2,
        POST: 1,
      });
    });

    test("should throw error when registering a health check with a non-function", () => {
      // Expect that passing a non-function throws a RouterError with code "ROUTER_INVALID_HANDLER"
      expect(() => {
        router.registerHealthCheck("testHealth", "not a function");
      }).toThrow(RouterError);

      try {
        router.registerHealthCheck("testHealth", "not a function");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_HANDLER");
      }
    });

    test("should register a valid health check function", () => {
      const dummyCheck = async () => ({ status: "healthy" });
      router.registerHealthCheck("dummyCheck", dummyCheck);
      expect(router.state.healthChecks.has("dummyCheck")).toBe(true);
    });

    test("should mark overall status as unhealthy if a health check returns non-healthy status", async () => {
      // Register a custom health check that returns a non-healthy status
      router.registerHealthCheck("customCheck", async () => {
        return { status: "unhealthy", detail: "custom failure" };
      });
      await router.initialize();
      const health = await router.checkHealth();

      // Overall health should be "unhealthy"
      expect(health.status).toEqual("unhealthy");
      // The custom check should reflect the non-healthy result
      expect(health.checks.customCheck.status).toEqual("unhealthy");
      expect(health.checks.customCheck.detail).toEqual("custom failure");
    });

    test("should mark overall status as unhealthy if a health check throws an error", async () => {
      // Register a health check that throws an error
      router.registerHealthCheck("failingCheck", async () => {
        throw new Error("Health check failure");
      });
      await router.initialize();
      const health = await router.checkHealth();

      // Overall health should be "unhealthy"
      expect(health.status).toEqual("unhealthy");
      // The failing check should have status "error" with the error message recorded
      expect(health.checks.failingCheck.status).toEqual("error");
      expect(health.checks.failingCheck.error).toEqual("Health check failure");
    });

    test('should return "unhealthy", zero uptime, and current errorCount when not initialized', async () => {
      const testRouter = new CoreRouter(deps);
      // Retrieve the default health check for "state"
      const stateHealthCheck = testRouter.state.healthChecks.get("state");
      expect(stateHealthCheck).toBeDefined();

      // Call the health check without initializing the router.
      const health = await stateHealthCheck();
      expect(health.status).toEqual("unhealthy");
      expect(health.uptime).toEqual(0);
      expect(health.errorCount).toEqual(testRouter.state.errors.length);
    });

    test('should return "healthy" and non-zero uptime after initialization', async () => {
      const testRouter = new CoreRouter(deps);
      await testRouter.initialize();
      // Wait a brief moment to allow uptime to increase.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const stateHealthCheck = testRouter.state.healthChecks.get("state");
      const health = await stateHealthCheck();
      expect(health.status).toEqual("healthy");
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.errorCount).toEqual(testRouter.state.errors.length);
      await testRouter.shutdown();
    });
  });

  // --------------------------------------------------
  // - Metrics Recording
  // --------------------------------------------------
  describe("Metrics Recording", () => {
    test("should record metrics when a route is registered", async () => {
      await router.initialize();
      const initialMetric = router.state.metrics.get("routes.registered");
      router.registerRoute("mod1", "GET", "/metrics", () => {});
      const updatedMetric = router.state.metrics.get("routes.registered");
      const initialValue = initialMetric ? initialMetric.value : 0;
      expect(updatedMetric.value).toEqual(initialValue + 1);
    });
  });

  // --------------------------------------------------
  // - OpenAPI Documentation
  // --------------------------------------------------
  describe("OpenAPI Documentation", () => {
    beforeEach(async () => {
      // Ensure the router is initialized
      if (!router.initialized) {
        await router.initialize();
      }
    });

    test("generateOpenApiDoc should produce an OpenAPI document with correct structure", () => {
      // Register a route with tags and summary
      router.registerRoute("mod1", "GET", "/items/:id", () => {}, {
        tags: ["Items"],
        summary: "Get item by ID",
        description: "Retrieves an item using its unique identifier",
        auth: true,
      });
      const doc = router.generateOpenApiDoc({
        title: "Test API",
        version: "1.0.0",
        description: "Test API Documentation",
      });
      expect(doc).toHaveProperty("openapi", "3.0.0");
      expect(doc.info.title).toEqual("Test API");
      // Check that the path has been converted correctly (e.g., :id -> {id})
      const paths = doc.paths;
      const keys = Object.keys(paths);
      const expectedPath = "/items/{id}";
      expect(keys).toContain(expectedPath);
      // Check that the operation object is defined for GET
      expect(paths[expectedPath]).toHaveProperty("get");
      const operation = paths[expectedPath].get;
      expect(operation.tags).toEqual(["Items"]);
      expect(operation.summary).toEqual("Get item by ID");
      expect(operation.description).toEqual(
        "Retrieves an item using its unique identifier"
      );
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      // Check that tags are correctly built in the OpenAPI document
      expect(doc.tags).toEqual([{ name: "Items" }]);
    });

    test("should generate OpenAPI document with routes containing path parameters and auth", async () => {
      // Make sure the router is initialized first
      if (!router.initialized) {
        await router.initialize();
      }

      // Register routes with various options to cover branches

      // Route with path parameter and auth
      router.registerRoute("mod1", "GET", "/users/:id", () => {}, {
        auth: true,
        tags: ["Users"],
        summary: "Get user by ID",
        description: "Retrieves a user",
      });

      // Route without tags or auth
      router.registerRoute("mod1", "POST", "/items", () => {}, {
        summary: "Create item",
        // No tags or auth
      });

      // Generate OpenAPI doc
      const doc = router.generateOpenApiDoc();

      // Verify path parameters are converted
      expect(doc.paths).toHaveProperty("/users/{id}");
      expect(doc.paths["/users/{id}"].get.parameters[0]).toEqual({
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      });

      // Verify security for route with auth
      expect(doc.paths["/users/{id}"].get.security).toEqual([
        { bearerAuth: [] },
      ]);

      // Verify no security for route without auth
      expect(doc.paths["/items"].post.security).toEqual([]);

      // Verify default values are used
      expect(doc.info.title).toEqual("API Documentation");
      expect(doc.info.version).toEqual("1.0.0");

      // Verify tags are extracted
      expect(doc.tags).toContainEqual({ name: "Users" });
    });

    test("should handle duplicate paths and missing options in OpenAPI generation", async () => {
      // Make sure the router is initialized first
      if (!router.initialized) {
        await router.initialize();
      }

      // First, register a route with a specific path
      router.registerRoute("mod1", "GET", "/api/test", () => {}, {
        tags: ["Test"],
        summary: "Test summary",
        description: "Test description",
        auth: true,
      });

      // Then register another route with the same path but different method
      // This will test the false branch of if (!paths[openApiPath])
      router.registerRoute("mod1", "POST", "/api/test", () => {}, {
        // Don't provide tags, summary or description to test the default values (|| []/'' branches)
      });

      // Generate OpenAPI doc
      const doc = router.generateOpenApiDoc();

      // Verify the path was added only once (testing line 655 branch)
      expect(Object.keys(doc.paths)).toHaveLength(1);
      expect(doc.paths).toHaveProperty("/api/test");

      // Verify both methods exist for the path
      expect(doc.paths["/api/test"]).toHaveProperty("get");
      expect(doc.paths["/api/test"]).toHaveProperty("post");

      // Verify the GET method has the provided values
      expect(doc.paths["/api/test"].get.tags).toEqual(["Test"]);
      expect(doc.paths["/api/test"].get.summary).toEqual("Test summary");
      expect(doc.paths["/api/test"].get.description).toEqual(
        "Test description"
      );
      expect(doc.paths["/api/test"].get.security).toEqual([{ bearerAuth: [] }]);

      // Verify the POST method has the default values (testing line 662 and subsequent branches)
      expect(doc.paths["/api/test"].post.tags).toEqual([]);
      expect(doc.paths["/api/test"].post.summary).toEqual("");
      expect(doc.paths["/api/test"].post.description).toEqual("");
      expect(doc.paths["/api/test"].post.security).toEqual([]);
    });
  });

  //////////////


});
