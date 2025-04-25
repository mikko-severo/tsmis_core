/**
 * TESTS
 *
 * The tests are organized into the following sections:
 * - Initialization & Lifecycle: Tests for constructor, initialization, lifecycle hooks, and shutdown.
 * - Dependency Validation: Tests that missing or invalid dependencies cause errors.
 * - Route Management: Tests for route registration, retrieval, versioning, unregistration, and clearing.
 * - Adapter Management: Tests for adapter registration and route application.
 * - Middleware Management: Tests for middleware registration and proper ordering.
 * - Health Monitoring & Metrics: Tests for health checks, status reporting, and metrics recording.
 * - OpenAPI Documentation: Tests for generating OpenAPI documentation.
 * - Error Handling: Tests for error propagation and handling during various operations.
 * - Shutdown and Factory Function: Tests for system shutdown process and factory function.
 */

import { EventEmitter } from "events";
import assert from "assert";
import { CoreRouter } from "../../../src/core/router/Router.js";
import { createErrorSystem } from "../../../src/core/errors/ErrorSystem.js";
import { RouterError } from "../../../src/core/errors/types/RouterError.js";
import {
  RouterSystem,
  createRouterSystem,
} from "../../../src/core/router/RouterSystem.js";

// Hide console logs during tests
let originalConsoleLog, originalConsoleError, originalConsoleInfo;
beforeAll(() => {
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalConsoleInfo = console.info;
  console.log = () => {};
  console.error = () => {};
  console.info = () => {};
});
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.info = originalConsoleInfo;
});

// Dummy EventBus for testing purposes
class DummyEventBus extends EventEmitter {
  subscribe(eventName, handler) {
    this.on(eventName, handler);
    // Return a dummy subscription identifier
    return { eventName, handler };
  }
  unsubscribe(subscription) {
    this.removeListener(subscription.eventName, subscription.handler);
  }
}
const createDummyEventBusSystem = () => ({
  getEventBus: () => new DummyEventBus(),
});

describe("RouterSystem Component", () => {
  let routerSystem;
  let errorSystem;
  let eventBusSystem;
  let config;
  let deps;
  let capturedEvents = [];
  let eventBus;

  beforeEach(async () => {
    // Create real error system and initialize it
    errorSystem = createErrorSystem({ logger: console });
    await errorSystem.initialize();

    // Use a dummy event bus system for testing
    eventBusSystem = createDummyEventBusSystem();

    // For testing purposes, use an empty config
    config = {};

    // Set up dependencies as required by RouterSystem
    deps = { errorSystem, eventBusSystem, config };

    // Instantiate a new RouterSystem instance
    routerSystem = new RouterSystem(deps);

    // Setup event tracking for RouterSystem events
    capturedEvents = [];
    routerSystem.on("system:initialized", (event) =>
      capturedEvents.push({ name: "system:initialized", data: event })
    );
    routerSystem.on("system:shutdown", (event) =>
      capturedEvents.push({ name: "system:shutdown", data: event })
    );
  });

  afterEach(async () => {
    if (routerSystem && routerSystem.initialized) {
      await routerSystem.shutdown();
    }
    await errorSystem.shutdown();
  });

  // --------------------------------------------------
  // - Dependency Validation
  // --------------------------------------------------
  describe("Dependency Validation", () => {
    test("should throw error if required dependencies are missing", () => {
      expect(() => {
        new RouterSystem({}); // Missing errorSystem, eventBusSystem, and config
      }).toThrow();
    });

    test("should throw error if eventBusSystem lacks getEventBus", () => {
      const badDeps = { errorSystem, config, eventBusSystem: {} };
      expect(() => {
        new RouterSystem(badDeps);
      }).toThrow(RouterError);
    });

    test("should throw error if errorSystem lacks handleError", () => {
      const badErrorSystem = { logger: console }; // No handleError provided
      const badDeps = { errorSystem: badErrorSystem, config, eventBusSystem };
      expect(() => {
        new RouterSystem(badDeps);
      }).toThrow(RouterError);
    });
  });

  // --------------------------------------------------
  // - Initialization & Lifecycle
  // --------------------------------------------------
  describe("Initialization & Lifecycle", () => {
    test("should instantiate with no router initially and proper state", () => {
      expect(routerSystem.router).toBeNull();
      expect(routerSystem.initialized).toEqual(false);
      expect(routerSystem.state.status).toEqual("created");
    });

    test("should initialize and forward system:initialized event", async () => {
      await routerSystem.initialize();
      expect(routerSystem.initialized).toEqual(true);
      expect(routerSystem.state.status).toEqual("running");
      expect(routerSystem.router).not.toBeNull();
      // Verify that the system-level initialized event was forwarded
      expect(
        capturedEvents.some((e) => e.name === "system:initialized")
      ).toEqual(true);
    });

    test("should not allow double initialization", async () => {
      await routerSystem.initialize();
      await expect(routerSystem.initialize()).rejects.toThrow(RouterError);
    });

    test("should shutdown and update state and router reference", async () => {
      await routerSystem.initialize();
      // Register a dummy route to ensure router functionality
      routerSystem.registerRoute("mod1", "GET", "/test", () => {});
      expect(routerSystem.getRoutes().length).toBeGreaterThan(0);
      await routerSystem.shutdown();
      expect(routerSystem.initialized).toEqual(false);
      expect(routerSystem.router).toBeNull();
      expect(routerSystem.state.status).toEqual("shutdown");
      expect(capturedEvents.some((e) => e.name === "system:shutdown")).toEqual(
        true
      );
    });

    test("should throw error when getRouter is called before initialization", () => {
      expect(() => {
        routerSystem.getRouter();
      }).toThrow(RouterError);
    });

    test("should return the router instance when RouterSystem is initialized", async () => {
      await routerSystem.initialize();
      const returnedRouter = routerSystem.getRouter();
      expect(returnedRouter).toBeDefined();
    });
  });

  // --------------------------------------------------
  // - Route Management
  // --------------------------------------------------
  describe("Route Management", () => {
    beforeEach(async () => {
      if (!routerSystem.initialized) {
        await routerSystem.initialize();
      }
    });

    test("should register a route and reflect it in getRoutes", () => {
      routerSystem.registerRoute("mod1", "GET", "/route1", () => {});
      const routes = routerSystem.getRoutes();
      expect(routes.length).toBeGreaterThanOrEqual(1);
      const route = routes.find((r) => r.path === "/route1");
      expect(route).toBeDefined();
      expect(route.moduleId).toEqual("mod1");
    });

    test("getRoute should return the correct route or null", () => {
      routerSystem.registerRoute("mod1", "POST", "/route2", () => {});
      const route = routerSystem.getRoute("POST", "/route2");
      expect(route).toBeDefined();
      expect(route.moduleId).toEqual("mod1");
      const nonExistent = routerSystem.getRoute("GET", "/nonexistent");
      expect(nonExistent).toBeNull();
    });

    test("should unregister a route correctly", () => {
      routerSystem.registerRoute("mod1", "GET", "/remove", () => {});
      let route = routerSystem.getRoute("GET", "/remove");
      expect(route).toBeDefined();
      const result = routerSystem.unregisterRoute("GET", "/remove");
      expect(result).toEqual(true);
      route = routerSystem.getRoute("GET", "/remove");
      expect(route).toBeNull();
    });

    test("should unregister all routes for a module", () => {
      routerSystem.registerRoute("mod1", "GET", "/r1", () => {});
      routerSystem.registerRoute("mod1", "POST", "/r2", () => {});
      routerSystem.registerRoute("mod2", "GET", "/r3", () => {});
      const count = routerSystem.unregisterModuleRoutes("mod1");
      expect(count).toEqual(2);
      const mod1Routes = routerSystem.getModuleRoutes("mod1");
      expect(mod1Routes.length).toEqual(0);
    });

    test("clearRoutes should remove all routes and record a metric", () => {
      routerSystem.registerRoute("mod1", "GET", "/r1", () => {});
      routerSystem.registerRoute("mod1", "POST", "/r2", () => {});
      expect(routerSystem.getRoutes().length).toBeGreaterThan(0);
      routerSystem.clearRoutes();
      expect(routerSystem.getRoutes().length).toEqual(0);
      const metrics = routerSystem.getMetrics();
      expect(metrics["routersystem.routes.cleared"]).toBeDefined();
    });

    test("should register a versioned route with proper path formatting", () => {
      const handler = () => {};
      routerSystem.registerVersionedRoute("mod1", 2, "GET", "/users", handler);
      const route = routerSystem.getRoute("GET", "/api/v2/users");
      expect(route).toBeDefined();
      expect(route.moduleId).toEqual("mod1");
      expect(route.options.version).toEqual(2);
    });

    test("should throw NOT_INITIALIZED error when registerRoute is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.registerRoute("mod1", "GET", "/test", () => {});
      }).toThrow(RouterError);

      try {
        uninitRouterSystem.registerRoute("mod1", "GET", "/test", () => {});
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should throw NOT_INITIALIZED error when registerVersionedRoute is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.registerVersionedRoute(
          "mod1",
          2,
          "GET",
          "/users",
          () => {}
        );
      }).toThrow(RouterError);

      try {
        uninitRouterSystem.registerVersionedRoute(
          "mod1",
          2,
          "GET",
          "/users",
          () => {}
        );
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.registerVersionedRoute and throw error", async () => {
      // Create a fresh RouterSystem instance that is not related to the outer one.
      const freshRouterSystem = new RouterSystem(deps);
      await freshRouterSystem.initialize();
      // Override the underlying router.registerVersionedRoute to force an error.
      freshRouterSystem.router.registerVersionedRoute = () => {
        throw new Error("Forced versioned route error");
      };

      // Expect registerVersionedRoute to throw the forced error.
      expect(() => {
        freshRouterSystem.registerVersionedRoute(
          "mod1",
          1,
          "GET",
          "/test",
          () => {}
        );
      }).toThrow("Forced versioned route error");

      // Verify that handleError has been called and recorded the error with proper context.
      const recorded = freshRouterSystem.state.errors.find(
        (err) => err.context && err.context.method === "registerVersionedRoute"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when getRoutes is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.getRoutes();
      }).toThrow(RouterError);

      try {
        uninitRouterSystem.getRoutes();
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.getRoutes and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Force the router.getRoutes method to throw an error.
      freshSystem.router.getRoutes = () => {
        throw new Error("Forced getRoutes error");
      };

      // Verify that getRoutes rethrows the error.
      expect(() => {
        freshSystem.getRoutes();
      }).toThrow("Forced getRoutes error");

      // Check that handleError has recorded the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) => err.context && err.context.method === "getRoutes"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when getRoute is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.getRoute("GET", "/test");
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.getRoute("GET", "/test");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.getRoute and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Force the underlying router.getRoute to throw an error.
      freshSystem.router.getRoute = (method, path) => {
        throw new Error("Forced getRoute error");
      };

      // Expect getRoute to throw the forced error.
      expect(() => {
        freshSystem.getRoute("GET", "/dummy");
      }).toThrow("Forced getRoute error");

      // Verify that handleError recorded the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) =>
          err.context &&
          err.context.method === "getRoute" &&
          err.context.routeInfo &&
          err.context.routeInfo.method === "GET" &&
          err.context.routeInfo.path === "/dummy"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when getModuleRoutes is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.getModuleRoutes("mod1");
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.getModuleRoutes("mod1");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.getModuleRoutes and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Force the underlying router.getModuleRoutes to throw an error.
      freshSystem.router.getModuleRoutes = (moduleId) => {
        throw new Error("Forced getModuleRoutes error");
      };

      expect(() => {
        freshSystem.getModuleRoutes("mod1");
      }).toThrow("Forced getModuleRoutes error");

      // Verify that handleError recorded the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) =>
          err.context &&
          err.context.method === "getModuleRoutes" &&
          err.context.moduleId === "mod1"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when unregisterRoute is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.unregisterRoute("GET", "/test");
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.unregisterRoute("GET", "/test");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.unregisterRoute and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Force an error in the underlying router.unregisterRoute call.
      freshSystem.router.unregisterRoute = (method, path) => {
        throw new Error("Forced unregisterRoute error");
      };

      expect(() => {
        freshSystem.unregisterRoute("GET", "/dummy");
      }).toThrow("Forced unregisterRoute error");

      // Verify that handleError logged the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) =>
          err.context &&
          err.context.method === "unregisterRoute" &&
          err.context.routeInfo &&
          err.context.routeInfo.method === "GET" &&
          err.context.routeInfo.path === "/dummy"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when unregisterModuleRoutes is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.unregisterModuleRoutes("mod1");
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.unregisterModuleRoutes("mod1");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.unregisterModuleRoutes and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Override the underlying unregisterModuleRoutes to force an error.
      freshSystem.router.unregisterModuleRoutes = (moduleId) => {
        throw new Error("Forced unregisterModuleRoutes error");
      };

      expect(() => {
        freshSystem.unregisterModuleRoutes("mod1");
      }).toThrow("Forced unregisterModuleRoutes error");

      // Verify that handleError recorded the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) =>
          err.context &&
          err.context.method === "unregisterModuleRoutes" &&
          err.context.moduleId === "mod1"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when clearRoutes is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.clearRoutes();
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.clearRoutes();
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.clearRoutes and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Override router.getRoutes so we can determine a count (simulate non-empty routes)
      freshSystem.router.getRoutes = () => [{ dummy: true }]; // count = 1

      // Override router.clearRoutes to throw an error.
      freshSystem.router.clearRoutes = () => {
        throw new Error("Forced clearRoutes error");
      };

      expect(() => {
        freshSystem.clearRoutes();
      }).toThrow("Forced clearRoutes error");

      // Verify that handleError recorded the error with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) => err.context && err.context.method === "clearRoutes"
      );
      expect(recorded).toBeDefined();
    });

    test("should return false from unregisterRoute when route does not exist", async () => {
      const system = new RouterSystem(deps);
      await system.initialize();

      // Attempt to unregister a non-existent route
      const result = system.unregisterRoute("GET", "/non-existent");

      // This triggers the `else` path in `if (result)` — line 609
      assert.strictEqual(result, false);

      // Ensure no metric was recorded
      const metrics = system.getMetrics();
      assert.ok(!metrics["routersystem.routes.unregistered"]);
    });
  });

  // --------------------------------------------------
  // - Adapter Management
  // --------------------------------------------------
  describe("Adapter Management", () => {
    let capturedApplyEvents = [];
    let initializedSystem;
    let uninitSystem;

    beforeEach(async () => {
      await routerSystem.initialize();
      initializedSystem = routerSystem;
      uninitSystem = new RouterSystem(deps);

      capturedApplyEvents = [];
      initializedSystem.on("routes:applied", (event) => {
        capturedApplyEvents.push({ name: "routes:applied", data: event });
      });
    });

    test("should register a valid adapter and record metric/event", () => {
      const dummyAdapter = {
        applyRoutes: async (framework, routes) => ({
          applied: true,
          count: routes.length,
        }),
      };

      initializedSystem.registerAdapter("dummyAdapter", dummyAdapter);
      // Verify that the underlying router has the adapter registered
      expect(initializedSystem.router.adapters.has("dummyAdapter")).toEqual(
        true
      );
      const metrics = initializedSystem.getMetrics();
      expect(metrics["routersystem.adapters.registered"]).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when applyRoutes is called on an uninitialized system", async () => {
      await expect(
        uninitSystem.applyRoutes({}, "dummyAdapter")
      ).rejects.toThrow(RouterError);
    });

    test("should throw error when invalid framework is provided to applyRoutes", async () => {
      await expect(
        initializedSystem.applyRoutes(null, "dummyAdapter")
      ).rejects.toThrow(RouterError);
    });

    test("should throw ADAPTER_NOT_FOUND error when adapter is missing", async () => {
      await expect(
        initializedSystem.applyRoutes({}, "nonexistentAdapter")
      ).rejects.toThrow(RouterError);
    });

    test("should apply routes successfully using a valid adapter", async () => {
      const dummyAdapter = {
        applyRoutes: async (framework, routes) => ({
          applied: true,
          count: routes.length,
        }),
      };
      initializedSystem.registerAdapter("dummyAdapter", dummyAdapter);
      initializedSystem.registerRoute("mod1", "GET", "/test1", () => {});
      initializedSystem.registerRoute("mod1", "POST", "/test2", () => {});
      const frameworkDummy = {};
      const result = await initializedSystem.applyRoutes(
        frameworkDummy,
        "dummyAdapter"
      );
      expect(result).toEqual({ applied: true, count: 2 });
      const metrics = initializedSystem.getMetrics();
      expect(metrics["routersystem.routes.applied"]).toBeDefined();
      expect(capturedApplyEvents.length).toBeGreaterThan(0);
      expect(capturedApplyEvents[0].data.adapter).toEqual("dummyAdapter");
      expect(capturedApplyEvents[0].data.count).toEqual(2);
    });

    test("should handle errors from adapter.applyRoutes and throw ROUTES_APPLICATION_FAILED", async () => {
      const faultyAdapter = {
        applyRoutes: async () => {
          throw new Error("Adapter failure");
        },
      };
      initializedSystem.registerAdapter("faultyAdapter", faultyAdapter);
      initializedSystem.registerRoute("mod1", "GET", "/dummy", () => {});
      await expect(
        initializedSystem.applyRoutes({}, "faultyAdapter")
      ).rejects.toThrow(RouterError);
    });

    test("should throw NOT_INITIALIZED error when registerAdapter is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.registerAdapter("dummyAdapter", {
          applyRoutes: async () => {},
        });
      }).toThrow(RouterError);

      try {
        uninitRouterSystem.registerAdapter("dummyAdapter", {
          applyRoutes: async () => {},
        });
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });

    test("should handle error from underlying router.registerAdapter and throw error", async () => {
      // Create a fresh RouterSystem instance and initialize it.
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();
      // Force an error in the underlying router.registerAdapter call.
      freshSystem.router.registerAdapter = () => {
        throw new Error("Forced adapter error");
      };

      // Expect registerAdapter to throw the forced error.
      expect(() => {
        freshSystem.registerAdapter("dummyAdapter", {});
      }).toThrow("Forced adapter error");

      // Verify that the error was recorded by handleError with proper context.
      const recorded = freshSystem.state.errors.find(
        (err) =>
          err.context &&
          err.context.method === "registerAdapter" &&
          err.context.adapterName === "dummyAdapter"
      );
      expect(recorded).toBeDefined();
    });
  });

  // --------------------------------------------------
  // - Middleware Management
  // --------------------------------------------------
  describe("Middleware Management", () => {
    beforeEach(async () => {
      if (!routerSystem.initialized) {
        await routerSystem.initialize();
      }
      // Clear any registered middleware in the underlying router
      routerSystem.router.middleware.clear();
    });

    test("should throw error when middleware name is missing", () => {
      expect(() => {
        routerSystem.registerMiddleware("", () => {});
      }).toThrow(RouterError);
    });

    test("should throw error when middleware handler is not a function", () => {
      expect(() => {
        routerSystem.registerMiddleware("mw1", "not a function");
      }).toThrow(RouterError);
    });

    test("should register valid middleware with default order", () => {
      routerSystem.registerMiddleware("mw1", () => {});
      const mw = routerSystem.router.middleware.get("mw1");
      expect(mw).toBeDefined();
      expect(mw.order).toEqual(100);
    });

    test("should register valid middleware with specified order", () => {
      routerSystem.registerMiddleware("mw2", () => {}, { order: 50 });
      const mw = routerSystem.router.middleware.get("mw2");
      expect(mw).toBeDefined();
      expect(mw.order).toEqual(50);
    });

    test("getMiddlewareForRoute should return correctly sorted middleware", () => {
      // Register some global middleware
      routerSystem.registerMiddleware("global1", () => {}, { order: 150 });
      routerSystem.registerMiddleware("global2", () => {}, { order: 50 });
      routerSystem.registerMiddleware("global3", () => {}, { order: 100 });
      const route = {
        method: "GET",
        path: "/test",
        options: { middleware: ["global1"] },
      };
      const mwArray = routerSystem.router.getMiddlewareForRoute(route);
      expect(mwArray.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < mwArray.length; i++) {
        expect(mwArray[i].order).toBeGreaterThanOrEqual(mwArray[i - 1].order);
      }
    });

    test("should throw NOT_INITIALIZED error when registerMiddleware is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);
      expect(() => {
        uninitRouterSystem.registerMiddleware("dummyMiddleware", () => {});
      }).toThrow(RouterError);
      try {
        uninitRouterSystem.registerMiddleware("dummyMiddleware", () => {});
      } catch (error) {
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
        expect(error.details).toHaveProperty(
          "state",
          uninitRouterSystem.state.status
        );
      }
    });
  });

  // --------------------------------------------------
  // - Health Monitoring & Metrics
  // --------------------------------------------------
  describe("Health Monitoring & Metrics", () => {
    beforeEach(async () => {
      if (!routerSystem.initialized) {
        await routerSystem.initialize();
      }
    });

    test("checkHealth should return a proper health check object", async () => {
      const health = await routerSystem.checkHealth();
      expect(health).toHaveProperty("name", "RouterSystem");
      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("details");
    });

    test("getStatus should return system status with uptime and errorCount", () => {
      const status = routerSystem.getStatus();
      expect(status).toHaveProperty("name", "RouterSystem");
      expect(status).toHaveProperty("uptime");
      expect(status).toHaveProperty("initialized", routerSystem.initialized);
      expect(status).toHaveProperty("errorCount");
      expect(status).toHaveProperty("timestamp");
    });

    test("should throw RouterError when registering a health check with a non-function", () => {
      expect(() => {
        routerSystem.registerHealthCheck("invalidCheck", "not_a_function");
      }).toThrow(RouterError);

      try {
        routerSystem.registerHealthCheck("invalidCheck", "not_a_function");
      } catch (error) {
        expect(error.code).toEqual("ROUTER_INVALID_HEALTH_CHECK");
        expect(error.details).toHaveProperty("checkName", "invalidCheck");
      }
    });

    test("should report router health check as unhealthy when initialized but router is null", async () => {
      const localDeps = { errorSystem, eventBusSystem, config };
      // Create a new RouterSystem instance without calling initialize()
      const freshRouterSystem = new RouterSystem(localDeps);
      // Manually mark the system as initialized and override the router to be null
      freshRouterSystem.initialized = true;
      freshRouterSystem.router = null;
      const health = await freshRouterSystem.checkHealth();
      // Verify that the 'router' health check returns the expected object
      expect(health.details).toBeDefined();
      expect(health.details).toHaveProperty("router");
      expect(health.details.router).toEqual({
        status: "unhealthy",
        reason: "Router not initialized",
      });
    });

    test("should return healthy status when router exists but lacks checkHealth function", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();
      // Force the router to have a non-function checkHealth, triggering the else branch.
      freshSystem.router.checkHealth = "invalid";
      const health = await freshSystem.checkHealth();
      expect(health.details).toHaveProperty("router", {
        status: "healthy",
        details: "Router instance exists but does not support health checks",
      });
    });

    test("should return error status when router.checkHealth throws an error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();
      // Override router.checkHealth with a function that throws an error.
      freshSystem.router.checkHealth = async () => {
        throw new Error("Forced error");
      };
      const health = await freshSystem.checkHealth();
      expect(health.details).toHaveProperty("router", {
        status: "error",
        error: "Forced error",
      });
    });

    test("should return an unhealthy health object with reason 'Not initialized' when system is not initialized", async () => {
      // Create a fresh RouterSystem without initializing it.
      const uninitSystem = new RouterSystem(deps);
      const health = await uninitSystem.checkHealth();
      expect(health.name).toEqual("RouterSystem");
      expect(health.status).toEqual("unhealthy");
      expect(health.reason).toEqual("Not initialized");
      expect(health.timestamp).toBeDefined();
    });

    test("should set failing health check result to error when a health check function throws", async () => {
      // Create and initialize a fresh RouterSystem.
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Register a health check that always throws an error.
      freshSystem.registerHealthCheck("failing", async () => {
        throw new Error("Failure in health");
      });

      const health = await freshSystem.checkHealth();
      // Verify that the failing health check is caught and recorded correctly.
      expect(health.details).toHaveProperty("failing");
      expect(health.details.failing).toEqual({
        status: "error",
        error: "Failure in health",
      });
      // The overall status should be "unhealthy" since one health check failed.
      expect(health.status).toEqual("unhealthy");
    });

    test("should register default health check for state", async () => {
      // Create a fresh RouterSystem instance (constructor calls setupDefaultHealthChecks)
      const localRouterSystem = new RouterSystem(deps);

      // Verify that the 'state' health check is registered in the healthChecks map.
      expect(localRouterSystem.state.healthChecks.has("state")).toBe(true);

      // Get the default health check function for 'state' and execute it.
      const stateHealthCheck =
        localRouterSystem.state.healthChecks.get("state");
      const result = await stateHealthCheck();

      // Since the system is not initialized, we expect status to be 'unhealthy'
      expect(result).toHaveProperty("status", "unhealthy");
      // Also, since no startTime is set, uptime should be 0.
      expect(result).toHaveProperty("uptime", 0);
      // And errorCount should be the current number of errors.
      expect(result).toHaveProperty(
        "errorCount",
        localRouterSystem.state.errors.length
      );
    });

    test("should skip setupEventForwarding if router is null", () => {
      const system = new RouterSystem(deps);
      system.router = null; // force router to be null

      // No errors should occur when calling the method
      system.setupEventForwarding();

      // Nothing to assert here — test passes if no crash or emit occurs
    });

    test("getStatus should handle case where startTime is null", () => {
      // Create a new RouterSystem but don't initialize it
      // This means startTime will remain null
      const uninitSystem = new RouterSystem(deps);

      // Get status when not initialized (startTime is null)
      const status = uninitSystem.getStatus();

      // Verify uptime is 0 when startTime is null (line 780 ternary check)
      expect(status.uptime).toEqual(0);
      expect(status.initialized).toEqual(false);
      expect(status.name).toEqual("RouterSystem");
      expect(status.version).toEqual(RouterSystem.version);
    });


  });

  // --------------------------------------------------
  // - OpenAPI Documentation
  // --------------------------------------------------
  describe("OpenAPI Documentation", () => {
    beforeEach(async () => {
      if (!routerSystem.initialized) {
        await routerSystem.initialize();
      }
      // Register a dummy route with OpenAPI options
      routerSystem.registerRoute("mod1", "GET", "/docTest", () => {}, {
        tags: ["test"],
        summary: "Dummy route",
        description: "Route for testing OpenAPI generation",
      });
    });

    test("generateOpenApiDoc should return a valid OpenAPI document", () => {
      const openApiDoc = routerSystem.generateOpenApiDoc({
        title: "Test API",
        version: "1.0.1",
        description: "Test API description",
      });

      expect(openApiDoc).toHaveProperty("openapi", "3.0.0");
      expect(openApiDoc).toHaveProperty("info");
      expect(openApiDoc.info).toHaveProperty("title", "Test API");
      expect(openApiDoc.info).toHaveProperty("version", "1.0.1");
      expect(openApiDoc).toHaveProperty("paths");
      // Verify that at least one route appears in the paths
      const keys = Object.keys(openApiDoc.paths);
      expect(keys.some((key) => key.includes("docTest"))).toEqual(true);
    });

    test("should handle error from underlying router.generateOpenApiDoc and rethrow error", async () => {
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();
      // Override the underlying router.generateOpenApiDoc to throw an error.
      freshSystem.router.generateOpenApiDoc = (info) => {
        throw new Error("Forced OpenApi error");
      };

      // Calling generateOpenApiDoc on an initialized system should now hit the try block,
      // where router.generateOpenApiDoc throws, triggering handleError and then rethrowing.
      expect(() => {
        freshSystem.generateOpenApiDoc({ title: "Test API" });
      }).toThrow("Forced OpenApi error");

      // Verify that handleError recorded the error with the proper context.
      const recorded = freshSystem.state.errors.find(
        (err) => err.context && err.context.method === "generateOpenApiDoc"
      );
      expect(recorded).toBeDefined();
    });

    test("should throw NOT_INITIALIZED error when generateOpenApiDoc is called before initialization", () => {
      const uninitRouterSystem = new RouterSystem(deps);

      // Ensure it's not initialized
      expect(uninitRouterSystem.initialized).toBe(false);

      try {
        uninitRouterSystem.generateOpenApiDoc();
        fail("Should have thrown an error but didn't");
      } catch (error) {
        expect(error instanceof RouterError).toBe(true);
        expect(error.code).toEqual("ROUTER_NOT_INITIALIZED");
      }
    });
  });

  // --------------------------------------------------
  // - Error Handling in Operations
  // --------------------------------------------------
  describe("Error Handling", () => {
    test("should propagate error during registerRoute with invalid parameters", async () => {
      await routerSystem.initialize();
      // Passing an empty moduleId should throw an error
      expect(() => {
        routerSystem.registerRoute("", "GET", "/error", () => {});
      }).toThrow(RouterError);
    });

    test("should trim error history to 100 entries", async () => {
      await routerSystem.initialize();
      // Simulate 101 errors via handleError
      for (let i = 0; i < 101; i++) {
        await routerSystem.handleError(new Error(`Test error ${i}`), {
          testIndex: i,
        });
      }
      expect(routerSystem.state.errors.length).toEqual(100);
      // Verify that the first error was removed (i.e. error 0 gone, so first is Test error 1)
      expect(routerSystem.state.errors[0].error).toEqual("Test error 1");
    });

    test("should log error handling failure if errorSystem.handleError throws", async () => {
      // Create a silent error system that always throws on handleError
      const silentErrorSystem = createErrorSystem({
        logger: { error: () => {}, info: () => {}, log: () => {} },
      });
      await silentErrorSystem.initialize();
      const faultyDeps = {
        errorSystem: {
          logger: silentErrorSystem.logger,
          handleError: async () => {
            throw new Error("Handler failure");
          },
        },
        config,
        eventBusSystem,
      };
      const faultyRouterSystem = new RouterSystem(faultyDeps);
      await faultyRouterSystem.initialize();
      try {
        faultyRouterSystem.registerRoute("mod1", "GET", "/error", () => {});
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
      } finally {
        await silentErrorSystem.shutdown();
      }
    });

    test("should handle error during initialization and throw INITIALIZATION_FAILED", async () => {
      // Create a fresh RouterSystem instance.
      const freshSystem = new RouterSystem(deps);

      // Save the original CoreRouter.initialize method.
      const originalCoreRouterInitialize = CoreRouter.prototype.initialize;
      try {
        // Force the underlying router.initialize to throw an error.
        CoreRouter.prototype.initialize = async () => {
          throw new Error("Forced failure");
        };

        // Expect initialize() to reject with a RouterError having code INITIALIZATION_FAILED.
        await expect(freshSystem.initialize()).rejects.toThrow(RouterError);

        // Verify that the system state is updated to 'error'.
        expect(freshSystem.state.status).toEqual("error");

        // Verify that the error has been recorded in the RouterSystem state.
        const lastError =
          freshSystem.state.errors[freshSystem.state.errors.length - 1];
        expect(lastError.error).toEqual("Forced failure");

        // Verify that the initialization failure metric is recorded.
        const metrics = freshSystem.getMetrics();
        expect(metrics["routersystem.initialization.failed"]).toBeDefined();
        expect(
          metrics["routersystem.initialization.failed"].tags.errorMessage
        ).toEqual("Forced failure");
      } finally {
        // Restore the original CoreRouter.initialize method.
        CoreRouter.prototype.initialize = originalCoreRouterInitialize;
      }
    });

    test("should log error handling failure when errorSystem.handleError throws", async () => {
      // Create a faulty errorSystem that always throws.
      const faultyErrorSystem = {
        handleError: async () => {
          throw new Error("Forced handler error");
        },
        logger: { error: () => {}, info: () => {}, log: () => {} },
      };
      const faultyDeps = {
        errorSystem: faultyErrorSystem,
        eventBusSystem,
        config,
      };
      // Create a fresh RouterSystem instance using the faulty deps.
      const localRouterSystem = new RouterSystem(faultyDeps);
      // Initialize the system normally.
      await localRouterSystem.initialize();

      // Call handleError with a dummy error; this should trigger the catch block.
      await localRouterSystem.handleError(new Error("Original error"), {
        custom: "test",
      });

      // Check that an error has been logged in the state with phase "error-handling"
      const loggedError = localRouterSystem.state.errors.find(
        (err) => err.context && err.context.phase === "error-handling"
      );
      expect(loggedError).toBeDefined();
      expect(loggedError.error).toEqual("Forced handler error");
    });

    test("should fallback to empty context when none is provided in handleError", async () => {
      const localSystem = new RouterSystem(deps);
      const error = new Error("No-context error");

      const before = localSystem.state.errors.length;
      await localSystem.handleError(error); // ❗️No context passed

      const after = localSystem.state.errors.length;
      assert.strictEqual(after, before + 1);

      const last = localSystem.state.errors[after - 1];
      assert.strictEqual(last.error, "No-context error");
      assert.deepStrictEqual(last.context, {}); // ✅ confirms line 282 is used
    });

    test("should hit context fallback in handleError when context is null", async () => {
      const localSystem = new RouterSystem(deps);
      const error = new Error("trigger fallback");

      const before = localSystem.state.errors.length;

      // Explicitly pass `null` to force the fallback logic in `context || {}`
      await localSystem.handleError(error, null);

      const after = localSystem.state.errors.length;
      const logged = localSystem.state.errors[after - 1];

      assert.strictEqual(after, before + 1);
      assert.strictEqual(logged.error, "trigger fallback");
      assert.deepStrictEqual(
        logged.context,
        {},
        "Expected context to fall back to empty object"
      );
    });

    test("should skip errorSystem block when deps.errorSystem is removed post-construction", async () => {
      // Inline subclass to bypass validation but remove errorSystem after init
      class BareRouterSystem extends RouterSystem {
        constructor(eventBusSystem, config) {
          super({
            errorSystem: { handleError: () => {} },
            eventBusSystem,
            config,
          });
          this.deps.errorSystem = undefined; // simulate absence
        }
      }

      const system = new BareRouterSystem(eventBusSystem, config);

      const before = system.state.errors.length;

      const err = new Error("skip errorSystem block");
      await system.handleError(err, { test: "no-errorSystem" });

      const after = system.state.errors.length;
      const recorded = system.state.errors[after - 1];

      assert.strictEqual(after, before + 1);
      assert.strictEqual(recorded.error, "skip errorSystem block");
      assert.deepStrictEqual(recorded.context, { test: "no-errorSystem" });
    });
  });

  // --------------------------------------------------
  // - Shutdown and Factory Function
  // --------------------------------------------------
  describe("Shutdown and Factory Function", () => {
    test("should handle error during shutdown and throw SHUTDOWN_FAILED", async () => {
      // Create a fresh RouterSystem instance and initialize it.
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Override the underlying router.shutdown to force an error.
      freshSystem.router.shutdown = async () => {
        throw new Error("Forced shutdown error");
      };

      // Expect shutdown() to reject with a RouterError indicating shutdown failure.
      await expect(freshSystem.shutdown()).rejects.toThrow(RouterError);

      // Verify that the system state is updated to 'error' and the error context has phase 'shutdown'.
      const errorRecord = freshSystem.state.errors.find(
        (err) => err.context && err.context.phase === "shutdown"
      );
      expect(errorRecord).toBeDefined();

      // Verify that the shutdown failure metric is recorded with errorMessage equal to "Forced shutdown error".
      const metrics = freshSystem.getMetrics();
      expect(metrics["routersystem.shutdown.failed"]).toBeDefined();
      expect(metrics["routersystem.shutdown.failed"].tags.errorMessage).toEqual(
        "Forced shutdown error"
      );
    });

    test("createRouterSystem should throw CREATION_FAILED error when dependencies are invalid", () => {
      expect(() => {
        // This call forces the dependency check in the constructor to throw.
        createRouterSystem({ errorSystem: {} });
      }).toThrow(RouterError);

      try {
        createRouterSystem({ errorSystem: {} });
      } catch (error) {
        expect(error.code).toEqual("ROUTER_CREATION_FAILED");
        // Verify that the error details include the original error message.
        expect(error.details).toHaveProperty("originalError");
      }
    });

    test("should provide a default eventBusSystem when not provided in dependencies", () => {
      // Create a RouterSystem without specifying eventBusSystem
      const system = createRouterSystem({ errorSystem, config });

      // Verify that system.deps has an eventBusSystem with a getEventBus function.
      expect(system.deps).toHaveProperty("eventBusSystem");
      expect(typeof system.deps.eventBusSystem.getEventBus).toEqual("function");

      // Call getEventBus and check that it returns an instance of EventEmitter.
      const bus = system.deps.eventBusSystem.getEventBus();
      expect(bus).toBeInstanceOf(EventEmitter);
    });

    test("createRouterSystem should create system with default errorSystem when not provided", () => {
      // Create a system with only config, no errorSystem
      const system = createRouterSystem({ config: {} });

      // Verify that a default errorSystem was created
      expect(system.deps.errorSystem).toBeDefined();
      expect(typeof system.deps.errorSystem.handleError).toEqual("function");
    });

    test("createRouterSystem should create system with default eventBusSystem when not provided", () => {
      // Create a system with only errorSystem, no eventBusSystem
      const system = createRouterSystem({ errorSystem });

      // Verify that a default eventBusSystem was created
      expect(system.deps.eventBusSystem).toBeDefined();
      expect(typeof system.deps.eventBusSystem.getEventBus).toEqual("function");

      // Verify the default getEventBus returns an EventEmitter
      const eventBus = system.deps.eventBusSystem.getEventBus();
      expect(eventBus instanceof EventEmitter).toEqual(true);
    });

    test("createRouterSystem should use provided dependencies over defaults", () => {
      // Create a custom mock for errorSystem
      const customErrorSystem = {
        handleError: function () {},
      };

      // Create system with the custom errorSystem
      const system = createRouterSystem({
        errorSystem: customErrorSystem,
        eventBusSystem,
        config,
      });

      // Verify the custom errorSystem was used, not the default
      expect(system.deps.errorSystem).toEqual(customErrorSystem);
      expect(system.deps.errorSystem.handleError).toEqual(
        customErrorSystem.handleError
      );
    });

    test("shutdown should do nothing when called on uninitialized system", async () => {
      // Create a new system but don't initialize it
      const uninitSystem = new RouterSystem(deps);

      // Verify it's not initialized
      expect(uninitSystem.initialized).toEqual(false);

      // Call shutdown
      await uninitSystem.shutdown();

      // Verify nothing happened - state should still be 'created'
      expect(uninitSystem.state.status).toEqual("created");

      // The key is that we're testing the early return on line 776,
      // where if (!this.initialized) return; immediately exits
    });

    test("shutdown should properly clean up when system is initialized", async () => {
      // Initialize the system
      await routerSystem.initialize();
      expect(routerSystem.initialized).toEqual(true);

      // Call shutdown
      await routerSystem.shutdown();

      // Verify shutdown occurred correctly
      expect(routerSystem.initialized).toEqual(false);
      expect(routerSystem.router).toBeNull();
      expect(routerSystem.state.status).toEqual("shutdown");
    });

    test("should handle error during shutdown and throw SHUTDOWN_FAILED", async () => {
      // Create a fresh RouterSystem instance and initialize it.
      const freshSystem = new RouterSystem(deps);
      await freshSystem.initialize();

      // Override the underlying router.shutdown to force an error.
      freshSystem.router.shutdown = async () => {
        throw new Error("Forced shutdown error");
      };

      // Expect shutdown() to reject with a RouterError indicating shutdown failure.
      await expect(freshSystem.shutdown()).rejects.toThrow(RouterError);

      // Verify that the system state is updated to 'error' and the error is recorded
      expect(freshSystem.state.status).toEqual("error");
      const errorRecord = freshSystem.state.errors.find(
        (err) => err.context && err.context.phase === "shutdown"
      );
      expect(errorRecord).toBeDefined();

      // Verify that the shutdown failure metric is recorded
      const metrics = freshSystem.getMetrics();
      expect(metrics["routersystem.shutdown.failed"]).toBeDefined();
      expect(metrics["routersystem.shutdown.failed"].tags.errorMessage).toEqual(
        "Forced shutdown error"
      );
    });

    test("createRouterSystem should work when called with no arguments", () => {
      // Call createRouterSystem with no arguments at all
      // This will trigger the default parameter assignment deps = {}
      const system = createRouterSystem();

      // Verify the system was created successfully
      expect(system).toBeInstanceOf(RouterSystem);

      // Verify the default dependencies were created
      expect(system.deps.errorSystem).toBeDefined();
      expect(typeof system.deps.errorSystem.handleError).toEqual("function");
      expect(system.deps.eventBusSystem).toBeDefined();
      expect(typeof system.deps.eventBusSystem.getEventBus).toEqual("function");
      expect(system.deps.config).toEqual({});
    });
  });
});
