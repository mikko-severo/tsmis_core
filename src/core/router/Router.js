// src/core/router/Router.js
import { EventEmitter } from 'events';
import { RouterError, ErrorCodes } from '../errors/index.js';

/**
 * Core router for managing HTTP routes
 * @extends EventEmitter
 */
export class CoreRouter extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];
  static version = '1.0.0';

  /**
   * Create a new CoreRouter
   * @param {Object} deps - Dependencies
   */
  constructor(deps) {
    super();
    this.deps = deps;
    this.routes = new Map();
    this.adapters = new Map();
    this.middleware = new Map();
    this.initialized = false;
    
    // Enhanced state tracking
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map(),
      healthChecks: new Map()
    };
    
    // Set up health check function map
    this.setupDefaultHealthChecks();
  }

  /**
   * Set up default health checks
   * @private
   */
  setupDefaultHealthChecks() {
    // Register default health check for state
    this.registerHealthCheck('state', async () => {
      return {
        status: this.initialized ? 'healthy' : 'unhealthy',
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        errorCount: this.state.errors.length
      };
    });

    // Register health check for routes
    this.registerHealthCheck('routes', async () => {
      const routes = Array.from(this.routes.values());
      const routesByMethod = {};
      
      for (const route of routes) {
        routesByMethod[route.method] = (routesByMethod[route.method] || 0) + 1;
      }
      
      return {
        status: 'healthy',
        count: routes.length,
        byMethod: routesByMethod
      };
    });

    // Register health check for adapters
    this.registerHealthCheck('adapters', async () => {
      return {
        status: 'healthy',
        count: this.adapters.size,
        adapters: Array.from(this.adapters.keys())
      };
    });
  }

  /**
   * Register a health check function
   * @param {string} name - Health check name
   * @param {Function} checkFn - Health check function
   */
  registerHealthCheck(name, checkFn) {
    if (typeof checkFn !== 'function') {
      throw new RouterError(
        'INVALID_HANDLER',
        `Health check ${name} must be a function`,
        { checkName: name }
      );
    }
    this.state.healthChecks.set(name, checkFn);
  }

  /**
   * Perform health checks
   * @returns {Object} Health check results
   */
  async checkHealth() {
    const results = {};
    let overallStatus = 'healthy';

    for (const [name, checkFn] of this.state.healthChecks) {
      try {
        results[name] = await checkFn();
        if (results[name].status !== 'healthy') {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      name: 'CoreRouter',
      version: CoreRouter.version,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results
    };
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
      tags
    });
  }

  /**
   * Initialize the router
   * @returns {Promise<CoreRouter>} - This instance
   */
  async initialize() {
    if (this.initialized) {
      throw new RouterError(
        'ALREADY_INITIALIZED',
        'CoreRouter is already initialized'
      );
    }

    try {
      // Update state
      this.state.status = 'initializing';
      this.state.startTime = Date.now();
      
      // Subscribe to events
      const eventBus = this.deps.eventBusSystem.getEventBus();
      this.subscriptions = [
        eventBus.subscribe('router.route.register', this.handleRouteRegistration.bind(this)),
        eventBus.subscribe('router.routes.clear', this.handleRoutesClear.bind(this)),
        eventBus.subscribe('router.module.unregister', this.handleModuleUnregister.bind(this))
      ];

      this.initialized = true;
      this.state.status = 'running';
      
      // Record metric
      this.recordMetric('router.initialized', 1);
      
      // Emit initialized event
      this.emit('router:initialized', {
        timestamp: new Date().toISOString()
      });
      
      return this;
    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: 'initialization' }
      });
      
      // Record metric
      this.recordMetric('router.initialization.failed', 1, {
        errorMessage: error.message
      });
      
      await this.handleError(error, { phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Register a route with the router
   * @param {string} moduleId - Module ID
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {CoreRouter} - This instance
   */
  registerRoute(moduleId, method, path, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'CoreRouter is not initialized'
      );
    }

    // Validate parameters
    if (!moduleId) {
      throw new RouterError(
        'INVALID_MODULE_ID',
        'Module ID is required'
      );
    }

    if (!method || typeof method !== 'string') {
      throw new RouterError(
        'INVALID_METHOD',
        'Method must be a non-empty string'
      );
    }

    if (!path || typeof path !== 'string') {
      throw new RouterError(
        'INVALID_PATH',
        'Path must be a non-empty string'
      );
    }

    if (typeof handler !== 'function') {
      throw new RouterError(
        'INVALID_HANDLER',
        'Handler must be a function'
      );
    }

    const routeKey = `${method.toUpperCase()}:${path}`;

    // Check for conflicts
    if (this.routes.has(routeKey)) {
      const existing = this.routes.get(routeKey);
      throw new RouterError(
        'ROUTE_CONFLICT',
        `Route conflict: ${routeKey} already registered by ${existing.moduleId}`,
        { existingRoute: existing, newRoute: { moduleId, method, path } }
      );
    }

    // Register the route
    this.routes.set(routeKey, {
      moduleId,
      method: method.toUpperCase(),
      path,
      handler,
      options
    });

    // Emit event
    this.emit('route:registered', {
      moduleId,
      method: method.toUpperCase(),
      path,
      timestamp: new Date().toISOString()
    });

    // Record metric
    this.recordMetric('routes.registered', 1, {
      moduleId,
      method: method.toUpperCase()
    });

    return this;
  }

  /**
   * Register an adapter
   * @param {string} name - Adapter name
   * @param {Object} adapter - Adapter implementation
   * @returns {CoreRouter} - This instance
   */
  registerAdapter(name, adapter) {
    if (!name || typeof name !== 'string') {
      throw new RouterError(
        'INVALID_ADAPTER_NAME',
        'Adapter name must be a non-empty string'
      );
    }

    if (!adapter || typeof adapter.applyRoutes !== 'function') {
      throw new RouterError(
        'INVALID_ADAPTER',
        'Adapter must implement applyRoutes method'
      );
    }

    this.adapters.set(name, adapter);
    
    // Record metric
    this.recordMetric('adapters.registered', 1, {
      adapterName: name
    });

    // Emit event
    this.emit('adapter:registered', {
      name,
      timestamp: new Date().toISOString()
    });

    return this;
  }

  /**
   * Register middleware
   * @param {string} name - Middleware name
   * @param {Function} handler - Middleware handler
   * @param {Object} options - Middleware options
   * @returns {CoreRouter} - This instance
   */
  registerMiddleware(name, handler, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new RouterError(
        'INVALID_MIDDLEWARE_NAME',
        'Middleware name must be a non-empty string'
      );
    }

    if (typeof handler !== 'function') {
      throw new RouterError(
        'INVALID_MIDDLEWARE',
        'Middleware handler must be a function'
      );
    }

    this.middleware.set(name, {
      handler,
      options,
      order: options.order || 100
    });

    // Record metric
    this.recordMetric('middleware.registered', 1, {
      middlewareName: name
    });

    // Emit event
    this.emit('middleware:registered', {
      name,
      timestamp: new Date().toISOString()
    });

    return this;
  }

  /**
   * Get middleware for a route
   * @param {Object} route - Route object
   * @returns {Array} - Middleware array
   */
  getMiddlewareForRoute(route) {
    const routeMiddleware = route.options.middleware || [];
    const middleware = [];
    
    // Add global middleware
    for (const [name, mid] of this.middleware) {
      if (this.shouldApplyMiddleware(name, mid, route)) {
        middleware.push({
          name,
          handler: mid.handler,
          order: mid.order
        });
      }
    }
    
    // Add route-specific middleware
    for (const name of routeMiddleware) {
      if (this.middleware.has(name)) {
        const mid = this.middleware.get(name);
        middleware.push({
          name,
          handler: mid.handler,
          order: mid.order
        });
      }
    }
    
    // Sort by order
    return middleware.sort((a, b) => a.order - b.order);
  }

  /**
   * Determine if middleware should be applied to a route
   * @param {string} name - Middleware name
   * @param {Object} middleware - Middleware object
   * @param {Object} route - Route object
   * @returns {boolean} - Whether middleware should be applied
   */
  shouldApplyMiddleware(name, middleware, route) {
    // Apply to all routes by default
    if (!middleware.options.paths && !middleware.options.methods) {
      return true;
    }
    
    // Check path patterns
    if (middleware.options.paths) {
      const matchesPath = middleware.options.paths.some(pattern => {
        return this.pathMatchesPattern(route.path, pattern);
      });
      
      if (!matchesPath) {
        return false;
      }
    }
    
    // Check methods
    if (middleware.options.methods) {
      const matchesMethod = middleware.options.methods.includes(route.method);
      if (!matchesMethod) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if a path matches a pattern
   * @param {string} path - Path to check
   * @param {string} pattern - Pattern to match
   * @returns {boolean} - Whether path matches pattern
   */
  pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }
    
    return path === pattern;
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
        'NOT_INITIALIZED',
        'CoreRouter is not initialized'
      );
    }

    if (!framework) {
      throw new RouterError(
        'INVALID_FRAMEWORK',
        'Framework is required'
      );
    }

    if (!adapterName || !this.adapters.has(adapterName)) {
      throw new RouterError(
        'ADAPTER_NOT_FOUND',
        `Adapter ${adapterName} not found`
      );
    }

    try {
      const adapter = this.adapters.get(adapterName);
      const routes = Array.from(this.routes.values());

      // Apply routes using adapter
      const result = await adapter.applyRoutes(framework, routes);

      // Record metric
      this.recordMetric('routes.applied', routes.length, {
        adapter: adapterName
      });

      // Emit event
      this.emit('routes:applied', {
        adapter: adapterName,
        count: routes.length,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      await this.handleError(error, {
        method: 'applyRoutes',
        adapter: adapterName
      });

      throw new RouterError(
        'ROUTES_APPLICATION_FAILED',
        `Failed to apply routes using adapter ${adapterName}`,
        { adapter: adapterName },
        { cause: error }
      );
    }
  }

  /**
   * Get all registered routes
   * @returns {Array} - Array of route objects
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Get a specific route by method and path
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {Object|null} - Route object or null if not found
   */
  getRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    return this.routes.get(routeKey) || null;
  }

  /**
   * Get routes for a specific module
   * @param {string} moduleId - Module ID
   * @returns {Array} - Array of route objects
   */
  getModuleRoutes(moduleId) {
    return Array.from(this.routes.values())
      .filter(route => route.moduleId === moduleId);
  }

  /**
   * Unregister a route
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {boolean} - Whether the route was unregistered
   */
  unregisterRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    const route = this.routes.get(routeKey);
    
    if (!route) {
      return false;
    }
    
    this.routes.delete(routeKey);
    
    // Emit event
    this.emit('route:unregistered', {
      moduleId: route.moduleId,
      method: method.toUpperCase(),
      path,
      timestamp: new Date().toISOString()
    });
    
    // Record metric
    this.recordMetric('routes.unregistered', 1, {
      moduleId: route.moduleId,
      method: method.toUpperCase()
    });
    
    return true;
  }

  /**
   * Unregister all routes for a module
   * @param {string} moduleId - Module ID
   * @returns {number} - Number of routes unregistered
   */
  unregisterModuleRoutes(moduleId) {
    const moduleRoutes = this.getModuleRoutes(moduleId);
    
    for (const route of moduleRoutes) {
      this.unregisterRoute(route.method, route.path);
    }
    
    return moduleRoutes.length;
  }

  /**
   * Clear all routes
   * @returns {CoreRouter} - This instance
   */
  clearRoutes() {
    const count = this.routes.size;
    this.routes.clear();
    
    // Record metric
    this.recordMetric('routes.cleared', count);
    
    // Emit event
    this.emit('routes:cleared', {
      count,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }

  /**
   * Register a versioned route
   * @param {string} moduleId - Module ID
   * @param {number} version - API version
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {CoreRouter} - This instance
   */
  registerVersionedRoute(moduleId, version, method, path, handler, options = {}) {
    const versionedPath = `/api/v${version}${path.startsWith('/') ? path : `/${path}`}`;
    return this.registerRoute(moduleId, method, versionedPath, handler, {
      ...options,
      version
    });
  }

  /**
   * Generate OpenAPI documentation from routes
   * @param {Object} info - API info
   * @returns {Object} - OpenAPI document
   */
  generateOpenApiDoc(info = {}) {
    const paths = {};
    const tags = new Set();
    
    // Process routes
    for (const route of this.getRoutes()) {
      const { method, path, options } = route;
      
      // Extract tags
      if (options.tags) {
        for (const tag of options.tags) {
          tags.add(tag);
        }
      }
      
      // Process path parameters
      const pathParams = [];
      const openApiPath = path.replace(/:([^/]+)/g, (_, paramName) => {
        pathParams.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' }
        });
        return `{${paramName}}`;
      });
      
      // Build path object
      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }
      
      // Build operation object
      paths[openApiPath][method.toLowerCase()] = {
        tags: options.tags || [],
        summary: options.summary || '',
        description: options.description || '',
        parameters: [
          ...pathParams,
          // Other parameters from options.schema
        ],
        responses: {
          // Response definitions from options.schema
        },
        security: options.auth ? [{ bearerAuth: [] }] : []
      };
    }
    
    // Build OpenAPI document
    return {
      openapi: '3.0.0',
      info: {
        title: info.title || 'API Documentation',
        version: info.version || '1.0.0',
        description: info.description || ''
      },
      tags: Array.from(tags).map(tag => ({ name: tag })),
      paths,
      components: {
        // Schema components
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
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
      context: context || {}
    });
    
    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }
    
    // Record metric
    this.recordMetric('router.errors', 1, {
      errorType: error.constructor.name,
      errorCode: error.code
    });
    
    // Forward to error system
    if (this.deps.errorSystem) {
      try {
        await this.deps.errorSystem.handleError(error, {
          source: 'CoreRouter',
          ...context
        });
      } catch (handlerError) {
        // Log error handling failure
        this.state.errors.push({
          timestamp: new Date().toISOString(),
          error: handlerError.message,
          context: { phase: 'error-handling' }
        });
      }
    }
    
    // Emit error event
    this.emit('router:error', {
      error,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle route registration event
   * @param {Object} event - Event object
   * @returns {Promise<void>}
   */
  async handleRouteRegistration(event) {
    try {
      const { moduleId, method, path, handler, options } = event.data;
      this.registerRoute(moduleId, method, path, handler, options);
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleRouteRegistration'
      });
    }
  }

  /**
   * Handle routes clear event
   * @returns {Promise<void>}
   */
  async handleRoutesClear() {
    try {
      this.clearRoutes();
    } catch (error) {
      await this.handleError(error, {
        handler: 'handleRoutesClear'
      });
    }
  }

  /**
   * Handle module unregister event
   * @param {Object} event - Event object
   * @returns {Promise<void>}
   */
  async handleModuleUnregister(event) {
    try {
      const { moduleId } = event.data;
      this.unregisterModuleRoutes(moduleId);
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleModuleUnregister'
      });
    }
  }

  /**
   * Shutdown the router
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) return;

    try {
      this.state.status = 'shutting_down';

      // Unsubscribe from events
      const eventBus = this.deps.eventBusSystem.getEventBus();
      for (const subId of this.subscriptions) {
        eventBus.unsubscribe(subId);
      }

      this.routes.clear();
      this.adapters.clear();
      this.middleware.clear();
      this.initialized = false;
      this.state.status = 'shutdown';

      // Record metric
      this.recordMetric('router.shutdown', 1);

      // Emit shutdown event
      this.emit('router:shutdown', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.state.status = 'error';
      await this.handleError(error, { phase: 'shutdown' });

      throw new RouterError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown CoreRouter',
        { originalError: error.message },
        { cause: error }
      );
    }
  }
}

export default CoreRouter;