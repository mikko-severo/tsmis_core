// src/core/router/RouterSystem.js
import { EventEmitter } from "events";
import { CoreRouter } from "./Router.js";
import { RouterError, ErrorCodes } from "../errors/index.js";

/**
 * Router system for centralized route management
 * @extends EventEmitter
 */
export class RouterSystem extends EventEmitter {
  static dependencies = ["errorSystem", "eventBusSystem", "config"];
  static version = "1.0.0";

  /**
   * Create a new RouterSystem
   * @param {Object} deps - Dependencies
   */
  constructor(deps) {
    super();
    this.deps = deps;
    this.router = null;
    this.initialized = false;

    // Enhanced state tracking
    this.state = {
      status: "created",
      startTime: null,
      errors: [],
      metrics: new Map(),
      healthChecks: new Map(),
    };

    // Validate dependencies immediately
    this.validateDependencies();

    // Set up health check function map
    this.setupDefaultHealthChecks();
  }

  /**
   * Validate required dependencies
   * @private
   */
  validateDependencies() {
    const missing = this.constructor.dependencies.filter(
      (dep) => !this.deps[dep]
    );

    if (missing.length > 0) {
      throw new RouterError(
        "MISSING_DEPENDENCIES",
        `Missing required dependencies: ${missing.join(", ")}`,
        { missingDeps: missing }
      );
    }

    // Validate eventBusSystem dependency
    if (
      this.deps.eventBusSystem &&
      typeof this.deps.eventBusSystem.getEventBus !== "function"
    ) {
      throw new RouterError(
        "INVALID_EVENTBUS_SYSTEM",
        "EventBusSystem missing required method: getEventBus",
        { dependency: "eventBusSystem" }
      );
    }

    // Validate errorSystem dependency
    if (
      this.deps.errorSystem &&
      typeof this.deps.errorSystem.handleError !== "function"
    ) {
      throw new RouterError(
        "INVALID_ERROR_SYSTEM",
        "ErrorSystem missing required method: handleError",
        { dependency: "errorSystem" }
      );
    }
  }

  /**
   * Set up default health checks
   * @private
   */
  setupDefaultHealthChecks() {
    // Register default health check for state
    this.registerHealthCheck("state", async () => {
      return {
        status: this.initialized ? "healthy" : "unhealthy",
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        errorCount: this.state.errors.length,
      };
    });

    // Register health check for router - handle case when router is not initialized
    this.registerHealthCheck("router", async () => {
      if (!this.initialized || !this.router) {
        return {
          status: "unhealthy",
          reason: "Router not initialized",
        };
      }

      try {
        // Use router's health check if available
        if (typeof this.router.checkHealth === "function") {
          return await this.router.checkHealth();
        } else {
          return {
            status: "healthy",
            details:
              "Router instance exists but does not support health checks",
          };
        }
      } catch (error) {
        return {
          status: "error",
          error: error.message,
        };
      }
    });
  }

  /**
   * Register a health check function
   * @param {string} name - Health check name
   * @param {Function} checkFn - Health check function
   */
  registerHealthCheck(name, checkFn) {
    if (typeof checkFn !== "function") {
      throw new RouterError(
        "INVALID_HEALTH_CHECK",
        `Health check ${name} must be a function`,
        { checkName: name }
      );
    }
    this.state.healthChecks.set(name, checkFn);
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   * @param {Object} tags - Metric tags
   */
  recordMetric(name, value, tags = {}) {
    this.state.metrics.set(name, {
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  /**
   * Get all metrics
   * @returns {Object} All metrics
   */
  getMetrics() {
    const metrics = {};
    for (const [name, data] of this.state.metrics) {
      metrics[name] = data;
    }
    return metrics;
  }

  /**
   * Initialize the router system
   * @returns {Promise<RouterSystem>} - This instance
   */
  async initialize() {
    if (this.initialized) {
      throw new RouterError(
        "ALREADY_INITIALIZED",
        "RouterSystem is already initialized",
        { state: this.state.status }
      );
    }

    try {
      // Update state
      this.state.status = "initializing";
      this.state.startTime = Date.now();

      // Create the router
      this.router = new CoreRouter(this.deps);

      // Set up event forwarding from router to system
      this.setupEventForwarding();

      // Now initialize the router
      await this.router.initialize();

      this.initialized = true;
      this.state.status = "running";

      // Record metric
      this.recordMetric("routersystem.initialized", 1);

      // Emit initialized event
      this.emit("system:initialized", {
        timestamp: new Date().toISOString(),
      });

      return this;
    } catch (error) {
      // Update state
      this.state.status = "error";

      // Record error in state
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: "initialization" },
      });

      // Record metric
      this.recordMetric("routersystem.initialization.failed", 1, {
        errorMessage: error.message,
      });

      await this.handleError(error, { phase: "initialization" });

      throw new RouterError(
        "INITIALIZATION_FAILED",
        "Failed to initialize RouterSystem",
        { originalError: error.message },
        { cause: error }
      );
    }
  }

  /**
   * Set up event forwarding from router to system
   * @private
   */
  setupEventForwarding() {
    if (!this.router) return;

    // Forward router events to system level with consistent naming
    this.router.on("route:registered", (event) => {
      this.emit("system:route:registered", event);
      // Also emit in original format for backward compatibility
      this.emit("route:registered", event);
    });

    this.router.on("route:unregistered", (event) => {
      this.emit("system:route:unregistered", event);
      this.emit("route:unregistered", event);
    });

    this.router.on("routes:applied", (event) => {
      this.emit("system:routes:applied", event);
      this.emit("routes:applied", event);
    });

    this.router.on("routes:cleared", (event) => {
      this.emit("system:routes:cleared", event);
      this.emit("routes:cleared", event);
    });

    this.router.on("adapter:registered", (event) => {
      this.emit("system:adapter:registered", event);
      this.emit("adapter:registered", event);
    });

    this.router.on("middleware:registered", (event) => {
      this.emit("system:middleware:registered", event);
      this.emit("middleware:registered", event);
    });

    this.router.on("router:error", (event) => {
      this.emit("system:error", event);
      this.emit("router:error", event);
    });
  }

  /**
   * Handle error with proper context
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Promise<void>}
   */
  async handleError(error, context = {}) {
    // Add error to state
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context: context || {},
    });

    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Record metric
    this.recordMetric("routersystem.errors", 1, {
      errorType: error.constructor.name,
      errorCode: error.code,
    });

    // Forward to error system
    if (this.deps.errorSystem) {
      try {
        await this.deps.errorSystem.handleError(error, {
          source: "RouterSystem",
          ...context,
        });
      } catch (handlerError) {
        // Log error handling failure
        this.state.errors.push({
          timestamp: new Date().toISOString(),
          error: handlerError.message,
          context: { phase: "error-handling" },
        });
      }
    }

    // Emit error event
    this.emit("system:error", {
      error,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the router instance
   * @returns {CoreRouter} - Router instance
   */
  getRouter() {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    return this.router;
  }

  /**
   * Register a route
   * @param {string} moduleId - Module ID
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RouterSystem} - This instance
   */
  registerRoute(moduleId, method, path, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      this.router.registerRoute(moduleId, method, path, handler, options);

      // Record metric
      this.recordMetric("routersystem.routes.registered", 1, {
        moduleId,
        method: method.toUpperCase(),
      });

      return this;
    } catch (error) {
      this.handleError(error, {
        method: "registerRoute",
        moduleId,
        route: { method, path },
      });
      throw error;
    }
  }

  /**
   * Register a versioned route
   * @param {string} moduleId - Module ID
   * @param {number} version - API version
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RouterSystem} - This instance
   */
  registerVersionedRoute(
    moduleId,
    version,
    method,
    path,
    handler,
    options = {}
  ) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      this.router.registerVersionedRoute(
        moduleId,
        version,
        method,
        path,
        handler,
        options
      );

      // Record metric
      this.recordMetric("routersystem.routes.versioned.registered", 1, {
        moduleId,
        version,
        method: method.toUpperCase(),
      });

      return this;
    } catch (error) {
      this.handleError(error, {
        method: "registerVersionedRoute",
        moduleId,
        version,
        route: { method, path },
      });
      throw error;
    }
  }

  /**
   * Register an adapter
   * @param {string} name - Adapter name
   * @param {Object} adapter - Adapter implementation
   * @returns {RouterSystem} - This instance
   */
  registerAdapter(name, adapter) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      this.router.registerAdapter(name, adapter);

      // Record metric
      this.recordMetric("routersystem.adapters.registered", 1, {
        adapterName: name,
      });

      return this;
    } catch (error) {
      this.handleError(error, {
        method: "registerAdapter",
        adapterName: name,
      });
      throw error;
    }
  }

  /**
   * Register middleware
   * @param {string} name - Middleware name
   * @param {Function} handler - Middleware handler
   * @param {Object} options - Middleware options
   * @returns {RouterSystem} - This instance
   */
  registerMiddleware(name, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      this.router.registerMiddleware(name, handler, options);

      // Record metric
      this.recordMetric("routersystem.middleware.registered", 1, {
        middlewareName: name,
      });

      return this;
    } catch (error) {
      this.handleError(error, {
        method: "registerMiddleware",
        middlewareName: name,
      });
      throw error;
    }
  }

  /**
   * Apply routes to a framework using the specified adapter
   * @param {Object} framework - HTTP framework instance
   * @param {string} adapterName - Adapter name
   * @returns {Promise<Object>} - Framework with routes applied
   */
  async applyRoutes(framework, adapterName) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      const result = await this.router.applyRoutes(framework, adapterName);

      // Record metric
      this.recordMetric("routersystem.routes.applied", 1, {
        adapterName,
        count: this.router.getRoutes().length,
      });

      return result;
    } catch (error) {
      await this.handleError(error, {
        method: "applyRoutes",
        adapterName,
      });
      throw error;
    }
  }

  /**
   * Get all registered routes
   * @returns {Array} - Array of route objects
   */
  getRoutes() {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      return this.router.getRoutes();
    } catch (error) {
      this.handleError(error, {
        method: "getRoutes",
      });
      throw error;
    }
  }

  /**
   * Get a specific route by method and path
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {Object|null} - Route object or null if not found
   */
  getRoute(method, path) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      return this.router.getRoute(method, path);
    } catch (error) {
      this.handleError(error, {
        method: "getRoute",
        routeInfo: { method, path },
      });
      throw error;
    }
  }

  /**
   * Get routes for a specific module
   * @param {string} moduleId - Module ID
   * @returns {Array} - Array of route objects
   */
  getModuleRoutes(moduleId) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      return this.router.getModuleRoutes(moduleId);
    } catch (error) {
      this.handleError(error, {
        method: "getModuleRoutes",
        moduleId,
      });
      throw error;
    }
  }

  /**
   * Unregister a route
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {boolean} - Whether the route was unregistered
   */
  unregisterRoute(method, path) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      const result = this.router.unregisterRoute(method, path);

      if (result) {
        // Record metric
        this.recordMetric("routersystem.routes.unregistered", 1, {
          method: method.toUpperCase(),
          path,
        });
      }

      return result;
    } catch (error) {
      this.handleError(error, {
        method: "unregisterRoute",
        routeInfo: { method, path },
      });
      throw error;
    }
  }

  /**
   * Unregister all routes for a module
   * @param {string} moduleId - Module ID
   * @returns {number} - Number of routes unregistered
   */
  unregisterModuleRoutes(moduleId) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      const count = this.router.unregisterModuleRoutes(moduleId);

      // Record metric
      this.recordMetric("routersystem.modules.routes.unregistered", count, {
        moduleId,
      });

      return count;
    } catch (error) {
      this.handleError(error, {
        method: "unregisterModuleRoutes",
        moduleId,
      });
      throw error;
    }
  }

  /**
   * Clear all routes
   * @returns {RouterSystem} - This instance
   */
  clearRoutes() {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      const count = this.router.getRoutes().length;
      this.router.clearRoutes();

      // Record metric
      this.recordMetric("routersystem.routes.cleared", count);

      return this;
    } catch (error) {
      this.handleError(error, {
        method: "clearRoutes",
      });
      throw error;
    }
  }

  /**
   * Generate OpenAPI documentation from routes
   * @param {Object} info - API info
   * @returns {Object} - OpenAPI document
   */
  generateOpenApiDoc(info = {}) {
    if (!this.initialized) {
      throw new RouterError(
        "NOT_INITIALIZED",
        "RouterSystem is not initialized",
        { state: this.state.status }
      );
    }

    try {
      return this.router.generateOpenApiDoc(info);
    } catch (error) {
      this.handleError(error, {
        method: "generateOpenApiDoc",
        info,
      });
      throw error;
    }
  }

  /**
   * Perform health checks
   * @returns {Promise<Object>} Health check results
   */
  async checkHealth() {
    if (!this.initialized) {
      return {
        name: "RouterSystem",
        status: "unhealthy",
        reason: "Not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    const results = {};
    let overallStatus = "healthy";

    for (const [name, checkFn] of this.state.healthChecks) {
      try {
        results[name] = await checkFn();
        if (results[name].status !== "healthy") {
          overallStatus = "unhealthy";
        }
      } catch (error) {
        results[name] = {
          status: "error",
          error: error.message,
        };
        overallStatus = "unhealthy";
      }
    }

    return {
      name: "RouterSystem",
      version: RouterSystem.version,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: results,
    };
  }

  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      name: "RouterSystem",
      version: RouterSystem.version,
      status: this.state.status,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
      initialized: this.initialized,
      errorCount: this.state.errors.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Shutdown the router system
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) return; // line start 776

    try {
      this.state.status = "shutting_down";

      // Record metric
      this.recordMetric("routersystem.shutdown", 1);

      // Shutdown router
      await this.router.shutdown();

      this.initialized = false;
      this.router = null;
      this.state.status = "shutdown";

      // Emit shutdown event
      this.emit("system:shutdown", {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.state.status = "error";

      // Record error in state
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: "shutdown" },
      });

      // Record metric
      this.recordMetric("routersystem.shutdown.failed", 1, {
        errorMessage: error.message,
      });

      await this.handleError(error, { phase: "shutdown" });

      throw new RouterError(
        "SHUTDOWN_FAILED",
        "Failed to shutdown RouterSystem",
        { originalError: error.message },
        { cause: error }
      );
    }
  }
}

/**
 * Factory function for creating a RouterSystem
 * @param {Object} deps - Dependencies
 * @returns {RouterSystem} - RouterSystem instance
 */
export function createRouterSystem(deps = {}) {
  // line end 827
  try {
    // Provide default dependencies if needed
    const defaultDeps = {
      errorSystem: deps.errorSystem || {
        handleError: async () => {}, // No-op handler if not provided
      },
      eventBusSystem: deps.eventBusSystem || {
        getEventBus: () => new EventEmitter(), // Simple event bus if not provided
      },
      config: deps.config || {}, // Empty config if not provided
    };

    // Create and return the RouterSystem instance
    return new RouterSystem({
      ...defaultDeps,
      ...deps,
    });
  } catch (error) {
    // Handle errors during creation
    console.error("Failed to create RouterSystem:", error);

    // Re-throw as RouterError
    throw new RouterError(
      "CREATION_FAILED",
      "Failed to create RouterSystem",
      { originalError: error.message },
      { cause: error }
    );
  }
}

export default {
  RouterSystem,
  createRouterSystem,
};
